const WEEKDAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const WEEKDAY_SHORT_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_SHORT_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function dateForWeekday(referenceDate, weekday) {
  const reference = startOfDay(referenceDate);
  const difference = (weekday - reference.getDay() + 7) % 7;
  return addDays(reference, difference);
}

export function formatDateLabel(date) {
  return `${WEEKDAY_SHORT_NAMES[date.getDay()]} ${String(date.getDate()).padStart(2, '0')} ${MONTH_SHORT_NAMES[date.getMonth()]}`;
}

export function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function normalizeTranscript(transcript) {
  return String(transcript ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9: ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectAvailabilityIntent(transcript) {
  const normalized = normalizeTranscript(transcript);
  const patterns = [
    { type: 'does-work', pattern: /\b(?:does|would)\b.*\b(?:work for you|suit you)\b/ },
    { type: 'free-check', pattern: /\b(?:are you|will you be)\b.*\b(?:free|available)\b/ },
    { type: 'can-do', pattern: /\b(?:can|could) you\b.*\b(?:do|make)\b/ },
    { type: 'how-about', pattern: /\bhow about\b/ },
  ];
  const match = patterns.find(({ pattern }) => pattern.test(normalized));
  return match
    ? { detected: true, type: match.type, confidence: 0.96 }
    : { detected: false, type: null, confidence: 0 };
}

function extractDate(transcript, referenceDate) {
  const normalized = normalizeTranscript(transcript);
  if (/\btomorrow\b/.test(normalized)) return addDays(referenceDate, 1);
  if (/\btoday\b/.test(normalized)) return startOfDay(referenceDate);
  const weekday = WEEKDAY_NAMES.findIndex((name) => new RegExp(`\\b${name.toLowerCase()}\\b`).test(normalized));
  return weekday >= 0 ? dateForWeekday(referenceDate, weekday) : null;
}

function extractTime(transcript) {
  const normalized = normalizeTranscript(transcript);
  if (/\bnoon\b/.test(normalized)) return { minutes: 12 * 60, source: 'noon' };
  const timeMatch = normalized.match(/\b(?:at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] ?? 0);
    const meridiem = timeMatch[3];
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (!meridiem && hour >= 1 && hour <= 7) hour += 12;
    if (hour <= 23 && minute <= 59) return { minutes: hour * 60 + minute, source: meridiem ?? '24-hour-assumed' };
  }
  if (/\bafternoon\b/.test(normalized)) return { minutes: null, window: 'afternoon', source: 'window' };
  return { minutes: null, window: null, source: null };
}

export function parseAvailabilityQuestion(transcript, { referenceDate = new Date() } = {}) {
  const intent = detectAvailabilityIntent(transcript);
  const date = extractDate(transcript, referenceDate);
  const time = extractTime(transcript);
  return {
    transcript: String(transcript ?? '').trim(),
    normalized: normalizeTranscript(transcript),
    intent,
    date: date ? { key: dateKey(date), label: formatDateLabel(date), date } : null,
    time,
    supported: intent.detected && Boolean(date),
  };
}

export function checkAvailability(calendar, { date, time, durationMinutes = 30 }) {
  const events = calendar.filter((event) => event.date === date.key);
  if (time.minutes == null) {
    return events.length === 0
      ? { state: 'free', hud: 'FREE', events }
      : { state: 'partial', hud: 'PARTLY BUSY', events };
  }
  const requestedEnd = time.minutes + durationMinutes;
  const conflicts = events.filter((event) => event.startMinutes < requestedEnd && event.endMinutes > time.minutes);
  if (conflicts.length === 0) return { state: 'free', hud: 'FREE', events };
  const busyUntil = Math.max(...conflicts.map((event) => event.endMinutes));
  return { state: 'busy', hud: `BUSY UNTIL ${formatTime(busyUntil)}`, busyUntil, events, conflicts };
}

export function buildHudLines(parsed, availability) {
  const lines = [parsed.date.label];
  if (parsed.time.minutes != null) lines.push(formatTime(parsed.time.minutes));
  lines.push(availability.hud);
  return lines;
}
