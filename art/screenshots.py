"""Renders screenshots of the Casino minigame for the Readme and the Steam Workshop: docs/screenshots/<game>.png.

The minigame runs in a small test page in headless Chrome, with the mod's own code, styles and graphics. The game's
graphics (panel background, button textures) stay out because the repo must not contain them: the panel gets a plain
background, and the game's button style is rebuilt from its CSS values.

Run: .dev/venv/bin/python art/screenshots.py  (needs Google Chrome and Pillow)
"""
import os, subprocess, tempfile
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(REPO, 'docs', 'screenshots')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
FONT = os.path.join(REPO, 'game', 'steam', 'Merriweather-Black.ttf')  # the Steam game's font file, only used for rendering
WIDTH = 654  # px, the minigame panel in a game window of about 1400px
SCALE = 2

# game state shown in each picture (M: the minigame, deck(): fixed blackjack cards)
VIEWS = {
	'roulette': """
		var R=M.roulette;R.inputL.value='2500000';M.showBet(R.inputL,R.infoL);
		R.spinning={bet:2500000,color:'green',result:0,end:0};R.place(R.fields.length+R.fields.indexOf(0)+0.15,0);R.finish(true);""",
	'blackjack': """
		M.select(1);var B=M.blackjack;B.newCard=deck(['Ts','6d','9h','Kc','3c']);
		B.inputL.value='2500000';M.showBet(B.inputL,B.infoL);B.deal();B.hit();""",
	'jackpot': """
		M.select(2);var J=M.jackpot;J.setOpponents(4,true);J.inputL.value='2500000';M.showBet(J.inputL,J.infoL);J.spin();
		J.spinning.winner=0;var s=J.slices[0];J.turn(360*5+360-(s[0]+s[1])/2,0);J.finish(true);""",
	'crash': """
		M.select(3);var C=M.crash;C.inputL.value='2500000';M.showBet(C.inputL,C.infoL);C.start();
		C.running.point=50;C.running.start=Date.now()-6200;C.update();""",
	'slots': """
		M.select(4);var S=M.slots;S.inputL.value='2500000';M.showBet(S.inputL,S.infoL);S.spin();
		S.spinning.stops=[6,13,19];S.finish(true);""",
	'plinko': """
		M.select(5);var P=M.plinko;P.inputL.value='2500000';M.showBet(P.inputL,P.infoL);P.countL.value='8';P.drop();
		var now=Date.now();P.balls.forEach(function(b,i){b.start=now-3600+i*420;});P.paint();""",
}

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Merriweather;src:url("%(font)s");}
body{margin:0;background:#000;font-family:Tahoma,Arial,sans-serif;font-size:12px;color:#fff;}
#rowSpecial20{width:%(width)dpx;background:radial-gradient(ellipse at 50%% 35%%,#1f2b21 0%%,#0e130f 75%%,#090b09 100%%);}
a.option{display:inline-block;border:1px solid;border-color:#ece2b6 #875526 #733726 #dfbc9a;border-radius:2px;background:linear-gradient(#1c1a18,#000);
	color:#ccc;font-size:12px;padding:4px 8px;text-decoration:none;text-shadow:0px 1px 1px #000;line-height:100%%;
	box-shadow:0px 0px 1px 2px rgba(0,0,0,0.5),0px 2px 4px rgba(0,0,0,0.25),0px 0px 2px 2px #000 inset,0px 1px 0px 1px rgba(255,255,255,0.5) inset;}
a.option.disabled{pointer-events:none;filter:grayscale(100%%);opacity:0.5;}
a.option.off{opacity:0.5;}
</style></head><body><div id="rowSpecial20"></div>
<script>
var l=function(id){return document.getElementById(id);};
var AddEvent=function(el,ev,f){el.addEventListener(ev,f);};
var PlaySound=function(){};
var LBeautify=function(n){return n.toLocaleString('en-US');};
var loc=function(s,p){return s=='%%1 cookie'?(p+' cookies'):s;};
var deck=function(cards){return function(){return cards.shift();};};
var Game={cookies:5e12,cookiesEarned:5e12,drawT:0,ascensionMode:0,Spend:function(x){this.cookies-=x;},
	Objects:{Casino:{id:20,amount:6,level:1,minigameName:'Games',onMinigame:1,minigameUrl:'%(script)s',switchMinigame:function(){}}}};
</script>
<script src="%(script)s"></script>
<script>
var M=Game.Objects.Casino.minigame;M.launch();
%(view)s
</script></body></html>"""


def render(name, view, tmp):
	page = os.path.join(tmp, name + '.html')
	shot = os.path.join(tmp, name + '.png')
	with open(page, 'w', encoding='utf-8') as f:
		f.write(PAGE % {'font': 'file://' + FONT, 'width': WIDTH, 'view': view,
			'script': 'file://' + os.path.join(REPO, 'mod', 'minigameCasino.js')})
	subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
		'--user-data-dir=' + os.path.join(tmp, 'profile'), '--force-device-scale-factor=%d' % SCALE,
		'--virtual-time-budget=3000', '--window-size=%d,700' % WIDTH, '--screenshot=' + shot, 'file://' + page],
		check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
	img = Image.open(shot).convert('RGB')
	# below the panel the page is black: cut there
	bottom = img.height
	while bottom > 1 and img.crop((0, bottom - 1, img.width, bottom)).getextrema() == ((0, 0), (0, 0), (0, 0)):
		bottom -= 1
	img = img.crop((0, 0, img.width, bottom))
	out = os.path.join(OUT, name + '.png')
	img.save(out, optimize=True)
	print(f'{name + ".png":16} {img.width}x{img.height}  {os.path.getsize(out) // 1024} KB')


def main():
	os.makedirs(OUT, exist_ok=True)
	with tempfile.TemporaryDirectory() as tmp:
		for name, view in VIEWS.items():
			render(name, view, tmp)


if __name__ == '__main__':
	main()
