/**
 * İngilizce stop-words seti.
 *
 * Trend taraması sırasında başlık/açıklamadaki bu kelimeler
 * anahtar terim bulgusu için filtrelenir. Signature'ı temiz tutmak için.
 */

export const STOP_WORDS = new Set<string>([
  // Artikel
  "a",
  "an",
  "the",

  // Bağlaç
  "and",
  "or",
  "for",
  "with",
  "of",
  "in",
  "on",
  "to",
  "by",
  "from",
  "at",
  "as",

  // İyelik zamiri
  "your",
  "you",
  "my",
  "our",
  "their",
  "his",
  "her",
  "its",

  // Fiil (to be)
  "is",
  "are",
  "was",
  "be",
  "been",
  "being",

  // Demonstratif
  "this",
  "that",
  "these",
  "those",

  // Pazarlama gürültüsü
  "gift",
  "gifts",
  "idea",
  "ideas",
  "set",
  "sets",
  "pack",
  "bundle",
  "instant",

  // Format tokenları (görsel signature'da noise)
  "svg",
  "png",
  "jpg",
]);
