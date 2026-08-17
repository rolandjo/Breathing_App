# Application logic documentation

This file is the maintained source of truth for the application's runtime
flows. Every change to session, timer, canvas, audio, storage, localization, or
PWA logic must update the affected diagram and explanation here in the same
change. User-visible behavior and setup changes must also be reflected in the
root [`README.md`](../README.md).

## App logic

```mermaid
flowchart TD
    A[Browser loads index.html] --> B[Load scripts in order]
    B --> B1[version.js → BreathingApp]
    B --> B2[storage.js → BreathingStorage]
    B --> B3[ui-utils.js → BreathingUiUtils]
    B --> B4[translations/*.js → explicit language catalogs]
    B --> B5[translation-manager.js → lookup and fallback]
    B --> B6[howler.core.min.js → mobile-safe audio engine]
    B --> B7[voice.js → BreathingVoice]
    B --> B8[model.js → BreathingModel]
    B --> B9[theme.js → BreathingTheme]
    B --> B10[visualizer.js → BreathingVisualizer]
    B --> B11[protocol-editor.js → BreathingProtocolEditor]
    B --> B12[exercise-chooser.js → BreathingExerciseChooser]
    B --> B13[script.js main controller]

    B13 --> C[DOMContentLoaded]
    C --> D[Find DOM elements]
    D --> E[Load preferences from localStorage]
    E --> F[Load selected protocol / theme / language / audio mode / volume]
    F --> G[Apply accent color + translations]
    G --> H[Render translated protocol editor + summary]
    H --> I[Initialize canvas + resize observer]
    I --> J[Start animation loop]
    J --> K{User action}

    K -->|Start| L[Create session from selected protocol]
    L --> M[Set running and countdown state]
    M --> N[Prepare mobile audio and show Stop]
    N --> N1[Display 3 → 2 → 1 without consuming exercise time]
    N1 --> O[Show Pause and set first guided prompt]
    O --> P[Play cue using the explicitly selected audio mode]

    P --> Q[renderLoop]
    Q --> R{Running?}
    R -->|No| S[Draw idle orb]
    S --> Q

    R -->|Paused| T[Draw paused state]
    T --> Q

    R -->|Yes| U["processActiveTimerAt(time)"]
    U --> V[currentStep from session]
    V --> W[Update phase timer]
    W --> X[Draw animated orb/progress]
    X --> Y{Phase complete?}
    Y -->|No| Q
    Y -->|Yes| Z[Advance session]
    Z --> AA{More steps?}
    AA -->|Yes| AB[Update prompt + audio cue]
    AB --> Q
    AA -->|No| AC["finishSession()"]
    AC --> AD[Mark complete + reset controls]
    AD --> Q

    K -->|Pause/Resume| AE[Toggle paused state]
    AE --> Q

    K -->|Stop| AF[Cancel voice + clear session]
    AF --> AG[Restore idle UI]
    AG --> Q

    K -->|Edit protocol| AH[Model updates blocks/phases]
    AH --> AI[Save prefs to localStorage]
    AI --> H

    K -->|Change appearance| AJ[Apply theme/accent color]
    AJ --> AI

    K -->|Change language| AK[Switch translations]
    AK --> G

    K -->|Navigation bar or rail| AL["Home, Protocols, Profile, or Settings"]
    AL --> K
```

There is still no bundler. Each file is a same-origin `<script>` that assigns a
`window.BreathingX` global, the same pattern as `model.js` and `voice.js`.
`theme.js` owns palette math and writes CSS custom properties.
`visualizer.js` owns orb geometry and canvas frames; it reads running/session
state through getters so the timer engine stays in `script.js`.
`protocol-editor.js` and `exercise-chooser.js` own DOM construction and call
back into the controller after edits or selection. Palette math and vertex
geometry are unit-tested in Node; the two DOM modules are organized the same
way as `Voice.createVoiceGuide` but still need a browser to assert rendered
output. All four files are in the service-worker precache so offline sessions
keep the extracted scripts.

The shell follows Material 3 Expressive scaffold: a tinted top app bar, a
content pane with margin/gutter spacing, and one navigation region. Below 840px
that region is a full-width bottom bar (active state is a pill behind the icon
only). From 840px it becomes a left rail; from 1200px the rail expands with
icon-and-label destinations. Home is the timer pane. Protocols opens the
protocol editor sheet. Profile is a placeholder sheet for future stats and
account integration. Settings opens language, audio, and appearance.
Opening Protocols, Profile, or Settings marks that destination until the
sheet closes, then Home becomes active again. Start, Pause, and Stop remain
in the content pane.

Protocols, Profile, and Settings open as **modal side sheets** over the pane
(Bootstrap offcanvas, M3 Expressive chrome). Each sheet uses a headline and
circular close with no header divider and tonal grouped cards. Settings also
has outlined fields, a language cycle chip, and a thick accent volume slider.
Scrim tap dismisses the sheet; Home and Start dismiss any open sheet. Protocols
keeps a **Guide** button that opens the full pattern catalog. On Home, a circular
**i** sits beside Remaining Cycles when the selected exercise is Box, Relaxing,
Equal, or Power rounds; that control opens a dialog with only that pattern’s
title and description. Custom and saved exercises have no Home info control.

