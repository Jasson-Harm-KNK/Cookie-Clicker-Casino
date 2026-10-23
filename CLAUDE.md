# CLAUDE.md

Mod „Cookie Clicker Expanded“ (Arbeitstitel) für die Browser- und die Steam-Version von Cookie Clicker, entwickelt auf macOS.
Kein Build und kein Node: Beide Versionen laden `mod/main.js` direkt. Einrichtung und Arbeitsablauf stehen in `Readme.md`.

## Arbeitsweise

- **Browser zuerst** (Vorgabe des Nutzers): Jede Funktion muss im Browser funktionieren, bevor die Arbeit für Steam beginnt. Machbarkeit immer zuerst für den Browser prüfen.
- Entwickelt wird im Browser mit Chrome und einem eigenen Entwicklerprofil (F5 „Browser (Chrome)“), Safari dient nur zum Gegentest.
- Danach auf Steam testen und nur dort Nötiges ergänzen (info.txt, Sprachdateien, Workshop).

## Fakten

- Browser-Version: https://orteil.dashnet.org/cookieclicker/, neuer als Steam. `index.html` und `data/*.json` liegen hinter einer Cloudflare-Prüfung, `main.js` und `minigame*.js` sind frei abrufbar (`./scripts/dev.sh fetch-web` legt sie nach `game-web/`).
- Steam-Version 2.053 auf Electron 11.5, also Chromium 87. Deshalb höchstens ES2020 verwenden: kein `Array.prototype.at`, `Object.hasOwn` oder `structuredClone`, keine ES-Module bzw. `import`.
- Der Steam-Spielordner `~/Library/Application Support/Steam/steamapps/common/Cookie Clicker/Cookie Clicker.app/Contents/Resources/app` ist im Repo als Symlink `game/` erreichbar.
- Die Mod-API steht in `main.js` im Abschnitt „MODDING API“ (`game-web/main.js`, `game/src/main.js`). Beide sind gleich, nur der Browser hat zusätzlich die Hooks `tickerFinal` und `cpsMult` (auf Steam ignoriert `registerHook` sie mit einer Konsolenmeldung).
- Ladeablauf auf Steam: `init()` → Hook `create` → `load(str)`. Im Browser wird der Mod per `Game.LoadMod(url)` in das laufende Spiel geladen: `init()` und `load(str)` laufen sofort, `create` ist schon vorbei. Deshalb Inhalte direkt in `init()` anlegen.
- Im Browser merkt sich das Spiel keine Mods; sie werden nach jedem Seitenaufruf neu geladen (Bookmarklet). Die Speicherdaten nicht geladener Mods bleiben im Spielstand erhalten.
- Die Mod-ID `cookie clicker expanded` muss in `info.txt` (`ID`) und in `Game.registerMod` gleich sein. Vor der ersten Veröffentlichung darf sie sich noch ändern, danach nie mehr.
- `MOD.dir` ist der Ordner für eigene Dateien: Auf Steam setzt ihn das Spiel (`mods/local/CookieClickerExpanded`), im Browser leitet `main.js` ihn aus der Skript-URL ab. Bei Code, der in die Konsole eingefügt wurde, ist er leer.
- `Game.WriteSave` speichert nur Vanilla-Inhalte (`if (me.vanilla)`). Den Zustand eigener Upgrades, Achievements und Gebäude muss der Mod in `save()`/`load()` selbst sichern.
- Veröffentlichung im Browser über GitHub Pages (`https://<user>.github.io/Cookie-Clicker-Expanded/mod/main.js`). raw.githubusercontent.com funktioniert nicht, weil es Skripte als `text/plain` ausliefert.

## Regeln

- Im Steam-Spielordner nichts ändern außer dem Mod-Symlink in `mods/local`, den `scripts/dev.sh` verwaltet.
- Keine Dateien des Spiels (Code, Bilder, Sounds) ins Repo kopieren; `game/` und `game-web/` sind gitignored, denn das Repo soll öffentlich werden.
- In `mod/` liegt nur, was ausgeliefert wird: Der Steam-Workshop-Upload zippt diesen Ordner komplett.
- Spielstände in `game/save/` nie direkt anfassen. Backups über `./scripts/dev.sh backup`.
- Code-Stil wie im Spiel und in den Beispiel-Mods: Tabs, kompaktes Format (`init:function(){`), Kommentare im Code auf Englisch. Doku im Repo auf Deutsch, Texte im Spiel auf Englisch.

## Im laufenden Spiel testen

- Beide Spiele öffnen sich sichtbar auf dem Bildschirm des Nutzers, deshalb vor dem Start Bescheid geben.
- Browser: `./scripts/dev.sh browser` startet Chrome mit dem Profil `.dev/chrome-profile` und `--remote-debugging-port=9223` und startet `scripts/browser_dev.py`. Das Skript liefert `mod/` per CDP-`Fetch` unter `https://orteil.dashnet.org/__dev_mod__/` aus, lädt den Mod nach jedem Seitenaufbau (Marker `window.__devModLoaded`) und löst bei Dateiänderungen `Game.toSave=true;Game.toReload=true` aus. Das Protokoll steht in `.dev/browser_dev.log`. Für eigene Abfragen eignen sich `Connection` und `game_target()` aus `scripts/browser_dev.py` (es liest beim Import `sys.argv[1]` als Port). Der erste Start in einem frischen Profil zeigt die Sprachauswahl; die Auswahl lädt die Seite neu.
- Steam: `./scripts/dev.sh run` legt ein Save-Backup an und startet das Spiel mit `--remote-debugging-port=9222`. Danach ist es per Chrome DevTools Protocol erreichbar: `http://127.0.0.1:9222/json/list` liefert `webSocketDebuggerUrl`, darüber läuft `Runtime.evaluate`. Node und `websocat` sind nicht installiert, Python 3.9 schon (nur stdlib).
- Auf Steam neu laden, inklusive Mods und mit vorherigem Speichern: `Game.toSave=true;Game.toReload=true`.
- Im VS-Code-Extension-Host, also auch in Claude Code, ist `ELECTRON_RUN_AS_NODE=1` gesetzt. Das Steam-Spiel deshalb nur über `dev.sh` starten, das die Variable entfernt.
