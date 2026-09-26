"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False during the server render and the first client render, true afterwards.
 * Use it to defer browser-only output (like the resolved colour theme) without
 * a setState-in-effect cascade.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
