export function countFridaysInMonth(year, month) {
  const date = new Date(year, month - 1, 1);
  let fridays = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 5) fridays++;
    date.setDate(date.getDate() + 1);
  }
  return fridays;
}
export function workDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return daysInMonth - countFridaysInMonth(year, month);
}
export function pad(n) {
  return String(n).padStart(2, "0");
}
export function formatDateYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
