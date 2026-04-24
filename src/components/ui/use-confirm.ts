"use client";

import { useState, useCallback } from "react";
import type { ConfirmPresetValue } from "./confirm-presets";

type ConfirmState = {
  open: boolean;
  preset: ConfirmPresetValue | null;
  onConfirm: (() => void | Promise<void>) | null;
};

const INITIAL_STATE: ConfirmState = {
  open: false,
  preset: null,
  onConfirm: null,
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INITIAL_STATE);

  const confirm = useCallback(
    (preset: ConfirmPresetValue, onConfirm: () => void | Promise<void>) => {
      setState({ open: true, preset, onConfirm });
    },
    [],
  );

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { confirm, close, state };
}
