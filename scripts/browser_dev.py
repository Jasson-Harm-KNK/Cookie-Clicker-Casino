"""Keeps the mod loaded in the browser game while developing. Started by `scripts/dev.sh browser`.

Connects to the DevTools port of the development Chrome and
- answers requests to https://orteil.dashnet.org/__dev_mod__/<file> with mod/<file> from disk, so the game
  loads the mod with Game.LoadMod() just like the bookmarklet does (MOD.dir and the mod's images work),
- loads the mod after every page load of the game,
- lets the game save and reload itself whenever a file in mod/ changes.
Exits when the browser is closed. Python standard library only (no Node on this machine).
"""
import base64, json, mimetypes, os, socket, struct, sys, time, urllib.parse, urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9223
MOD_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mod'))
GAME_URL = 'https://orteil.dashnet.org/cookieclicker/'
DEV_URL = 'https://orteil.dashnet.org/__dev_mod__/'

GAME_STATE = "typeof Game!=='undefined' && Game.ready ? (window.__devModLoaded ? 'loaded' : 'ready') : 'waiting'"
LOAD_MOD = "window.__devModLoaded=1;Game.LoadMod('" + DEV_URL + "main.js');'ok'"
# not via Game.toReload: that waits for the game loop, which Chrome slows down a lot while the window is in the background
SAVE_AND_RELOAD = "try{Game.WriteSave();}finally{location.reload();}"


def log(text):
	print(time.strftime('%H:%M:%S'), text, flush=True)


