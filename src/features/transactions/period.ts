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
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && formatDate(parsed) === value;
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

export type LedgerPeriod = {
  key: string;
  startOn: string;
  endOn: string;
  endExclusive: string;
};

export function getLedgerPeriodFromStart(
  startOn: string,
  startDay: number | null,
): LedgerPeriod | null {
  if (!isValidDateString(startOn)) return null;
  const start = new Date(`${startOn}T00:00:00.000Z`);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  let nextStart: Date;

  if (startDay === null) {
    if (start.getUTCDate() !== monthEnd(year, month).getUTCDate()) return null;
    nextStart = monthEnd(year, month + 1);
  } else {
    if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) return null;
    if (start.getUTCDate() !== startDay) return null;
    nextStart = utcDate(year, month + 1, startDay);
  }

  const end = new Date(nextStart);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    key: startOn,
    startOn,
    endOn: formatDate(end),
    endExclusive: formatDate(nextStart),
  };
}

function previousPeriodStart(startOn: string, startDay: number | null) {
  const current = new Date(`${startOn}T00:00:00.000Z`);
  if (startDay === null) {
    return formatDate(monthEnd(current.getUTCFullYear(), current.getUTCMonth()));
  }
  return formatDate(new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth() - 1,
    startDay,
  )));
}

export function listLedgerPeriods(
  now: Date,
  startDay: number | null,
  count: number,
): LedgerPeriod[] {
  if (!Number.isInteger(count) || count < 1 || count > 120) {
    throw new Error("period count must be between 1 and 120");
  }
  const current = getLedgerPeriod(now, startDay);
  const periods: LedgerPeriod[] = [];
  let startOn = current.startOn;

  for (let index = 0; index < count; index += 1) {
    const period = getLedgerPeriodFromStart(startOn, startDay);
    if (!period) throw new Error("failed to derive ledger period");
    periods.push(period);
    startOn = previousPeriodStart(startOn, startDay);
  }
  return periods;
}
