import { STOP_WORDS } from "@/features/trend-stories/stop-words";

function baseTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeForSimilarity(input: string): string[] {
  return baseTokens(input).filter((t) => !STOP_WORDS.has(t));
}

export function normalizeForProductType(input: string): string[] {
  return baseTokens(input);
}
