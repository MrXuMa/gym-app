/** Shared calendar helpers — Eastern aligns with app nutrition_logs.log_date. */

const EASTERN_TIME_ZONE = 'America/New_York';

function dayKeyEastern(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function localDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date) {
  const s = new Date(date);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function daysAgo(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

module.exports = { dayKeyEastern, localDateKey, startOfWeek, daysAgo, EASTERN_TIME_ZONE };
