import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHudLines,
  checkAvailability,
  dateKey,
  parseAvailabilityQuestion,
} from '../plugin/openslot-core.js';
import { createMockCalendar } from '../plugin/mock-calendar.js';

const referenceDate = new Date(2026, 8, 21);
const calendar = createMockCalendar(referenceDate);

test('detects Thursday availability question without a time', () => {
  const parsed = parseAvailabilityQuestion('Does Thursday work for you?', { referenceDate });
  assert.equal(parsed.supported, true);
  assert.equal(parsed.date.label, 'THU 24 SEP');
  assert.equal(parsed.time.minutes, null);
  assert.deepEqual(buildHudLines(parsed, checkAvailability(calendar, parsed)), ['THU 24 SEP', 'PARTLY BUSY']);
});

test('returns Friday free for a no-time question', () => {
  const parsed = parseAvailabilityQuestion('Are you free Friday?', { referenceDate });
  const availability = checkAvailability(calendar, parsed);
  assert.equal(parsed.supported, true);
  assert.equal(availability.state, 'free');
  assert.deepEqual(buildHudLines(parsed, availability), ['FRI 25 SEP', 'FREE']);
});

test('assumes afternoon for a bare spoken hour in the supported demo phrases', () => {
  const parsed = parseAvailabilityQuestion('Can you do Thursday at 3?', { referenceDate });
  const availability = checkAvailability(calendar, parsed);
  assert.equal(parsed.time.minutes, 15 * 60);
  assert.equal(availability.state, 'busy');
  assert.deepEqual(buildHudLines(parsed, availability), ['THU 24 SEP', '15:00', 'BUSY UNTIL 15:30']);
});

test('matches a free timed slot tomorrow', () => {
  const parsed = parseAvailabilityQuestion('How about tomorrow at 2?', { referenceDate });
  const availability = checkAvailability(calendar, parsed);
  assert.equal(parsed.date.key, dateKey(new Date(2026, 8, 22)));
  assert.equal(availability.state, 'free');
  assert.deepEqual(buildHudLines(parsed, availability), ['TUE 22 SEP', '14:00', 'FREE']);
});

test('does not react to a casual date mention', () => {
  const parsed = parseAvailabilityQuestion('Thursday was a good day.', { referenceDate });
  assert.equal(parsed.intent.detected, false);
  assert.equal(parsed.supported, false);
});
