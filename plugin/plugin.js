import { createGMPlugin } from './vendor/gm-plugin-web-sdk.esm.js';
import {
  buildHudLines,
  checkAvailability,
  parseAvailabilityQuestion,
} from './openslot-core.js';
import { createMockCalendar } from './mock-calendar.js';
import { temporaryTranscript } from './transcription.js';

const gm = createGMPlugin();
const ui = {
  runtimeStatus: document.querySelector('#runtime-status'),
  audioState: document.querySelector('#audio-state'),
  hudState: document.querySelector('#hud-state'),
  hudPreview: document.querySelector('#hud-preview'),
  debugLog: document.querySelector('#debug-log'),
  transcriptInput: document.querySelector('#transcript-input'),
  startCapture: document.querySelector('#start-capture'),
  stopCapture: document.querySelector('#stop-capture'),
  chunkCount: document.querySelector('#chunk-count'),
  frameCount: document.querySelector('#frame-count'),
  byteCount: document.querySelector('#byte-count'),
};

const referenceDate = new Date();
const calendar = createMockCalendar(referenceDate);
let pageCreated = false;
let hudTimer;
let currentCapture;
let captureConsumer;
let captureGeneration = 0;
let audioStats = { chunkCount: 0, frameCount: 0, byteCount: 0 };

function json(value) {
  return JSON.stringify(value, (_key, nested) => nested instanceof Uint8Array ? `<Uint8Array ${nested.byteLength} bytes>` : nested);
}

function log(event, payload = {}) {
  const line = `${new Date().toLocaleTimeString([], { hour12: false })}  [${event}] ${typeof payload === 'string' ? payload : json(payload)}`;
  console.info(`[OpenSlot] ${event}`, payload);
  ui.debugLog.textContent = `${line}\n${ui.debugLog.textContent}`.slice(0, 12000);
}

function setStatus(element, text, state = '') {
  element.textContent = text;
  if (state) element.dataset.state = state;
}

function renderStats() {
  ui.chunkCount.textContent = String(audioStats.chunkCount);
  ui.frameCount.textContent = String(audioStats.frameCount);
  ui.byteCount.textContent = String(audioStats.byteCount);
}

async function ensureDisplayPage() {
  if (!pageCreated) {
    await gm.display.createPage();
    pageCreated = true;
  }
}

async function renderHud(lines) {
  const text = lines.join('\n');
  ui.hudPreview.textContent = text;
  setStatus(ui.hudState, 'Visible', 'active');
  log('hud', { state: 'visible', text });
  try {
    await ensureDisplayPage();
    await gm.display.updateText({
      id: 1,
      x: 48,
      y: 54,
      width: 504,
      height: 240,
      border: 0,
      radius: 0,
      text,
    });
  } catch (error) {
    log('hud.error', { code: error?.code, message: error?.message });
    setStatus(ui.hudState, 'HUD error', 'error');
    return;
  }
  window.clearTimeout(hudTimer);
  hudTimer = window.setTimeout(async () => {
    try {
      if (pageCreated) await gm.display.closePage();
      pageCreated = false;
      ui.hudPreview.textContent = 'Waiting for an availability question…';
      setStatus(ui.hudState, 'Dismissed');
      log('hud', { state: 'dismissed', reason: 'timeout' });
    } catch (error) {
      log('hud.dismiss.error', { code: error?.code, message: error?.message });
    }
  }, 4500);
}

async function processTranscript(value, source = 'temporary-input') {
  const transcript = temporaryTranscript(value);
  log('transcript', { text: transcript.text, source });
  if (transcript.isEmpty) return;

  const parsed = parseAvailabilityQuestion(transcript.text, { referenceDate });
  log('intent', parsed.intent);
  log('date', parsed.date ? { key: parsed.date.key, label: parsed.date.label } : { value: null });
  log('time', parsed.time);

  if (!parsed.intent.detected) {
    log('availability', { state: 'ignored', reason: 'no availability intent' });
    return;
  }
  if (!parsed.date) {
    log('availability', { state: 'ignored', reason: 'date not supported' });
    return;
  }
  const availability = checkAvailability(calendar, parsed);
  log('availability', { state: availability.state, hud: availability.hud, conflicts: availability.conflicts ?? [] });
  await renderHud(buildHudLines(parsed, availability));
}

