# OpenSlot

OpenSlot is a small, read-only conversational availability assistant for MemoMind One smart glasses.

The first milestone proves the narrow loop:

```text
MemoMind Desktop Studio computer microphone
  -> gm.audio.openCapture()
  -> transcript adapter (temporary transcript input for local development)
  -> availability intent + date/time parser
  -> mock calendar
  -> gm.display.updateText() on the 600 x 350 glasses simulator
```

It intentionally does not browse calendars, create events, or provide a chatbot UI.

## SDK architecture

OpenSlot is a PhoneSDK Web Plugin. Its JavaScript runs in the MemoMind companion WebView/Studio host and talks to MemoMind through the official `gm` bridge.

- `gm.audio.openCapture()` owns the native audio capture path and exposes a real-time Opus `ReadableStream`.
- `gm.display.createPage()`, `gm.display.updateText()`, and `gm.display.closePage()` update the glasses HUD.
- Desktop Studio runs the Web plugin and can pair it with a GlassSDK `.gmp` plugin. The public SDK examples use a small glasses companion for the audio lab, but audio itself stays on the Host/Web binary stream.
- GlassSDK is the native C/RV32 plugin layer. OpenSlot does not duplicate that layer in the first milestone.

The official SDK is intentionally kept outside this repository. Build the static plugin with a local checkout of [MemoMind Plugin Open Platform](https://github.com/memomind-open/plugin-open-platform).

The SDK documentation used for this milestone was audited from upstream commit `5a1f34ae2430821e30ada9d46bda84acf8fa4fba`.

## Run the first milestone

Requirements:

- Windows 10/11 x64
- Node.js 18+
- Python launcher (`py`) if you want to build SDK examples
- A local checkout of the official MemoMind Plugin Open Platform

Build the `.mmpkg` from PowerShell:

```powershell
./scripts/build.ps1 -SdkRoot C:\path\to\plugin-open-platform
```

Then start Desktop Studio from the official SDK checkout:

```powershell
.\Studio\windows\gm-plugin-studio-desktop.exe
```

Use **Import package** and select `dist/openslot-0.1.0.mmpkg`. The plugin's developer panel has:

- **Start microphone capture** / **Stop microphone capture** to exercise `gm.audio.openCapture()`.
- Temporary transcript input and the four supported phrase buttons.
- A compact debug log for transcript, intent, date, time, availability, and HUD state.

The current parser supports:

- `Does Thursday work for you?`
- `Are you free Friday?`
- `Can you do Thursday at 3?`
- `How about tomorrow at 2?`

The mock calendar is relative to the local date at startup:

- Thursday 15:00-15:30 busy
- Friday free
- Tomorrow 14:00 free

The HUD auto-dismisses after a short timeout.

## Speech-to-text decision

The official SDK provides captured Opus audio, not speech recognition. The first milestone therefore keeps STT behind a small adapter and uses a temporary transcript control so SDK/audio/HUD work can be tested without silently adding a paid service.

Realistic next options are:

1. a local Whisper-compatible service that accepts the captured Opus stream;
2. a vendored/local decoder plus an on-device Whisper model; or
3. a hosted STT API, only after choosing a provider and handling its key, cost, latency, and privacy implications.

The production path should replace only the transcript adapter, not the intent parser, mock calendar boundary, or HUD renderer.

## Verified vs assumed

### VERIFIED

- The official platform is split into `GlassSDK`, `PhoneSDK`, and prebuilt `Studio` applications.
- Desktop Studio's official Audio Capture Lab uses the computer microphone as the simulated glasses microphone source.
- `gm.audio.openCapture()` exposes a binary Opus stream; capture is mono, 16 kHz, with 20 ms frames.
- The current display profile is 600 x 350, GRAY_4, at 30 Hz.
- `gm.display.updateText()` updates a display element and `gm.display.closePage()` clears the page.
- The project builds as an official `.mmpkg` using the public PhoneSDK packager.
- Native audio and the minimal HUD are wired in the OpenSlot plugin code; simulator execution still needs a local Desktop Studio run.

### ASSUMED / NOT YET TESTED

- Physical MemoMind One microphone pickup quality and latency.
- Physical glasses Bluetooth behavior and audio contention with other apps.
- Real-world conversation intent precision beyond the small supported phrase set.
- A production STT provider, model, or local decoder.
- Whether the target Desktop Studio build exposes the same audio capability on every machine/runtime version.
- OpenSlot's `.mmpkg` runtime execution in Desktop Studio on this host; the binary starts, but its window was not exposed to the current UI automation surface for an end-to-end smoke test.

## Project layout

```text
plugin/                 Static official PhoneSDK Web Plugin
  index.html            Developer test surface, not a chatbot UI
  plugin.js             SDK lifecycle, capture, transcript flow, HUD
  openslot-core.js      Pure intent/date/time/availability logic
  mock-calendar.js      Deterministic relative mock calendar
  manifest.json         Bridge 2.0 permissions
  vendor/               Official vendored Web SDK bundle
scripts/build.ps1       Builds the `.mmpkg` with an external SDK checkout
tests/                  Node tests for deterministic product logic
dist/                   Generated packages (ignored by git)
```

## Source references

- [Official Plugin Open Platform](https://github.com/memomind-open/plugin-open-platform)
- [PhoneSDK audio-capture-lab](https://github.com/memomind-open/plugin-open-platform/tree/main/PhoneSDK/examples/audio-capture-lab)
- [PhoneSDK talking-pet](https://github.com/memomind-open/plugin-open-platform/tree/main/PhoneSDK/examples/talking-pet)
- [PhoneSDK Web Plugin API reference](https://github.com/memomind-open/plugin-open-platform/blob/main/PhoneSDK/docs/web-plugin/api-reference.md)
- [Desktop Studio guide](https://github.com/memomind-open/plugin-open-platform/blob/main/Studio/README.md)
