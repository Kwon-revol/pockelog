export function statisticsDetailPath(periodKey: string, type: string | undefined) {
  const base = `/statistics/${periodKey}`;
  return type === "income" ? `${base}?type=income` : base;
}
