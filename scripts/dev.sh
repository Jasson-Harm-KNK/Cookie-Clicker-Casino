#!/usr/bin/env bash
# Development helper for the Cookie Clicker Casino mod (macOS; browser version and Steam version of the game).
# Run without arguments for usage. Overrides: CC_APP (Steam game), CC_CHROME (Chrome), CC_DEBUG_PORT / CC_BROWSER_PORT.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="${CC_APP:-$HOME/Library/Application Support/Steam/steamapps/common/Cookie Clicker/Cookie Clicker.app}"
RES="$APP/Contents/Resources/app"
MOD_LINK="$RES/mods/local/CookieClickerCasino"
GAME_LINK="$REPO/game"
SAVE="$RES/save/save.cki"
PORT="${CC_DEBUG_PORT:-9222}"
WEB_URL="https://orteil.dashnet.org/cookieclicker"
WEB_SRC="$REPO/game-web"
CHROME_APP="${CC_CHROME:-/Applications/Google Chrome.app}"
BROWSER_PORT="${CC_BROWSER_PORT:-9223}"
DEV_DIR="$REPO/.dev"

usage() {
	cat <<EOF
Verwendung: ./scripts/dev.sh <befehl>

Browser (zuerst):
  browser    Browser-Spiel in Chrome (eigenes Entwicklerprofil) öffnen, der Mod wird automatisch geladen
  web        mod/main.js in die Zwischenablage kopieren (zum Gegentest in Safari)
  fetch-web  aktuellen Code des Browser-Spiels nach game-web/ laden (zum Nachschlagen)

Steam:
  link       mod/ in den Mod-Ordner des Spiels verlinken (+ Referenz-Link game/ im Repo)
  unlink     beide Links wieder entfernen
  backup     aktuellen Spielstand nach saves/ kopieren
  run        Spielstand sichern, dann das Spiel mit offenem Debug-Port ($PORT) starten

  status     Zustand von Browser- und Steam-Umgebung anzeigen
EOF
}

die() { echo "Fehler: $*" >&2; exit 1; }

require_game() {
	[ -d "$RES" ] || die "Cookie Clicker nicht gefunden unter: $APP (anderen Pfad per CC_APP setzen)"
}

game_running() { pgrep -f "$APP/Contents/MacOS/" >/dev/null 2>&1; }

debug_port_up() {
	local info
	info="$(curl -fs --max-time 1 "http://127.0.0.1:$PORT/json/version" 2>/dev/null)" || return 1
	[[ "$info" == *Electron* ]]
}

browser_port_up() { curl -fs --max-time 1 "http://127.0.0.1:$BROWSER_PORT/json/version" >/dev/null 2>&1; }

helper_running() {
	[ -f "$DEV_DIR/browser_dev.pid" ] && ps -p "$(cat "$DEV_DIR/browser_dev.pid")" -o command= 2>/dev/null | grep -q browser_dev.py
}

make_link() {
	local target="$1" link="$2"
	if [ -e "$link" ] && [ ! -L "$link" ]; then
		die "$link existiert bereits und ist kein Symlink. Bitte manuell prüfen."
	fi
	ln -sfn "$target" "$link" || die "Konnte $link nicht anlegen. Falls macOS den Zugriff blockiert: Systemeinstellungen > Datenschutz & Sicherheit > App-Verwaltung > Visual Studio Code erlauben."
}

cmd_browser() {
	[ -d "$CHROME_APP" ] || die "Google Chrome nicht gefunden unter: $CHROME_APP (anderen Pfad per CC_CHROME setzen)"
	mkdir -p "$DEV_DIR"
	if ! browser_port_up; then
		# A separate profile keeps the browser game's save apart from normal browsing and is required for the debug port.
		open -na "$CHROME_APP" --args --user-data-dir="$DEV_DIR/chrome-profile" --remote-debugging-port="$BROWSER_PORT" \
			--no-first-run --no-default-browser-check "$WEB_URL/"
		printf 'Warte auf Chrome'
		for _ in $(seq 1 40); do
			if browser_port_up; then break; fi
			printf '.'
			sleep 0.5
		done
		echo
		browser_port_up || die "Chrome-Debug-Port $BROWSER_PORT ist nach 20 Sekunden nicht erreichbar."
	fi
	if ! helper_running; then
		nohup python3 -I "$REPO/scripts/browser_dev.py" "$BROWSER_PORT" </dev/null >"$DEV_DIR/browser_dev.log" 2>&1 &
		echo $! >"$DEV_DIR/browser_dev.pid"
	fi
	echo "Browser-Spiel läuft in Chrome (Debug-Port $BROWSER_PORT). Der Mod wird nach jedem Laden automatisch eingespielt."
	echo "Protokoll: .dev/browser_dev.log"
}

