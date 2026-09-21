import { addDays, dateForWeekday, dateKey } from './openslot-core.js';

export function createMockCalendar(referenceDate = new Date()) {
  const thursday = dateForWeekday(referenceDate, 4);
  return [
    {
      date: dateKey(thursday),
      startMinutes: 15 * 60,
      endMinutes: 15 * 60 + 30,
      label: 'Mock Thursday event',
    },
    // Friday intentionally has no event: it is the completely free test case.
    // Tomorrow intentionally has no event at 14:00: it is the free timed test case.
    { date: dateKey(addDays(referenceDate, 1)), startMinutes: 16 * 60, endMinutes: 16 * 60 + 30, label: 'Mock tomorrow later event' },
  ];
}
