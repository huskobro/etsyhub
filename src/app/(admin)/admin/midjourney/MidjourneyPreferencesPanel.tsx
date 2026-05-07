"use client";

// Pass 70 — MJ tercihleri tek panel.
//
// AutoSail audit'inden ilham: eklenti 100+ ayarı tek `TAMPER_MIDJOURNEY
// _STORAGE_SETTINGS` localStorage key'inde tutuyor. Bizim için yetkili
// admin ortamında ürün-doğru karşılığı: typed registry (preferences.ts)
// + tek panel UI. Kullanıcı tüm MJ tercihlerini tek yerden yönetir.
//
// Admin/midjourney ana sayfasında (collapse'lı bir details + summary).
// Her tercih için label + tooltip + control.

import { useEffect, useState } from "react";
import {
  ALL_PREFERENCE_KEYS,
  EXPORT_FORMAT_VALUES,
  MJ_PREFERENCE_DEFS,
  type ExportFormatPref,
  type MJPreferences,
} from "./preferences";

/**
 * Preferences hook — registry'deki tüm key'leri tek seferde okur ve
 * setter'ları döner. Cross-tab sync `storage` event ile.
 */
function useMjPreferences(): {
  prefs: MJPreferences;
  set: <K extends keyof MJPreferences>(key: K, value: MJPreferences[K]) => void;
} {
  const [prefs, setPrefs] = useState<MJPreferences>(() => {
    const init: Partial<MJPreferences> = {};
    for (const k of ALL_PREFERENCE_KEYS) {
      init[k] = MJ_PREFERENCE_DEFS[k].default as never;
    }
    return init as MJPreferences;
  });

  useEffect(() => {
    // Mount sonrası localStorage'tan oku
    setPrefs((current) => {
      const next: Partial<MJPreferences> = { ...current };
      for (const k of ALL_PREFERENCE_KEYS) {
        const def = MJ_PREFERENCE_DEFS[k];
        try {
          const raw = window.localStorage.getItem(`mj-pref:${def.storageKey}`);
          if (raw === null) continue;
          const parsed = def.parse(raw);
          if (parsed !== null) {
            next[k] = parsed as never;
          }
        } catch {
          // ignore (private mode vs)
        }
      }
      return next as MJPreferences;
    });

    // Cross-tab sync
    const handler = (e: StorageEvent) => {
      if (!e.key?.startsWith("mj-pref:")) return;
      const storageKey = e.key.replace(/^mj-pref:/, "");
      const def = ALL_PREFERENCE_KEYS.find(
        (k) => MJ_PREFERENCE_DEFS[k].storageKey === storageKey,
      );
      if (!def || e.newValue === null) return;
      const parsed = MJ_PREFERENCE_DEFS[def].parse(e.newValue);
      if (parsed !== null) {
        setPrefs((p) => ({ ...p, [def]: parsed }));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  function set<K extends keyof MJPreferences>(
    key: K,
    value: MJPreferences[K],
  ) {
    const def = MJ_PREFERENCE_DEFS[key];
    try {
      window.localStorage.setItem(
        `mj-pref:${def.storageKey}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (def.serialize as (v: any) => string)(value),
      );
    } catch {
      // ignore
    }
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  return { prefs, set };
}

export function MidjourneyPreferencesPanel() {
  const { prefs, set } = useMjPreferences();

  return (
    <details
      className="rounded-md border border-border bg-surface p-3"
      data-testid="mj-preferences-panel"
    >
      <summary className="cursor-pointer text-sm font-semibold">
        ⚙ Tercihler
        <span className="ml-2 text-xs font-normal text-text-muted">
          ({ALL_PREFERENCE_KEYS.length} ayar · cihazda saklanır)
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-text-muted">
          Tarayıcıda (localStorage) saklanır. Sekmeler arası eş zamanlı
          güncellenir. Sunucu tarafına gönderilmez; sadece bu admin
          panelinin operasyonel davranışını etkiler.
        </p>

        {/* defaultExportFormat */}
        <label
          className="flex flex-col gap-1 text-xs"
          data-testid="mj-pref-defaultExportFormat"
        >
          <span className="font-semibold text-text">
            {MJ_PREFERENCE_DEFS.defaultExportFormat.label}
          </span>
          <span className="text-text-muted">
            {MJ_PREFERENCE_DEFS.defaultExportFormat.description}
          </span>
          <select
            value={prefs.defaultExportFormat}
            onChange={(e) =>
              set(
                "defaultExportFormat",
                e.target.value as ExportFormatPref,
              )
            }
            className="w-32 rounded-md border border-border bg-bg px-2 py-1 text-xs"
          >
            {EXPORT_FORMAT_VALUES.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {/* autoExpandPromoteAfterCompletion */}
        <label
          className="flex items-start gap-2 text-xs"
          data-testid="mj-pref-autoExpandPromoteAfterCompletion"
        >
          <input
            type="checkbox"
            checked={prefs.autoExpandPromoteAfterCompletion}
            onChange={(e) =>
              set("autoExpandPromoteAfterCompletion", e.target.checked)
            }
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-text">
              {MJ_PREFERENCE_DEFS.autoExpandPromoteAfterCompletion.label}
            </span>
            <span className="text-text-muted">
              {
                MJ_PREFERENCE_DEFS.autoExpandPromoteAfterCompletion
                  .description
              }
            </span>
          </span>
        </label>
      </div>
    </details>
  );
}
