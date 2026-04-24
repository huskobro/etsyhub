"use client";

import { useState, useCallback, useRef } from "react";
import type { ConfirmPresetValue } from "./confirm-presets";

type ConfirmState = {
  open: boolean;
  preset: ConfirmPresetValue | null;
  busy: boolean;
  errorMessage: string | null;
};

const INITIAL_STATE: ConfirmState = {
  open: false,
  preset: null,
  busy: false,
  errorMessage: null,
};

function messageFromError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  return "İşlem başarısız oldu. Lütfen tekrar dene.";
}

/**
 * ConfirmDialog ile birlikte kullanılan imperative hook.
 *
 * Tek dialog instance'ı yönetir. `confirm(preset, handler)` çağrısı yeni bir
 * onay akışı başlatır; handler başarılı olursa dialog kapanır, hata fırlatırsa
 * dialog açık kalır ve hata mesajı dialog içinde gösterilir. Böylece mutation
 * başarısız olduğunda kullanıcı sessiz kapanma görmez, bilinçli bir şekilde
 * retry veya cancel edebilir.
 *
 * Aynı anda yalnızca tek akış desteklenir; açık dialog varken `confirm` tekrar
 * çağrılırsa önceki preset sessizce değiştirilir.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INITIAL_STATE);
  const handlerRef = useRef<(() => void | Promise<void>) | null>(null);

  const confirm = useCallback(
    (preset: ConfirmPresetValue, handler: () => void | Promise<void>) => {
      handlerRef.current = handler;
      setState({
        open: true,
        preset,
        busy: false,
        errorMessage: null,
      });
    },
    [],
  );

  const close = useCallback(() => {
    setState((s) => {
      if (s.busy) return s;
      handlerRef.current = null;
      return INITIAL_STATE;
    });
  }, []);

  const run = useCallback(async () => {
    const handler = handlerRef.current;
    if (!handler) return;
    setState((s) => ({ ...s, busy: true, errorMessage: null }));
    try {
      await handler();
      handlerRef.current = null;
      setState(INITIAL_STATE);
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        errorMessage: messageFromError(err),
      }));
    }
  }, []);

  return { confirm, close, run, state };
}