cmd_web() {
	pbcopy < "$REPO/mod/main.js"
	echo "mod/main.js ist in der Zwischenablage."
	echo "Browser-Spiel ($WEB_URL/) neu laden, Konsole öffnen (Safari: Cmd+Option+C), einfügen, Enter."
}

cmd_fetch_web() {
	mkdir -p "$WEB_SRC"
	local f
	for f in main.js minigameGarden.js minigameGrimoire.js minigameMarket.js minigamePantheon.js; do
		curl -fsS -o "$WEB_SRC/$f" "$WEB_URL/$f" || die "Download von $f fehlgeschlagen."
	done
	echo "Code des Browser-Spiels geladen nach: $WEB_SRC (nur zum Nachschlagen, nicht im Git)"
}

cmd_link() {
	require_game
	make_link "$REPO/mod" "$MOD_LINK"
	make_link "$RES" "$GAME_LINK"
	echo "Mod verlinkt:   $MOD_LINK -> $REPO/mod"
	echo "Referenz-Link:  $GAME_LINK -> $RES (nur lesen!)"
}

cmd_unlink() {
	if [ -L "$MOD_LINK" ]; then rm "$MOD_LINK"; echo "Mod-Link entfernt."; fi
	if [ -L "$GAME_LINK" ]; then rm "$GAME_LINK"; echo "Referenz-Link entfernt."; fi
}

cmd_backup() {
	require_game
	if [ ! -f "$SAVE" ]; then echo "Kein Spielstand gefunden ($SAVE), nichts zu sichern."; return 0; fi
	mkdir -p "$REPO/saves"
	local dest="$REPO/saves/save-$(date +%Y%m%d-%H%M%S).cki"
	cp "$SAVE" "$dest"
	echo "Spielstand gesichert: $dest"
}

cmd_run() {
	require_game
	[ -L "$MOD_LINK" ] || die "Mod ist nicht verlinkt. Zuerst: ./scripts/dev.sh link"
	if game_running; then
		if debug_port_up; then echo "Spiel läuft bereits mit Debug-Port $PORT."; return 0; fi
		die "Spiel läuft bereits, aber ohne Debug-Port. Bitte beenden und erneut starten."
	fi
	cmd_backup
	# Processes started from VS Code may have ELECTRON_RUN_AS_NODE=1 set; `open` passes it on
	# and the game (an Electron app) would then start as plain Node and exit immediately.
	# SteamAppId: the Steam client sets it when it starts the game; without it the game can't reach Steam
	# (no cloud saves, no Workshop) because steamworks looks for steam_appid.txt in the working directory.
	env -u ELECTRON_RUN_AS_NODE open --env SteamAppId=1454400 -a "$APP" --args "--remote-debugging-port=$PORT"
	printf 'Warte auf Debug-Port %s' "$PORT"
	for _ in $(seq 1 60); do
		if debug_port_up; then
			printf '\nSpiel läuft, Debugger kann sich verbinden (Port %s).\n' "$PORT"
			return 0
		fi
		printf '.'
		sleep 0.5
	done
	echo
	die "Debug-Port $PORT ist nach 30 Sekunden nicht erreichbar."
}

cmd_status() {
	echo "Browser"
	printf '  Chrome:       %s\n' "$([ -d "$CHROME_APP" ] && echo "$CHROME_APP" || echo 'NICHT gefunden')"
	printf '  Debug-Port:   %s\n' "$(browser_port_up && echo "offen ($BROWSER_PORT)" || echo "geschlossen ($BROWSER_PORT)")"
	printf '  Mod-Helfer:   %s\n' "$(helper_running && echo läuft || echo 'läuft nicht')"
	echo "Steam"
	printf '  Spiel:        %s %s\n' "$APP" "$([ -d "$RES" ] && echo '(gefunden)' || echo '(NICHT gefunden)')"
	printf '  Mod-Link:     %s\n' "$([ -L "$MOD_LINK" ] && readlink "$MOD_LINK" || echo 'nicht verlinkt')"
	printf '  Referenz:     %s\n' "$([ -L "$GAME_LINK" ] && readlink "$GAME_LINK" || echo 'nicht verlinkt')"
	printf '  Spiel läuft:  %s\n' "$(game_running && echo ja || echo nein)"
	printf '  Debug-Port:   %s\n' "$(debug_port_up && echo "offen ($PORT)" || echo "geschlossen ($PORT)")"
}

case "${1:-}" in
	browser)   cmd_browser ;;
	web)       cmd_web ;;
	fetch-web) cmd_fetch_web ;;
	link)      cmd_link ;;
	unlink)    cmd_unlink ;;
	backup)    cmd_backup ;;
	run)       cmd_run ;;
	status)    cmd_status ;;
	*)         usage; exit 1 ;;
esac
