const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function calendarParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function monthEnd(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0));
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  if (!isValidDateString(date)) throw new Error("invalid calendar date");
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return formatDate(value);
}

export function isValidDateString(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  return formatDate(new Date(`${value}T00:00:00.000Z`)) === value;
}

export function getLedgerPeriod(now: Date, startDay: number | null) {
  const current = calendarParts(now);
  let start: Date;
  let nextStart: Date;

  if (startDay === null) {
    const thisMonthEnd = monthEnd(current.year, current.month);
    start = current.day >= thisMonthEnd.getUTCDate()
      ? thisMonthEnd
      : monthEnd(current.year, current.month - 1);
    nextStart = monthEnd(start.getUTCFullYear(), start.getUTCMonth() + 2);
  } else {
    if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
      throw new Error("period start day must be between 1 and 28 or null");
    }
    start = current.day >= startDay
      ? utcDate(current.year, current.month, startDay)
      : utcDate(current.year, current.month - 1, startDay);
    nextStart = utcDate(start.getUTCFullYear(), start.getUTCMonth() + 2, startDay);
  }

  const end = new Date(nextStart);
  end.setUTCDate(end.getUTCDate() - 1);

  return {
    startOn: formatDate(start),
    endOn: formatDate(end),
    endExclusive: formatDate(nextStart),
  };
}
