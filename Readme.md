# Cookie Clicker Casino

Ein Mod für [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/) von Orteil / DashNet, für die Browser- und die Steam-Version.
Kostenloses, nicht-kommerzielles Fan-Projekt.

Der Mod bringt das **Casino**, ein Spezialgebäude zwischen Alchemielabor und Portal. Es produziert keine Kekse; jedes Casino (höchstens 6) schaltet ein Casinospiel frei: Roulette, Blackjack, Jackpot, Crash, Slots und Plinko. Gespielt wird mit beliebig vielen Keksen im Minispiel des Casinos, das sich ab Casino-Stufe 1 (ein Zuckerstück) öffnet.

## Installation (für Spieler)

- **Browser:** ein Lesezeichen mit dieser Adresse anlegen und im geöffneten Spiel anklicken. Nach jedem Neuladen der Seite erneut anklicken.
  ```
  javascript:(function(){Game.LoadMod('https://jassonharm.github.io/Cookie-Clicker-Casino/mod/main.js');}());
  ```
- **Steam:** den Mod im Steam Workshop abonnieren (Link folgt nach der Veröffentlichung) und im Spiel unter *Optionen → Mods verwalten* prüfen, dass er aktiv ist. Manuell geht es auch: den Ordner `mod/` nach `<Spielordner>/mods/local/` kopieren.

Solange der Mod auf Steam aktiv ist, sperrt das Spiel Steam-Errungenschaften, wie bei jedem Mod.

## Entwicklung

**Grundsatz: Browser zuerst.** Jede Funktion muss im Browser laufen, bevor die Arbeit für Steam beginnt.
Beide Versionen laden dieselbe Datei `mod/main.js`. Node.js oder ein Build-Schritt sind nicht nötig.

Voraussetzungen: macOS, Google Chrome (zum Entwickeln), Visual Studio Code und Cookie Clicker aus Steam (getestet mit 2.053). Safari ist optional, für Gegentests.

### Einmalig einrichten

```sh
./scripts/dev.sh fetch-web   # Code des Browser-Spiels nach game-web/ laden
./scripts/dev.sh link        # Mod ins Steam-Spiel verlinken, Steam-Spielcode als game/ verlinken
```

`game-web/` und `game/` enthalten den Code des Spiels zum Nachschlagen. Die Mod-API ist jeweils in `main.js` im Abschnitt „MODDING API“ beschrieben.
Beide Ordner sind in VS Code schreibgeschützt und kommen nicht ins Git.

### 1. Im Browser testen

1. **F5** in VS Code (Startkonfiguration „Browser (Chrome)“) öffnet das Browser-Spiel in Chrome und verbindet den VS-Code-Debugger. Chrome läuft dabei mit einem eigenen Entwicklerprofil (`.dev/chrome-profile`). Der Mod wird nach jedem Laden der Seite automatisch eingespielt. **Cmd+Shift+B** macht dasselbe ohne Debugger.
2. Die **Debug-Konsole** ist dann die JavaScript-Konsole des Spiels, z. B. für `Game.mods['cookie clicker casino'].data` oder `Game.Earn(1e6)`.
3. Sobald du eine Datei in `mod/` speicherst, speichert das Spiel und lädt neu, und der Mod kommt in der neuen Fassung wieder hinein.
4. Breakpoints in `mod/` setzen oder `debugger;` in den Code schreiben.

Wie das funktioniert: `scripts/browser_dev.py` liefert `mod/` unter `https://orteil.dashnet.org/__dev_mod__/` direkt von der Festplatte aus. Dann lädt es den Mod mit `Game.LoadMod()`, genau wie später das Lesezeichen der Spieler; auch eigene Bilder funktionieren. Das Protokoll liegt in `.dev/browser_dev.log`.

Das Entwicklerprofil hat einen eigenen Browser-Spielstand, der bei null beginnt. Für Tests mit Fortschritt einen Spielstand importieren (*Optionen → Speicherstand importieren*), z. B. ein Steam-Backup aus `saves/`.

**Gegentest in Safari:** Der Task „Safari: Mod in Zwischenablage“ kopiert `mod/main.js`. In Safari die Entwicklerfunktionen einschalten (*Einstellungen → Erweitert → Funktionen für Webentwickler anzeigen*), dann im Spiel die Konsole öffnen (**Cmd+Option+C**), einfügen und Enter drücken. Eingefügter Code kann keine eigenen Bilder laden.

### 2. Danach auf Steam

1. In VS Code unter *Ausführen und Debuggen* die Startkonfiguration „Steam“ wählen und **F5** drücken. Das sichert den Spielstand, startet das Spiel mit offenem Debug-Port und verbindet den VS-Code-Debugger. Ein Spiel, das schon ohne Debug-Port läuft (z. B. über Steam gestartet), muss vorher beendet werden.
2. Die **Debug-Konsole** ist dann die JavaScript-Konsole des Spiels, z. B. für `Game.mods['cookie clicker casino'].data`.
3. Nach Änderungen ohne Neustart neu laden, mit `Game.toSave=true;Game.toReload=true` in der Debug-Konsole. Das Spiel speichert dann und lädt alle Mods neu.
4. Für Breakpoints `debugger;` in den Code schreiben. Breakpoints, die man in `mod/main.js` per Klick setzt, greifen auf Steam nicht.

