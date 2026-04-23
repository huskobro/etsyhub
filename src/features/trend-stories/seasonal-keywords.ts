/**
 * Mevsimsel trend kuralları.
 *
 * Her kural tarih aralığında aktif olan anahtar kelimeleri tanımlar.
 * Trend tarama motorunu ürün bulgusu sırasında filtrelemeye yardımcı olur.
 */

export type SeasonalRule = {
  tag: string;
  keywords: string[];
  startMonth: number; // 1-12
  startDay: number; // 1-31
  endMonth: number; // 1-12
  endDay: number; // 1-31
};

export const SEASONAL_RULES: SeasonalRule[] = [
  {
    tag: "christmas",
    keywords: ["christmas", "xmas", "santa", "holiday", "winter"],
    startMonth: 10,
    startDay: 15,
    endMonth: 12,
    endDay: 31,
  },
  {
    tag: "halloween",
    keywords: ["halloween", "spooky", "pumpkin", "ghost"],
    startMonth: 9,
    startDay: 1,
    endMonth: 10,
    endDay: 31,
  },
  {
    tag: "valentines",
    keywords: ["valentine", "valentines", "love", "heart"],
    startMonth: 1,
    startDay: 15,
    endMonth: 2,
    endDay: 14,
  },
  {
    tag: "mothers_day",
    keywords: ["mothers day", "mom", "mama"],
    startMonth: 4,
    startDay: 1,
    endMonth: 5,
    endDay: 15,
  },
  {
    tag: "fathers_day",
    keywords: ["fathers day", "dad", "papa"],
    startMonth: 5,
    startDay: 15,
    endMonth: 6,
    endDay: 20,
  },
  {
    tag: "thanksgiving",
    keywords: ["thanksgiving", "turkey", "fall", "autumn"],
    startMonth: 10,
    startDay: 15,
    endMonth: 11,
    endDay: 30,
  },
  {
    tag: "easter",
    keywords: ["easter", "bunny", "spring"],
    startMonth: 3,
    startDay: 1,
    endMonth: 4,
    endDay: 20,
  },
  {
    tag: "back_to_school",
    keywords: ["back to school", "teacher", "classroom"],
    startMonth: 7,
    startDay: 15,
    endMonth: 9,
    endDay: 15,
  },
];
