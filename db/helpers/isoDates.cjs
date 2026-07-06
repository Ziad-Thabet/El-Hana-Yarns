const { formatDateYMD } = require("../../shared/dateRules.cjs");
function toAsciiDigits(value) {
  return String(value)
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (char) => {
      const code = char.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .trim();
}
function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function isIsoTime(value) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}
function normalizeIsoDate(value) {
  if (!value) return null;
  const raw = toAsciiDigits(String(value).replace(/[\u200E\u200F]/g, ""));
  if (isIsoDate(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const ymd = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}
function normalizeIsoTime(value) {
  if (!value) return null;
  let raw = toAsciiDigits(value)
    .replace(/\u200F/g, "")
    .trim();
  if (isIsoTime(raw)) return raw.length === 5 ? `${raw}:00` : raw;
  const timeMatch = raw.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm]|ص|م)$/i,
  );
  if (timeMatch) {
    let [, hour, minute, second = "00", meridiem] = timeMatch;
    hour = Number(hour);
    minute = Number(minute);
    second = Number(second);
    const isPM = /[مMpP]/.test(meridiem);
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  }
  const arabicMatch = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([صم]))$/i);
  if (arabicMatch) {
    let [, hour, minute, meridiem] = arabicMatch;
    hour = Number(hour);
    minute = Number(minute);
    const isPM = /[م]/i.test(meridiem);
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  }
  return null;
}
function formatIsoDate(date) {
  return formatDateYMD(date);
}
function formatIsoTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}
function nowDateTime() {
  const now = new Date();
  return {
    date: formatIsoDate(now),
    time: formatIsoTime(now),
  };
}
function addDaysToIsoDate(isoDate, amount) {
  const parsed = normalizeIsoDate(isoDate);
  if (!parsed) return null;
  const date = new Date(`${parsed}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return formatIsoDate(date);
}
module.exports = {
  toAsciiDigits,
  isIsoDate,
  isIsoTime,
  normalizeIsoDate,
  normalizeIsoTime,
  formatIsoDate,
  formatIsoTime,
  nowDateTime,
  addDaysToIsoDate,
};
