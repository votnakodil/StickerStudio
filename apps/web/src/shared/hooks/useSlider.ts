"use client";

// Adapted from BeUI's MIT-licensed Range Slider hook.
// Source: https://github.com/starc007/ui-components/blob/main/lib/hooks/use-slider.ts
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface SliderOptions {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  edgeInset?: number;
  "aria-label"?: string;
  formatValueText?: (value: number) => string;
}

export function useSlider({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  edgeInset = 0,
  "aria-label": ariaLabel,
  formatValueText,
}: SliderOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const [pointerFocus, setPointerFocus] = useState(false);
  const controlled = value !== undefined;
  const lo = min;
  const hi = Math.max(min, max);
  const stride = step > 0 ? step : 1;
  const current = clamp(controlled ? value : internal, lo, hi);
  const percent = hi > lo ? ((current - lo) / (hi - lo)) * 100 : 0;

  const commit = useCallback((next: number) => {
    const clean = clamp(Math.round((next - lo) / stride) * stride + lo, lo, hi);
    if (!controlled) setInternal(clean);
    onValueChange?.(clean);
  }, [controlled, hi, lo, onValueChange, stride]);

  const commitFromX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const inset = Math.min(Math.max(0, edgeInset), rect.width / 2);
    const travel = rect.width - inset * 2;
    if (travel <= 0) return;
    commit(lo + clamp((clientX - rect.left - inset) / travel, 0, 1) * (hi - lo));
  }, [commit, edgeInset, hi, lo]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setPointerFocus(true);
    draggingRef.current = true;
    setDragging(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    handleRef.current?.focus({ preventScroll: true });
    commitFromX(event.clientX);
  }, [commitFromX, disabled]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current && !disabled) commitFromX(event.clientX);
  }, [commitFromX, disabled]);

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    setPointerFocus(false);
    const values: Record<string, number> = {
      ArrowRight: current + stride,
      ArrowUp: current + stride,
      ArrowLeft: current - stride,
      ArrowDown: current - stride,
      PageUp: current + stride * 10,
      PageDown: current - stride * 10,
      Home: lo,
      End: hi,
    };
    if (event.key in values) {
      event.preventDefault();
      commit(values[event.key]);
    }
  }, [commit, current, disabled, hi, lo, stride]);

  return {
    current,
    percent,
    dragging,
    min: lo,
    max: hi,
    step: stride,
    trackProps: {
      ref: trackRef,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
    sliderProps: {
      ref: (node: HTMLElement | null) => { handleRef.current = node; },
      role: "slider" as const,
      tabIndex: disabled ? -1 : 0,
      "aria-label": ariaLabel,
      "aria-valuemin": lo,
      "aria-valuemax": hi,
      "aria-valuenow": current,
      "aria-valuetext": formatValueText?.(current),
      "aria-disabled": disabled || undefined,
      "data-pointer-focus": pointerFocus || undefined,
      onBlur: () => setPointerFocus(false),
      onKeyDown,
    },
  };
}
