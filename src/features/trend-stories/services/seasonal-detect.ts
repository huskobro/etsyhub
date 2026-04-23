import { SEASONAL_RULES } from "@/features/trend-stories/seasonal-keywords";

function inRange(
  today: Date,
  rule: { startMonth: number; startDay: number; endMonth: number; endDay: number }
): boolean {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const start = rule.startMonth * 100 + rule.startDay;
  const end = rule.endMonth * 100 + rule.endDay;
  const now = m * 100 + d;
  return start <= end ? now >= start && now <= end : now >= start || now <= end;
}

export function detectSeasonalTag(label: string, today: Date): string | null {
  const hay = label.toLowerCase();
  for (const rule of SEASONAL_RULES) {
    if (rule.keywords.some((kw) => hay.includes(kw)) && inRange(today, rule)) {
      return rule.tag;
    }
  }
  return null;
}