Weitere Befehle: `./scripts/dev.sh status | backup | unlink`. Alle Befehle gibt es auch als VS-Code-Tasks (*Terminal → Task ausführen*).

### Kompatibilität

- Die Browser-Version ist neuer als die Steam-Version 2.053. Die Mod-API ist gleich, bis auf zwei Hooks, die es nur im Browser gibt: `tickerFinal` und `cpsMult`. Wer sie nutzt, braucht für Steam einen Ersatzweg.
- Eigene Inhalte (Upgrades, Achievements …) direkt in `init()` anlegen, nicht im Hook `create`. Im Browser wird der Mod erst in das laufende Spiel geladen, und `create` ist dann schon vorbei.
- JavaScript höchstens auf dem Stand von ES2020, weil Steam mit Chromium 87 läuft.
- Eigene Bilder immer über `MOD.dir+'/datei.png'` ansprechen.
- `mod/info.txt` wird nur von Steam gelesen (Name, Abhängigkeiten, Sprachdateien).

### Spielstände

- **Steam:** Vor jedem Start über die Startkonfiguration „Steam“ bzw. `dev.sh run` landet eine Kopie in `saves/` (nur lokal). Zum Wiederherstellen den Inhalt einer `.cki`-Datei im Spiel unter *Optionen → Speicherstand importieren* einfügen.
- **Browser:** Der Spielstand liegt im Browser, beim Entwickeln im Chrome-Entwicklerprofil und damit getrennt von deinem normalen Browser-Spiel. Sichern geht über *Optionen → Spielstand exportieren*.
- Solange der Mod auf Steam aktiv ist, sperrt das Spiel Steam-Errungenschaften. Zum normalen Spielen den Mod unter *Optionen → Mods verwalten* deaktivieren. `"AllowSteamAchievs": 1` in `mod/info.txt` hebt die Sperre auf, laut Orteil aber nur für Mods, die das Spiel nicht stark aus dem Gleichgewicht bringen.

### Projektstruktur

| Pfad | Inhalt |
|---|---|
| `mod/` | Der eigentliche Mod. Nur Dateien, die ausgeliefert werden, denn der Steam-Workshop-Upload packt den Ordner komplett. |
| `mod/main.js` | Einstiegspunkt, für Browser und Steam |
| `mod/minigameCasino.js` | Minispiel des Casinos mit einem Spiel pro Casino: Roulette, Blackjack, Jackpot, Crash, Slots, Plinko (lädt das Spiel ab Casino-Stufe 1) |
| `mod/info.txt` | Metadaten für Steam; das Format beschreibt `game/mods/ReadMe.txt` |
| `mod/img/` | Eigene Grafiken des Mods |
| `art/` | Skripte, die die Grafiken in `mod/img/` erzeugen (brauchen Pillow, siehe Kopf der Skripte) |
| `scripts/dev.sh` | Alle Entwicklungsbefehle (ohne Argument aufrufen für eine Übersicht) |
| `scripts/browser_dev.py` | Hält den Mod im Browser-Spiel geladen (wird von `dev.sh browser` gestartet) |
| `types/` | Typ-Hinweise für die Autovervollständigung in VS Code |
| `game-web/`, `game/` | Code des Browser- bzw. Steam-Spiels (nur lokal, nur lesen) |
| `.dev/` | Chrome-Entwicklerprofil und Protokoll (nur lokal) |
| `saves/` | Steam-Spielstand-Backups (nur lokal) |

### Veröffentlichen

**Browser:** GitHub Pages liefert den Branch `main` aus (Ordner `/`). Jeder Push auf `main` ist damit nach wenigen Minuten live; das Lesezeichen der Spieler lädt immer den aktuellen Stand.

**Steam Workshop:**

1. In `mod/info.txt` die `ModVersion` erhöhen und `Date` (TT/MM/JJJJ) aktualisieren, bei Bedarf auch `GameVersion`. Die Beschreibung in `info.txt` wird beim ersten Hochladen zur Beschreibung im Workshop.
2. Das Vorschaubild `mod/thumbnail.png` (unter 1 MB) erzeugt `art/casino.py`.
3. Im Spiel *Optionen → Mods veröffentlichen → Veröffentlichte Mods aktualisieren* öffnen, beim Casino den Ordner `mod/` wählen und hochladen. Name, Beschreibung und Bilder ändert man auf der Workshop-Seite.

Die ID (`cookie clicker casino`) darf sich nie mehr ändern, denn das Spiel speichert die Daten des Mods unter dieser ID.

## Rechtliches

Cookie Clicker © Orteil / DashNet. Das Spiel bringt eine offizielle Mod-Schnittstelle mit, und dieses Projekt nutzt nur diese.
Das Repo enthält keine Dateien des Spiels (Code, Grafiken, Sounds) und soll auch keine enthalten.
