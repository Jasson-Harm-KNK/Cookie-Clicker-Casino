#!/usr/bin/env bash
# Development helper for the Cookie Clicker Expanded mod (macOS; browser version and Steam version of the game).
# Run without arguments for usage. Override the Steam game location with CC_APP and the debugger port with CC_DEBUG_PORT.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="${CC_APP:-$HOME/Library/Application Support/Steam/steamapps/common/Cookie Clicker/Cookie Clicker.app}"
RES="$APP/Contents/Resources/app"
MOD_LINK="$RES/mods/local/CookieClickerExpanded"
GAME_LINK="$REPO/game"
SAVE="$RES/save/save.cki"
PORT="${CC_DEBUG_PORT:-9222}"
WEB_URL="https://orteil.dashnet.org/cookieclicker"
WEB_SRC="$REPO/game-web"

usage() {
	cat <<EOF
Verwendung: ./scripts/dev.sh <befehl>

Browser (zuerst):
  web        mod/main.js in die Zwischenablage kopieren, zum Einfügen in die Konsole des Browser-Spiels
  fetch-web  aktuellen Code des Browser-Spiels nach game-web/ laden (zum Nachschlagen)

Steam:
  link       mod/ in den Mod-Ordner des Spiels verlinken (+ Referenz-Link game/ im Repo)
  unlink     beide Links wieder entfernen
  backup     aktuellen Spielstand nach saves/ kopieren
  run        Spielstand sichern, dann das Spiel mit offenem Debug-Port ($PORT) starten
  status     Pfade, Links und Zustand von Spiel/Debug-Port anzeigen
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

make_link() {
	local target="$1" link="$2"
	if [ -e "$link" ] && [ ! -L "$link" ]; then
		die "$link existiert bereits und ist kein Symlink. Bitte manuell prüfen."
	fi
	ln -sfn "$target" "$link" || die "Konnte $link nicht anlegen. Falls macOS den Zugriff blockiert: Systemeinstellungen > Datenschutz & Sicherheit > App-Verwaltung > Visual Studio Code erlauben."
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
	env -u ELECTRON_RUN_AS_NODE open -a "$APP" --args "--remote-debugging-port=$PORT"
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
	printf 'Spiel:        %s %s\n' "$APP" "$([ -d "$RES" ] && echo '(gefunden)' || echo '(NICHT gefunden)')"
	printf 'Mod-Link:     %s\n' "$([ -L "$MOD_LINK" ] && readlink "$MOD_LINK" || echo 'nicht verlinkt')"
	printf 'Referenz:     %s\n' "$([ -L "$GAME_LINK" ] && readlink "$GAME_LINK" || echo 'nicht verlinkt')"
	printf 'Spiel läuft:  %s\n' "$(game_running && echo ja || echo nein)"
	printf 'Debug-Port:   %s\n' "$(debug_port_up && echo "offen ($PORT)" || echo "geschlossen ($PORT)")"
}

case "${1:-}" in
	web)       cmd_web ;;
	fetch-web) cmd_fetch_web ;;
	link)      cmd_link ;;
	unlink)    cmd_unlink ;;
	backup)    cmd_backup ;;
	run)       cmd_run ;;
	status)    cmd_status ;;
	*)         usage; exit 1 ;;
esac
