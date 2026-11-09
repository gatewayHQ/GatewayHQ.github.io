// app/social/format.js
// Pure text formatters shared by the Graphics templates and the form controller.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-10-04' -> 'Sunday Oct 04'. Parsed as a local calendar date (no TZ shift).
export function formatEventDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return String(iso || '').trim();
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${m[3]}`;
}

// ('12:30', '13:30') -> '12:30-1:30pm'; ('11:00', '13:00') -> '11am-1pm'.
// Whole hours drop ':00'. A shared am/pm is written once, at the end.
export function formatTimeRange(start, end) {
  const s = parseTime(start), e = parseTime(end);
  if (!s && !e) return '';
  if (s && !e) return s.text + s.ap;
  if (!s && e) return e.text + e.ap;
  return s.ap === e.ap ? `${s.text}-${e.text}${e.ap}` : `${s.text}${s.ap}-${e.text}${e.ap}`;
}

function parseTime(v) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim());
  if (!m) return null;
  const h24 = +m[1], min = m[2];
  const ap = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 || 12;
  return { text: min === '00' ? String(h12) : `${h12}:${min}`, ap };
}

// Lower-case, hyphenated slug for file names: '1119 S Linn St' -> '1119-s-linn-st'.
export function slugify(s, fallback = 'graphic') {
  const out = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return out || fallback;
}
