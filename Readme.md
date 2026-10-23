# Cookie Clicker Expanded

Eine Erweiterung (Mod) für [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/) von Orteil / DashNet, für die Browser- und die Steam-Version.
Kostenloses, nicht-kommerzielles Fan-Projekt, noch in Arbeit. Der Name ist ein Arbeitstitel bis zur ersten Veröffentlichung.

## Installation (für Spieler)

Noch nicht veröffentlicht. Geplant ist Folgendes:

- **Browser:** ein Lesezeichen (Bookmarklet), das den Mod in das geöffnete Spiel lädt. Es muss nach jedem Neuladen der Seite erneut angeklickt werden.
- **Steam:** über den Steam Workshop. Manuell geht es auch: den Ordner `mod/` nach `<Spielordner>/mods/local/` kopieren und im Spiel unter *Optionen → Mods verwalten* aktivieren.

## Entwicklung

**Grundsatz: Browser zuerst.** Jede Funktion muss im Browser laufen, bevor die Arbeit für Steam beginnt.
Beide Versionen laden dieselbe Datei `mod/main.js`. Node.js oder ein Build-Schritt sind nicht nötig.

Voraussetzungen: macOS, Safari (oder ein anderer Browser), Visual Studio Code und Cookie Clicker aus Steam (getestet mit 2.053).

### Einmalig einrichten

```sh
./scripts/dev.sh fetch-web   # Code des Browser-Spiels nach game-web/ laden
./scripts/dev.sh link        # Mod ins Steam-Spiel verlinken, Steam-Spielcode als game/ verlinken
```

`game-web/` und `game/` enthalten den Code des Spiels zum Nachschlagen. Die Mod-API ist jeweils in `main.js` im Abschnitt „MODDING API“ beschrieben.
Beide Ordner sind in VS Code schreibgeschützt und kommen nicht ins Git.

In Safari einmal die Entwicklerfunktionen einschalten: *Safari → Einstellungen → Erweitert → Funktionen für Webentwickler anzeigen*.

### 1. Im Browser testen

1. Das Spiel unter https://orteil.dashnet.org/cookieclicker/ öffnen. Vorher den Spielstand sichern (*Optionen → Spielstand exportieren*), denn der Mod läuft mit dem echten Browser-Spielstand.
2. In VS Code **Cmd+Shift+B** drücken (oder `./scripts/dev.sh web` ausführen). Damit landet `mod/main.js` in der Zwischenablage.
3. In Safari die Konsole öffnen (**Cmd+Option+C**), einfügen und Enter drücken. Die Meldung „Cookie Clicker Expanded loaded!“ erscheint.
4. Nach Änderungen die Seite neu laden (**Cmd+R**), damit der alte Stand des Mods verschwindet, und ab Schritt 2 wiederholen.

Eingefügter Code kann keine eigenen Bilder laden (`MOD.dir` ist dann leer). Sobald der Mod Bilder braucht, müssen diese über die veröffentlichte Fassung getestet werden (siehe unten).

### 2. Danach auf Steam

1. **F5** in VS Code („Cookie Clicker (Debug)“) sichert den Spielstand, startet das Spiel mit offenem Debug-Port und verbindet den VS-Code-Debugger. Ein Spiel, das schon ohne Debug-Port läuft (z. B. über Steam gestartet), muss vorher beendet werden.
2. Die **Debug-Konsole** ist dann die JavaScript-Konsole des Spiels, z. B. für `Game.mods['cookie clicker expanded'].data`.
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

- **Steam:** Vor jedem Start über F5 bzw. `dev.sh run` landet eine Kopie in `saves/` (nur lokal). Zum Wiederherstellen den Inhalt einer `.cki`-Datei im Spiel unter *Optionen → Speicherstand importieren* einfügen.
- **Browser:** Der Spielstand liegt im Browser. Vor Tests über *Optionen → Spielstand exportieren* sichern.
- Solange der Mod auf Steam aktiv ist, sperrt das Spiel Steam-Errungenschaften. Zum normalen Spielen den Mod unter *Optionen → Mods verwalten* deaktivieren. `"AllowSteamAchievs": 1` in `mod/info.txt` hebt die Sperre auf, laut Orteil aber nur für Mods, die das Spiel nicht stark aus dem Gleichgewicht bringen.

### Projektstruktur

| Pfad | Inhalt |
|---|---|
| `mod/` | Der eigentliche Mod. Nur Dateien, die ausgeliefert werden, denn der Steam-Workshop-Upload packt den Ordner komplett. |
| `mod/main.js` | Einstiegspunkt, für Browser und Steam |
| `mod/info.txt` | Metadaten für Steam; das Format beschreibt `game/mods/ReadMe.txt` |
| `scripts/dev.sh` | Alle Entwicklungsbefehle (ohne Argument aufrufen für eine Übersicht) |
| `types/` | Typ-Hinweise für die Autovervollständigung in VS Code |
| `game-web/`, `game/` | Code des Browser- bzw. Steam-Spiels (nur lokal, nur lesen) |
| `saves/` | Steam-Spielstand-Backups (nur lokal) |

### Veröffentlichen

**Browser:** Der Mod wird über GitHub Pages bereitgestellt. Dafür im öffentlichen GitHub-Repository unter *Settings → Pages* den Branch `main` mit dem Ordner `/ (root)` auswählen. Spieler legen dann ein Lesezeichen mit dieser Adresse an (`<github-user>` ersetzen):

```
javascript:(function(){Game.LoadMod('https://<github-user>.github.io/Cookie-Clicker-Expanded/mod/main.js');}());
```

**Steam Workshop:**

1. In `mod/info.txt` die `ModVersion` erhöhen und `Date` (TT/MM/JJJJ) aktualisieren, bei Bedarf auch `GameVersion`.
2. Optional ein Vorschaubild `mod/thumbnail.png` ablegen (unter 1 MB).
3. Im Spiel *Optionen → Mods veröffentlichen → Neue Mod – Ordner auswählen* öffnen, den Ordner `mod/` wählen und *Im Workshop veröffentlichen* klicken. Updates laufen später über *Veröffentlichte Mods aktualisieren*.

Die ID (`cookie clicker expanded`) darf sich nach der ersten Veröffentlichung nicht mehr ändern, denn das Spiel speichert die Daten des Mods unter dieser ID.

## Rechtliches

Cookie Clicker © Orteil / DashNet. Das Spiel bringt eine offizielle Mod-Schnittstelle mit, und dieses Projekt nutzt nur diese.
Das Repo enthält keine Dateien des Spiels (Code, Grafiken, Sounds) und soll auch keine enthalten.
