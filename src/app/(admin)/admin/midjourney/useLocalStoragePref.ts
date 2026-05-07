"use client";

// Pass 64 — Reusable localStorage state hook (admin/midjourney scope).
//
// Pattern:
//   const [format, setFormat] = useLocalStoragePref("mj-default-export-format", "png");
//
// SSR uyumlu (initial value props'tan; mount sonrası localStorage okunur).
// Cross-tab sync için 'storage' event dinler.

import { useEffect, useState } from "react";

export function useLocalStoragePref<T extends string>(
  key: string,
  defaultValue: T,
  validate?: (raw: string) => raw is T,
): readonly [T, (value: T) => void] {
  const storageKey = `mj-pref:${key}`;
  const [value, setValueState] = useState<T>(defaultValue);

  // Mount sonrası localStorage'ı oku.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) {
        if (validate) {
          if (validate(raw)) setValueState(raw);
        } else {
          setValueState(raw as T);
        }
      }
    } catch {
      // localStorage erişilemez (private mode vs)
    }
    // Cross-tab sync.
    const handler = (e: StorageEvent) => {
      if (e.key !== storageKey || e.newValue === null) return;
      if (validate) {
        if (validate(e.newValue)) setValueState(e.newValue);
      } else {
        setValueState(e.newValue as T);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setValue(next: T) {
    setValueState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // ignore
    }
  }

  return [value, setValue] as const;
}

// Common types
export type ExportFormatPref = "png" | "jpeg" | "webp";
export const EXPORT_FORMAT_VALUES: ExportFormatPref[] = ["png", "jpeg", "webp"];
export function isExportFormat(raw: string): raw is ExportFormatPref {
  return (EXPORT_FORMAT_VALUES as string[]).includes(raw);
}
