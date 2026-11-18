"use client";

import { useLayoutEffect, useRef, type MutableRefObject } from "react";

/** Keep a ref.current mirrored to the latest value without reading it during render. */
export function useLiveRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
