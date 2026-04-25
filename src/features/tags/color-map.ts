export const TAG_COLOR_KEYS = [
  "accent",
  "success",
  "warning",
  "danger",
  "muted",
] as const;

export type TagColorKey = (typeof TAG_COLOR_KEYS)[number];

export function isTagColorKey(value: string): value is TagColorKey {
  return (TAG_COLOR_KEYS as readonly string[]).includes(value);
}

const COLOR_CLASSNAMES: Record<TagColorKey, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  muted: "bg-surface-muted text-text-muted",
};

export function tagColorClass(color: string | null | undefined): string {
  if (color && isTagColorKey(color)) return COLOR_CLASSNAMES[color];
  return COLOR_CLASSNAMES.muted;
}