## Audio cue flow

`BreathingVoice` offers three explicit modes. Recorded sounds are the default
and use localized `In.mp3`, `Out.mp3`, `Hold.mp3`, and `Pause.mp3` files. Bowl
mode uses `audio/tibetan-singing-bowl-54400.mp3` with different playback rates for
inhale and exhale. TTS mode uses the localized phrases and regional speech tags
from `translation-manager.js`; system speech never starts automatically.

Recorded cues first use Howler's Web Audio backend. A `loaderror` retries the
same recording once through Howler's HTML5 Audio pool because Android can report
a transient decoding or media-backend failure even when the file exists. If the
second backend also fails, or Howler is unavailable, the native bowl is used.
The bowl element is silently primed by the first recorded cue, while the Start
click still provides an Android-approved user gesture. A `playerror` waits once
for Howler's `unlock` event; another failure also uses the bowl. No file is
blacklisted for the rest of the session after a single error. Stop, pause, and
phase changes invalidate pending retries and cancel every active audio path.
Before a delayed session countdown begins, `prepare()` silently primes the bowl
element during the original Start gesture. This preserves Android media
permission until the first audible phase cue starts three seconds later.

Android's media stack requests MP3 data with an HTTP `Range` header. The service
worker stores complete audio files for offline use, then slices that complete
cached response into a standards-compliant `206 Partial Content` response. An
invalid or unsatisfiable range receives `416` with the complete asset length.
Partial responses are never cached because doing so could replace the complete
offline asset with a fragment.

```mermaid
flowchart TD
    S[Start gesture before session countdown] --> T[Silently prepare native bowl element]
    A[Phase starts or resumes] --> B[script.js calls BreathingVoice.speak]
    B --> C[Cancel the previous cue or speech]
    C --> D{Selected audio mode}
    D -->|TTS| E[Speak localized phase label]
    D -->|Bowl| F[Play native bowl at phase playback rate]
    D -->|Recorded| G[Prime bowl silently during Start gesture]
    G --> H{Howler available?}
    H -->|No| F
    H -->|Yes| I[Play localized recording with Web Audio]
    I --> J{Playback result}
    J -->|play / end| K[Complete prerecorded cue]
    J -->|playerror first time| L[Wait for Howler unlock]
    L --> M{Cue still current?}
    M -->|Yes| I
    M -->|No| N[Discard obsolete retry]
    J -->|loaderror| O[Retry recording with HTML5 Audio]
    O --> P{Retry succeeds?}
    P -->|Yes| K
    P -->|No| F
    J -->|second playerror| F

    Q[Stop, pause, or next phase] --> R[Cancel cue, bowl, speech, and pending retry]
```

## Service-worker media range flow

```mermaid
flowchart TD
    A[GET request reaches sw.js] --> B{Range header present?}
    B -->|No| C[Use normal navigation, network-first, or stale-while-revalidate path]
    B -->|Yes| D[Look up complete response by URL]
    D --> E{Complete status-200 response cached?}
    E -->|Yes| H[Read complete body]
    E -->|No| F[Fetch request without Range header]
    F --> G[Cache complete same-origin response]
    G --> H
    H --> I{Single byte range valid?}
    I -->|Yes| J[Slice bytes and return 206 with Content-Range]
    I -->|No| K[Return 416 with complete asset length]
```

## `script.js` flow

