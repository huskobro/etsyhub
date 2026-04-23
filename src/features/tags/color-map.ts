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
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  muted: "bg-surface-muted text-text-muted",
};

export function tagColorClass(color: string | null | undefined): string {
  if (color && isTagColorKey(color)) return COLOR_CLASSNAMES[color];
  return COLOR_CLASSNAMES.muted;
}
