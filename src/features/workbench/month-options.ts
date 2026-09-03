export function buildMonthOptions(importedPeriods: string[], currentMonth: string): string[] {
  const periods = importedPeriods.filter((period) => /^\d{4}-\d{2}$/.test(period));
  const earliest = [...periods, currentMonth].sort()[0] ?? currentMonth;
  const [startYear, startMonth] = earliest.split("-").map(Number);
  const [endYear, endMonth] = currentMonth.split("-").map(Number);
  const start = startYear * 12 + startMonth - 1;
  const end = endYear * 12 + endMonth - 1;
  const first = Math.min(start, end);
  const last = Math.max(start, end);

  return Array.from({ length: last - first + 1 }, (_, index) => {
    const absoluteMonth = last - index;
    const year = Math.floor(absoluteMonth / 12);
    const month = String((absoluteMonth % 12) + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}
