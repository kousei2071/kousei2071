"use strict";

const fs = require("fs");
const path = require("path");

/** エンジニア歴の起算日（YYYY-MM-DD） */
const START_DATE = "2025-04-01";
const TIME_ZONE = "Asia/Tokyo";
const START_MARKER = "<!--ENGINEER_CAREER_START-->";
const END_MARKER = "<!--ENGINEER_CAREER_END-->";

/**
 * @typedef {{ year: number, month: number, day: number }} CalendarDate
 */

/**
 * @param {string} isoDate
 * @returns {CalendarDate}
 */
function parseISODate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`開始日は YYYY-MM-DD 形式で指定してください: ${isoDate}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!isValidCalendarDate(year, month, day)) {
    throw new Error(`存在しない日付です: ${isoDate}`);
  }

  return { year, month, day };
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {boolean}
 */
function isValidCalendarDate(year, month, day) {
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/**
 * @param {string} timeZone
 * @param {Date} [now]
 * @returns {CalendarDate}
 */
function todayInTimeZone(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

/**
 * @param {CalendarDate} date
 * @returns {number}
 */
function toOrdinal(date) {
  return date.year * 10000 + date.month * 100 + date.day;
}

/**
 * @param {CalendarDate} date
 * @param {number} monthsToAdd
 * @returns {CalendarDate}
 */
function addMonths(date, monthsToAdd) {
  const total = date.year * 12 + (date.month - 1) + monthsToAdd;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return {
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month)),
  };
}

/**
 * @param {CalendarDate} start
 * @param {CalendarDate} end
 * @returns {number}
 */
function daysBetween(start, end) {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / 86400000);
}

/**
 * 実暦に基づく年・月・日の差分。
 * 存在しない日（1/31 + 1ヶ月など）は月末に丸める。
 * @param {CalendarDate} start
 * @param {CalendarDate} end
 * @returns {{ years: number, months: number, days: number }}
 */
function diffCalendar(start, end) {
  if (toOrdinal(end) < toOrdinal(start)) {
    throw new Error(
      `開始日が未来です: ${formatISODate(start)} > ${formatISODate(end)}`
    );
  }

  let years = end.year - start.year;
  let afterYears = addMonths(start, years * 12);
  if (toOrdinal(afterYears) > toOrdinal(end)) {
    years -= 1;
    afterYears = addMonths(start, years * 12);
  }

  let months = (end.year - afterYears.year) * 12 + (end.month - afterYears.month);
  let afterMonths = addMonths(afterYears, months);
  if (toOrdinal(afterMonths) > toOrdinal(end)) {
    months -= 1;
    afterMonths = addMonths(afterYears, months);
  }

  return {
    years,
    months,
    days: daysBetween(afterMonths, end),
  };
}

/**
 * @param {CalendarDate} date
 * @returns {string}
 */
function formatISODate(date) {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/**
 * @param {CalendarDate} date
 * @returns {string}
 */
function formatSlashDate(date) {
  return `${String(date.year).padStart(4, "0")}/${String(date.month).padStart(2, "0")}/${String(date.day).padStart(2, "0")}`;
}

/**
 * @param {CalendarDate} start
 * @param {{ years: number, months: number, days: number }} duration
 * @returns {string}
 */
function formatCareerText(start, duration) {
  return `エンジニア歴: ${duration.years}年${duration.months}ヶ月${duration.days}日（${formatSlashDate(start)} 開始）`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {{ years: number, months: number, days: number }} duration
 * @returns {number}
 */
function totalYears(duration) {
  return duration.years + duration.months / 12 + duration.days / 365;
}

/**
 * @param {CalendarDate} start
 * @param {{ years: number, months: number, days: number }} duration
 * @returns {string}
 */
function renderCareerSvg(start, duration) {
  const label = formatCareerText(start, duration);
  const years = totalYears(duration);
  const yearFraction = Math.min(1, (duration.months + duration.days / 30.4375) / 12);
  const circumference = 2 * Math.PI * 28;
  const dash = (yearFraction * circumference).toFixed(2);
  const gap = circumference.toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="160" viewBox="0 0 495 160" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
  </defs>

  <rect width="495" height="160" rx="12" fill="url(#bg)"/>
  <rect x="0" y="0" width="495" height="4" rx="2" fill="url(#accent)"/>

  <text x="24" y="36" fill="#94A3B8" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13">Career / エンジニア歴</text>
  <text x="24" y="56" fill="#64748B" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="11">${escapeXml(formatSlashDate(start))} 開始</text>

  <text x="70" y="112" text-anchor="middle" fill="#F8FAFC" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="36" font-weight="700">${duration.years}</text>
  <text x="70" y="136" text-anchor="middle" fill="#38BDF8" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13">年</text>

  <text x="198" y="112" text-anchor="middle" fill="#F8FAFC" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="36" font-weight="700">${duration.months}</text>
  <text x="198" y="136" text-anchor="middle" fill="#818CF8" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13">ヶ月</text>

  <text x="326" y="112" text-anchor="middle" fill="#F8FAFC" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="36" font-weight="700">${duration.days}</text>
  <text x="326" y="136" text-anchor="middle" fill="#A78BFA" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13">日</text>

  <circle cx="430" cy="92" r="28" fill="none" stroke="#334155" stroke-width="6"/>
  <circle cx="430" cy="92" r="28" fill="none" stroke="url(#accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${gap}" transform="rotate(-90 430 92)"/>
  <text x="430" y="97" text-anchor="middle" fill="#E2E8F0" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="12">${years.toFixed(1)}y</text>
</svg>
`;
}

/**
 * @param {CalendarDate} today
 * @param {string} alt
 * @returns {string}
 */
function formatCareerImage(today, alt) {
  return `<img src="./career.svg?d=${formatISODate(today)}" alt="${escapeXml(alt)}" />`;
}

/**
 * @param {string} readme
 * @param {string} text
 * @returns {string}
 */
function replaceCareerSection(readme, text) {
  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(
      `README に ${START_MARKER} / ${END_MARKER} が見つかりません`
    );
  }

  if (endIndex < startIndex) {
    throw new Error("README のマーカー順が逆です");
  }

  const before = readme.slice(0, startIndex + START_MARKER.length);
  const after = readme.slice(endIndex);
  return `${before}\n${text}\n${after}`;
}

function main() {
  const start = parseISODate(START_DATE);
  const today = todayInTimeZone(TIME_ZONE);
  const duration = diffCalendar(start, today);
  const text = formatCareerText(start, duration);
  const image = formatCareerImage(today, text);
  const svg = renderCareerSvg(start, duration);

  const readmePath = path.join(__dirname, "README.md");
  const svgPath = path.join(__dirname, "career.svg");
  const readme = fs.readFileSync(readmePath, "utf8");
  const updated = replaceCareerSection(readme, image);

  fs.writeFileSync(readmePath, updated);
  fs.writeFileSync(svgPath, svg);
  console.log(`updated: ${text}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  START_DATE,
  parseISODate,
  todayInTimeZone,
  diffCalendar,
  formatCareerText,
  formatCareerImage,
  renderCareerSvg,
  replaceCareerSection,
};
