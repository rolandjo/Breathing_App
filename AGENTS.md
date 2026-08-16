# AGENTS.md

Context for AI coding agents working in this repository. Breathing Timer is a
static, installable PWA with no application build step. Keep changes focused,
preserve browser compatibility, and treat the checked-in documentation as part
of the implementation rather than optional follow-up work.

## What this is

The application provides configurable breathing protocols, an animated canvas
guide, prerecorded phase cues with system-speech fallback, local persistence,
and offline support through a service worker. It is deployed from `main` to
GitHub Pages.

## Commands

Use PowerShell syntax in commands and examples.

```powershell
npm run check
npm test
python -m http.server 8080
# Alternative local server:
npx --yes serve .
```

Open `http://localhost:8080` for local browser testing. Do not rely on opening
`index.html` directly when testing service workers, installation, offline
behavior, or media playback.

## Architecture

| File | Role |
| --- | --- |
| `index.html` | Application shell, controls, settings drawers, and script order |
| `styles.css` | Theme, layout, component states, and responsive behavior |
| `script.js` | Main controller: timer, canvas, UI events, i18n, and orchestration |
| `model.js` | Protocol/block model, built-ins, session traversal, and duration calculations |
| `voice.js` | Prerecorded cue playback, cancellation, volume, and TTS fallback |
| `storage.js` | Defensive `localStorage` access |
| `ui-utils.js` | Pure formatting and keyboard-navigation helpers |
| `translation-manager.js` | Translation lookup, fallback, and supported-language metadata |
| `translations/` | Explicit per-language UI, guide, preset, and TTS catalogs |
| `version.js` | Canonical application version and service-worker cache name |
| `sw.js` | Offline precache and runtime cache behavior |
| `audio/voice/` | Localized prerecorded audio assets |
| `vendor/howler/` | Pinned Howler audio runtime and MIT license |
| `tests/` | Node test suite for model, storage, UI, guide, version, and audio behavior |
| `docs/README.md` | Maintained logic diagrams and runtime-flow documentation |
| `VERSIONING.md` | Semantic-versioning and release procedure |

## Environment

- Primary development platform: **Windows with PowerShell**, not bash. Use
  PowerShell syntax for shell commands and documentation examples.
- Node.js 18+ is required. Tests use the built-in Node test runner.
- The application is static HTML/CSS/JavaScript and has no production build
  step.
- GitHub Pages is the production host. Service-worker behavior requires HTTP(S).
- Vendored browser dependencies must be stored under `vendor/`, loaded from the
  same origin to satisfy CSP, pinned intentionally, and accompanied by their
  applicable license.

## Git workflow

Follow [`git-workflow-for-agents.md`](git-workflow-for-agents.md) whenever
inspecting, modifying, reviewing, or publishing repository work. Rules in this
`AGENTS.md` take precedence if the documents conflict.

Repository-specific requirements:

- Preserve existing staged, unstaged, and untracked user work.
- Before editing, inspect `git status --short --branch` and the relevant diff.
- Keep changes limited to the requested outcome. Do not clean up unrelated files.
- Do not create or switch branches, commit, push, open or update a pull request,
  merge, tag, release, deploy, delete branches, or rewrite history unless the
  user explicitly requests that exact action.
- Permission for one Git action does not imply permission for another.
- Before reporting completion, inspect the final diff and run validation
  proportional to the change.
- Use Conventional Commits and the project-specific scopes below whenever a
  commit is explicitly requested.

## Documentation requirements

Documentation is part of the definition of done.

- **Every change to application logic must update `docs/README.md` in the same
  change.** Update the affected Mermaid diagram and surrounding explanation so
  the documented flow matches the code after the change.
- Update the root `README.md` when behavior visible to users, setup commands,
  supported platforms, project layout, or operational expectations change.
- Update `VERSIONING.md` only when the release policy or release procedure
  changes. Version-number bumps follow that document.
- Document new modules and cross-module relationships in both the architecture
  table above and `docs/README.md`.
- Document new third-party runtime dependencies, why they exist, how they are
  loaded, their offline-cache implications, and their license location.
- Keep examples executable on Windows PowerShell.
- Do not add comments or documentation that merely restate code. Explain the
  constraint, failure mode, browser behavior, or design reason that a future
  maintainer might otherwise remove.

Before completing a logic change, verify:

1. Does initialization or script ordering change?
2. Does the session, timer, canvas, audio, storage, localization, or PWA flow
   change?
3. Does a new retry, fallback, cache, invalidation, or error path exist?
4. Does `docs/README.md` show that path accurately?

