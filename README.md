# Breathing Timer

A browser breathing timer you can install as a PWA. Follow a visual orb and timed prompts, pick a preset, or build your own protocol from patterns, holds, and other saved exercises.

## Features

- Guided inhale, hold, exhale, and rest phases with an animated visualizer
- Built-in presets and a protocol editor (stack steps, repeat rounds, reuse other exercises)
- Saved custom exercises in the browser (`localStorage`)
- Dark mode, Material-style accent colors, and localized prerecorded breathing cues with system-speech fallback
- English, Spanish, French, and Romanian
- Offline support via a service worker
- Visible semantic version linked to the offline cache release
- Tap the screen during a session to pause or resume (buttons and panels stay clickable)

## Built-in protocols

| Preset | What it does |
| --- | --- |
| Custom | Starting 4-4-4-4 pattern you can edit |
| Box Breathing (4-4-4-4) | Equal inhale, hold, exhale, hold |
| Relaxing Breath (4-7-8) | Longer hold and exhale |
| Equal Breathing (4-4) | Matching inhale and exhale |
| Power rounds | Linked power breaths, a hold that grows each round, then a recovery breath (6 rounds) |

Power breaths and recovery breath are building blocks. You can reuse them (or any saved exercise) as a linked step inside another protocol. Linked steps stay in sync with the original; **Make a local copy** inlines a snapshot so you can edit independently.

## Protocol editor

Open **Breathing** (wind icon) or tap the exercise name on the home screen.

- **Add pattern** — phases and cycle count
- **Add hold** — timed retention, optionally increasing each round
- **Reuse an exercise** — nested protocol (up to 3 levels)
- **Repeat sequence** — how many times to run the whole block list
- **Save as** — store a named exercise in this browser

Built-in presets cannot be overwritten. Saving a changed builtin creates a new user exercise.

## Appearance

The palette icon opens appearance settings: dark mode and accent color (presets or a custom color). The accent drives the primary UI color and the idle orb.

## Run locally

This is a static site. No build step.

```powershell
# Python
python -m http.server 8080

# Node
npx --yes serve .
```

Then open `http://localhost:8080`. A local HTTP server is recommended so the service worker and install prompt work.

Open `index.html` directly if you only need a quick look; install-as-app and offline cache need HTTP(S).

## Project layout

| File | Role |
| --- | --- |
| `index.html` | UI, settings panels, protocol editor |
| `styles.css` | Theme and layout |
| `script.js` | Timer, canvas, settings, i18n |
| `model.js` | Protocols, blocks, library, session timeline |
| `storage.js` | Defensive browser persistence |
| `ui-utils.js` | Pure UI formatting and keyboard-navigation helpers |
| `translation-manager.js` | Language selection, fallback, and parameter substitution |
| `translations/` | Explicit English, Spanish, French, and Romanian catalogs |
| `version.js` | Canonical app and offline-cache version |
| `voice.js` | Prerecorded breathing cues with localized system-speech fallback |
| `audio/voice/` | Offline MP3 cues organized by language |
| `sw.js` | Offline cache |
| `manifest.json` | PWA name and install metadata |
| `vendor/` | Bundled Bootstrap, Font Awesome, and Howler runtime assets and licenses |

Preferences live in `breathingTimerPreferences`. Saved exercises live in `breathingTimerLibrary`.

Howler 2.2.4 is vendored under `vendor/howler/` and loaded before `voice.js`.
Its reusable HTML5 audio pool handles Android media unlocking without requiring
a network dependency; the runtime is included in the service-worker cache. See
`vendor/howler/LICENSE.md` for its MIT license.

## Releases

The app follows semantic versioning. The canonical version lives in `version.js`, is displayed at the bottom of the settings drawers, and determines the service-worker cache name. `package.json` mirrors it and the test suite prevents the two versions from drifting. See [`VERSIONING.md`](VERSIONING.md) for the release workflow.

## Verify changes

```powershell
npm test
npm run check
```

## Development workflow

Repository work follows [`AGENTS.md`](AGENTS.md) and
[`git-workflow-for-agents.md`](git-workflow-for-agents.md). Any application
logic change must update the relevant runtime flow in
[`docs/README.md`](docs/README.md) in the same change. Commands and examples
should target Windows PowerShell and Node.js 18+.

## License

[GNU General Public License v3.0](LICENSE)