```mermaid
flowchart TD
    A[DOMContentLoaded] --> B[Resolve module globals]
    B --> C{All modules loaded?}
    C -->|No| D[Log error and stop]
    C -->|Yes| E[Collect DOM element references]
    E --> F[Create canvas context]

    F --> G[Initialize state variables]
    G --> G1[Create visualizer, protocol editor, and exercise chooser factories]
    G1 --> H[Build voice guide]
    H --> I[Define helper functions]

    I --> I1[BreathingTheme palette helpers]
    I --> I2[Prompt transition helper]
    I --> I3[BreathingVisualizer canvas factory]
    I --> I4[Timer helpers]
    I --> I5[BreathingProtocolEditor factory]
    I --> I6[Translation helpers]
    I --> I7[Persistence helpers]
    I --> I8[BreathingExerciseChooser factory]

    I --> J[Wire event listeners]
    J --> J1[Start / Pause / Stop buttons]
    J --> J2[Audio mode + volume controls]
    J --> J3[Accent swatches + color picker]
    J --> J4[Preset select]
    J --> J5[Protocol editor controls]
    J --> J6[Language toggle in Settings]
    J --> J7[Keyboard shortcuts]
    J --> J8[Visibility + resize listeners]
    J --> J9["exerciseChooser.bind()"]

    J --> K["initialize()"]
    K --> K1[Render version labels]
    K1 --> K2["loadPreferences()"]
    K2 --> K3["syncPresetUi()"]
    K3 --> K4["translatePage()"]
    K4 --> K5[Set control visibility]
    K5 --> K6[Set volume slider UI]
    K6 --> K7["visualizer.resizeCanvas()"]
    K7 --> K8[Attach ResizeObserver]
    K8 --> K9["Start renderLoop()"]

    K9 --> L[Idle render loop]
    L --> M{Running session?}
    M -->|No| N[Draw idle orb]
    N --> L

    M -->|Paused| O[Keep drawing paused state]
    O --> L

    M -->|Yes| P{Preparing session?}
    P -->|Yes| P1[Update 3 → 2 → 1 from absolute timestamp]
    P1 --> P2{Countdown complete?}
    P2 -->|No| L
    P2 -->|Yes| P3[Start first phase + show Pause + play cue]
    P3 --> L
    P -->|No| Q[currentStep() from session]
    Q --> R[Update phase countdown]
    R --> S[Draw active progress marker]
    S --> T{Phase complete?}
    T -->|No| L
    T -->|Yes| U["session.advance()"]
    U --> V{More steps?}
    V -->|Yes| W[Update prompt + voice cue]
    W --> L
    V -->|No| X["finishSession()"]
    X --> Y[Show completion state]
    Y --> L

    AA[Start button] --> AB["start()"]
    AB --> AB0[Prepare audio during trusted Start gesture]
    AB0 --> AB1[Hide settings panels]
    AB1 --> AB2[Create session from workingProtocol]
    AB2 --> AB3[Set running + countdown flags]
    AB3 --> AB4[Show Stop and initial value 3]
    AB4 --> AB5[Keep Pause hidden and defer first cue]
    AB5 --> AB6["updateTimerExecutionMode()"]

    AC[Pause button / tap-to-toggle] --> AD["toggleSessionPause()"]
    AD --> AE{Paused?}
    AE -->|Yes| AF["resume()"]
    AE -->|No| AG["pause()"]
    AF --> AF1[Unpause, restore prompt, speak current phase]
    AG --> AG1[Pause, cancel voice, stop background timer]

    AH[Stop button] --> AI["stop()"]
    AI --> AI1[Cancel voice]
    AI1 --> AI2[Clear session]
    AI2 --> AI3[Restore idle controls]
    AI3 --> AI4[Reset display]

    AJ[Edit protocol] --> AK[Model update call]
    AK --> AL["afterProtocolEdit()"]
    AL --> AL1[Invalidate cached visual phases]
    AL1 --> AL2["protocolEditor.render if needed"]
    AL2 --> AL3["syncPracticeSummary()"]
    AL3 --> AL4["updateTotalTime()"]
    AL4 --> AL5["updateRemainingCycles()"]
    AL5 --> AL6["savePreferences()"]
    AL6 --> AL7[Update idle canvas]

    AM[Change language/theme/color/audio mode/volume] --> AL

    AN[Load preferences] --> AO["Storage.readJSON()"]
    AO --> AP[Restore protocol/theme/language/audio mode/volume/colors]
    AP --> AQ["Theme.applyPrimaryColor + swatch/canvas glue"]
    AQ --> AR["refreshPresetSelect()"]
    AR --> AS["syncPresetUi()"]
    AS --> AT["translatePage()"]

    U1[Window load] --> U2[Register sw.js]
```

## Start → tick → complete sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as script.js
    participant M as BreathingModel
    participant S as Session
    participant V as BreathingVoice
    participant C as Canvas/UI

    U->>UI: Click Start
    UI->>V: prepare() during trusted gesture
    UI->>M: createSession(workingProtocol)
    M-->>UI: Session
    UI->>UI: Set running + three-second countdown
    UI->>C: Show Ready and 3 → 2 → 1
    loop Until preparation reaches zero
        UI->>UI: Derive remaining value from performance timestamp
        UI->>C: Keep first step at zero progress
    end
    UI->>UI: Set first phase start timestamp
    UI->>UI: Show Pause control + first prompt
    UI->>S: currentStep()
    S-->>UI: First step
    UI->>V: speak(firstStep.type)
    UI->>UI: requestAnimationFrame(renderLoop)

    loop Each animation frame / timer tick
        UI->>S: currentStep()
        S-->>UI: Active step
        UI->>UI: processTimerAt(time)
        UI->>UI: update countdown / progress
        UI->>C: drawFrame(step, progress)
        alt Phase still running
            UI->>UI: continue loop
        else Phase complete
            UI->>S: advance()
            S-->>UI: next step or done
            alt More steps remain
                UI->>S: currentStep()
                S-->>UI: Next step
                UI->>UI: setGuidedPrompt(nextStep.textKey)
                UI->>V: speak(nextStep.type)
            else Session complete
                UI->>UI: finishSession()
                UI->>V: cancel()
                UI->>C: show completion state
            end
        end
    end
```