If any answer is yes, the documentation update is required in the same diff.

## Commit conventions

All commits must follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:

- `feat`: new user-facing capability
- `fix`: defect correction
- `docs`: documentation-only change
- `refactor`: internal restructuring without intended behavior change
- `test`: test-only change
- `perf`: performance improvement
- `chore`: maintenance
- `build`: dependency or build/tooling change
- `ci`: automation change

Project scopes:

- `app`: `script.js` orchestration, timer, and session UI
- `model`: protocols, blocks, presets, and traversal
- `audio`: `voice.js` and prerecorded audio assets
- `pwa`: service worker, manifest, offline caching, and release metadata
- `ui`: HTML, CSS, accessibility, canvas presentation, and UI utilities
- `storage`: browser persistence and stored-data handling
- `docs`: user and architecture documentation
- `agents`: repository instructions and agent workflow

Omit the scope when a change does not fit one cleanly.

Examples:

- `fix(audio): retry recorded cues after mobile unlock`
- `perf(app): cache active visual phases`
- `feat(model): add reusable nested protocol blocks`
- `docs(agents): define PowerShell and Git workflow`

Use `!` after the type/scope or a `BREAKING CHANGE:` footer when a change makes
existing stored preferences/libraries incompatible, changes the meaning of an
exported module API, or requires migration of installed PWA data.

Commit rules:

- Use an imperative, normally lowercase description.
- Stage only intended paths or hunks and inspect the staged diff.
- Explain why non-obvious browser, caching, or compatibility behavior exists.
- Do not amend user-authored commits unless explicitly requested.
- Do not rewrite shared history.

## Code documentation

Use JSDoc for exported functions and non-obvious internal logic. Explain the
reasoning and failure mode, not just the signature.

```js
/**
 * Retries a recorded cue after the browser unlocks media playback.
 * Mobile browsers may reject a timer-triggered play() even though the same
 * source succeeds after a user gesture; treating that rejection as a missing
 * file would incorrectly switch the session to synthesized speech.
 *
 * @param {string} phaseType - inhale, exhale, hold, or rest
 * @returns {boolean} whether playback or a supported fallback was scheduled
 */
```

Prefer JSDoc when adding or substantially changing:

- Exported APIs from `model.js`, `voice.js`, `storage.js`, or `ui-utils.js`.
- Timer/session traversal, cache invalidation, media unlock/retry, service-worker
  strategies, migration, or fallback behavior where the obvious approach is
  incorrect.
- Stored-data schema assumptions and compatibility rules.

JSDoc is not required for self-explanatory one-liners, event wiring, or test
fixtures.

## Application-specific safeguards

- `version.js` is the canonical release version. Keep `package.json` and
  `package-lock.json` synchronized with it.
- Do not edit the service-worker cache name directly; it derives from
  `version.js`.
- When adding a runtime asset, update the service-worker precache when offline
  availability is required and test the deployed URL and MIME type.
- Preserve the distinction between Hold and Rest audio cues.
- Keep Howler same-origin and load it before `voice.js`; its runtime must remain
  in the service-worker precache for installed/offline sessions.
- Treat media `playerror` and media `loaderror` as different failure classes.
- Keep system speech as a fallback for genuine audio unavailability, not as a
  silent substitute for a recoverable mobile media lock.
- Preserve the `breathingTimerPreferences` and `breathingTimerLibrary` storage
  contracts or provide an explicit migration.
- Keep CSP restrictive. Runtime scripts, media, fonts, and styles should remain
  same-origin unless a reviewed requirement says otherwise.
- When changing translations or guide content, update all four supported
  language catalogs under `translations/` and keep translation tests passing.

## Validation

Run validation proportional to the change:

```powershell
npm run check
npm test
```

For visible or browser-specific behavior, also run the application through a
local HTTP server and perform targeted browser checks. Audio/PWA changes require
testing the normal online path and the installed/offline path where practical.
Report any platform validation that could not be performed; do not imply that a
desktop simulation proves behavior on a physical Android device.

## Completion checklist

- [ ] Applicable repository instructions were read.
- [ ] Git status and relevant diffs were inspected before editing.
- [ ] Existing user work was preserved.
- [ ] The implementation is limited to the requested outcome.
- [ ] `docs/README.md` was updated for every logic change.
- [ ] Root documentation was updated for user-visible or setup changes.
- [ ] The final diff contains no unrelated changes or secrets.
- [ ] Relevant checks were run and results reported accurately.
- [ ] No Git publication or destructive action occurred without explicit authorization.
- [ ] Remaining risks and untested platforms were stated clearly.