class Connection:
	"""Minimal WebSocket client for one DevTools target."""

	def __init__(self, ws_url):
		hostport, path = ws_url[len('ws://'):].split('/', 1)
		host, port = hostport.rsplit(':', 1)
		self.sock = socket.create_connection((host, int(port)), timeout=5)
		key = base64.b64encode(os.urandom(16)).decode()
		self.sock.sendall((f'GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
			f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
		head = b''
		while b'\r\n\r\n' not in head:
			chunk = self.sock.recv(1)
			if not chunk:
				raise ConnectionError('handshake failed')
			head += chunk
		if b' 101 ' not in head.split(b'\r\n')[0]:
			raise ConnectionError(head.decode(errors='replace'))
		self.buffer = b''
		self.next_id = 0
		self.handlers = {}

	def send(self, method, params=None):
		self.next_id += 1
		data = json.dumps({'id': self.next_id, 'method': method, 'params': params or {}}).encode()
		n = len(data)
		if n < 126:
			header = struct.pack('>BB', 0x81, 0x80 | n)
		elif n < 65536:
			header = struct.pack('>BBH', 0x81, 0x80 | 126, n)
		else:
			header = struct.pack('>BBQ', 0x81, 0x80 | 127, n)
		mask = os.urandom(4)
		keys = (mask * (n // 4 + 1))[:n]
		masked = (int.from_bytes(data, 'big') ^ int.from_bytes(keys, 'big')).to_bytes(n, 'big')
		self.sock.settimeout(5)
		self.sock.sendall(header + mask + masked)
		return self.next_id

	def _frame(self):
		buf = self.buffer
		if len(buf) < 2:
			return None
		n, pos = buf[1] & 0x7F, 2
		if n == 126:
			if len(buf) < 4:
				return None
			n, pos = struct.unpack('>H', buf[2:4])[0], 4
		elif n == 127:
			if len(buf) < 10:
				return None
			n, pos = struct.unpack('>Q', buf[2:10])[0], 10
		if len(buf) < pos + n:
			return None
		self.buffer = buf[pos + n:]
		return buf[0], buf[pos:pos + n]

	def recv(self, timeout):
		"""Next JSON message, or None if nothing complete arrived within timeout."""
		deadline = time.time() + timeout
		parts = []
		while True:
			frame = self._frame()
			if frame:
				flags, payload = frame
				opcode = flags & 0x0F
				if opcode == 0x8:
					raise ConnectionError('closed by browser')
				if opcode in (0x0, 0x1):
					parts.append(payload)
					if flags & 0x80:
						return json.loads(b''.join(parts))
				continue
			remaining = deadline - time.time()
			if remaining <= 0 and not parts:
				return None
			self.sock.settimeout(max(remaining, 1 if parts else 0.01))
			try:
				chunk = self.sock.recv(65536)
			except socket.timeout:
				if parts:
					continue
				return None
			if not chunk:
				raise ConnectionError('connection closed')
			self.buffer += chunk

	def dispatch(self, msg):
		handler = self.handlers.get(msg.get('method'))
		if handler:
			handler(msg.get('params', {}))

	def call(self, method, params=None, timeout=5):
		msg_id = self.send(method, params)
		deadline = time.time() + timeout
		while time.time() < deadline:
			msg = self.recv(deadline - time.time())
			if msg is None:
				continue
			if msg.get('id') == msg_id:
				if 'error' in msg:
					raise RuntimeError(msg['error'].get('message'))
				return msg.get('result', {})
			self.dispatch(msg)
		raise TimeoutError(method)

	def pump(self, duration):
		deadline = time.time() + duration
		while time.time() < deadline:
			msg = self.recv(deadline - time.time())
			if msg:
				self.dispatch(msg)

	def evaluate(self, expression):
		result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
		return result.get('result', {}).get('value')


def serve(conn, params):
	"""Answer a request for DEV_URL/<file> with mod/<file>."""
	rel = urllib.parse.unquote(urllib.parse.urlsplit(params['request']['url']).path)
	rel = rel[len(urllib.parse.urlsplit(DEV_URL).path):]
	path = os.path.realpath(os.path.join(MOD_DIR, rel))
	headers = [{'name': 'Cache-Control', 'value': 'no-store'}]
	if path.startswith(MOD_DIR + os.sep) and os.path.isfile(path):
		with open(path, 'rb') as f:
			body = f.read()
		headers.append({'name': 'Content-Type', 'value': mimetypes.guess_type(path)[0] or 'application/octet-stream'})
		code = 200
	else:
		log(f'Nicht gefunden: mod/{rel}')
		body = b'Not found'
		headers.append({'name': 'Content-Type', 'value': 'text/plain'})
		code = 404
	conn.send('Fetch.fulfillRequest', {'requestId': params['requestId'], 'responseCode': code,
		'responseHeaders': headers, 'body': base64.b64encode(body).decode()})


def mod_signature():
	"""Changes whenever a file in mod/ is added, removed or modified (hidden files like .DS_Store are ignored)."""
	sig = []
	for root, dirs, files in os.walk(MOD_DIR):
		dirs[:] = [d for d in dirs if not d.startswith('.')]
		for name in files:
			if not name.startswith('.'):
				path = os.path.join(root, name)
				try:
					sig.append((path, os.stat(path).st_mtime_ns))
				except OSError:
					pass
	return sorted(sig)


def watch(conn):
	conn.handlers['Fetch.requestPaused'] = lambda params: serve(conn, params)
	conn.call('Fetch.enable', {'patterns': [{'urlPattern': DEV_URL + '*', 'requestStage': 'Request'}]})
	loaded_sig = None
	reload_requested = False
	while True:
		conn.pump(0.5)
		try:
			state = conn.evaluate(GAME_STATE)
			if state == 'ready':
				loaded_sig = mod_signature()
				reload_requested = False
				conn.evaluate(LOAD_MOD)
				log('Mod geladen')
			elif state == 'loaded':
				if loaded_sig is None:
					loaded_sig = mod_signature()
				elif not reload_requested and mod_signature() != loaded_sig:
					reload_requested = True
					conn.evaluate(SAVE_AND_RELOAD)
					log('Änderung in mod/ erkannt: Spiel speichert und lädt neu')
		except (RuntimeError, TimeoutError):
			pass  # page is (re)loading


def game_target():
	"""The first browser tab showing the game; None while there is none; raises OSError once the browser is gone."""
	targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/list', timeout=2))
	for target in targets:
		if target.get('type') == 'page' and target.get('url', '').startswith(GAME_URL) and target.get('webSocketDebuggerUrl'):
			return target
	return None


def main():
	try:
		os.setsid()  # detach from the terminal/task that started us
	except OSError:
		pass
	log(f'Warte auf das Browser-Spiel (DevTools-Port {PORT}), Mod-Ordner: {MOD_DIR}')
	while True:
		try:
			target = game_target()
		except OSError:
			log('Browser geschlossen, beende.')
			return
		if not target:
			time.sleep(1)
			continue
		try:
			conn = Connection(target['webSocketDebuggerUrl'])
			log('Verbunden mit ' + target['url'])
			watch(conn)
		except (ConnectionError, OSError) as e:
			log(f'Verbindung getrennt ({e})')
			time.sleep(1)


if __name__ == '__main__':
	main()
