export function temporaryTranscript(value) {
  const text = String(value ?? '').trim();
  return {
    text,
    source: 'temporary-input',
    isEmpty: text.length === 0,
  };
}