async function consumeCapture(session, generation) {
  try {
    for await (const chunk of session.stream) {
      if (generation !== captureGeneration) break;
      audioStats.chunkCount += 1;
      audioStats.frameCount += chunk.frameCount;
      audioStats.byteCount += chunk.data.byteLength;
      renderStats();
      if (audioStats.chunkCount === 1 || audioStats.chunkCount % 25 === 0) {
        log('audio.chunk', {
          sequence: chunk.sequence,
          frameCount: chunk.frameCount,
          bytes: chunk.data.byteLength,
          droppedFrameCount: chunk.droppedFrameCount,
          discontinuity: chunk.discontinuity,
        });
      }
    }
    log('audio.stream.end', { ...audioStats });
  } catch (error) {
    log('audio.stream.error', { code: error?.code, message: error?.message });
    setStatus(ui.audioState, 'Capture error', 'error');
  }
}

async function startCapture() {
  if (currentCapture) return;
  audioStats = { chunkCount: 0, frameCount: 0, byteCount: 0 };
  renderStats();
  setStatus(ui.audioState, 'Opening…');
  log('audio.open.request', { profile: 'interactive', pickupMode: 'frontFocus', noiseReduction: true });
  try {
    currentCapture = await gm.audio.openCapture({
      profile: 'interactive',
      pickupMode: 'frontFocus',
      noiseReduction: true,
      maxDurationMs: 15000,
    });
    const generation = captureGeneration;
    captureConsumer = consumeCapture(currentCapture, generation);
    setStatus(ui.audioState, 'Capturing', 'active');
    ui.startCapture.disabled = true;
    ui.stopCapture.disabled = false;
    log('audio.opened', { sessionId: currentCapture.sessionId, resolvedOptions: currentCapture.resolvedOptions });
  } catch (error) {
    currentCapture = undefined;
    setStatus(ui.audioState, 'Unavailable', 'error');
    log('audio.open.error', { code: error?.code, message: error?.message });
  }
}

async function stopCapture() {
  const session = currentCapture;
  if (!session) return;
  setStatus(ui.audioState, 'Stopping…');
  log('audio.stop.request', { sessionId: session.sessionId });
  try {
    const result = await session.stop();
    await captureConsumer;
    captureGeneration += 1;
    log('audio.stopped', result);
    setStatus(ui.audioState, 'Captured');
  } catch (error) {
    log('audio.stop.error', { code: error?.code, message: error?.message });
    setStatus(ui.audioState, 'Stop error', 'error');
  } finally {
    currentCapture = undefined;
    captureConsumer = undefined;
    ui.startCapture.disabled = false;
    ui.stopCapture.disabled = true;
  }
}

async function initialize() {
  try {
    await gm.ready();
    const capabilities = await gm.runtime.getCapabilities();
    log('runtime.ready', { bridge: await gm.runtime.getBridgeVersion(), capabilities });
    setStatus(ui.runtimeStatus, 'Runtime ready', 'ready');
    if (capabilities?.audio) {
      log('audio.capability', capabilities.audio);
    } else {
      log('audio.capability', 'No native audio capability reported by this host. Browser Studio cannot simulate native glasses audio.');
      setStatus(ui.audioState, 'Host audio unavailable');
    }
  } catch (error) {
    setStatus(ui.runtimeStatus, 'Runtime error', 'error');
    log('runtime.error', { code: error?.code, message: error?.message });
  }
}

document.querySelector('#transcript-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await processTranscript(ui.transcriptInput.value);
});

document.querySelectorAll('[data-transcript]').forEach((button) => {
  button.addEventListener('click', async () => {
    ui.transcriptInput.value = button.dataset.transcript;
    await processTranscript(button.dataset.transcript, 'supported-test-phrase');
  });
});

ui.startCapture.addEventListener('click', startCapture);
ui.stopCapture.addEventListener('click', stopCapture);
document.querySelector('#clear-log').addEventListener('click', () => { ui.debugLog.textContent = ''; });
window.addEventListener('pagehide', () => { void currentCapture?.stop?.(); });

void initialize();
