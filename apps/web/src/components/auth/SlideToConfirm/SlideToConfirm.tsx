
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { IconArrowRight, IconCheckmark } from "symbols-react";
import styles from "./SlideToConfirm.module.css";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const SPAN = 280;
const H = 56;

const PAD = 4;

const GRIP = H - PAD * 2;

const MIN = 220;
const MAX = 380;

const CORNER = H / 2;
const SPEED = 50;

const SWELL = 1.03;

const HOLD = 1500;

export function SlideToConfirm({

  corner = CORNER,

  speed = SPEED,

  width,
  disabled = false,
  onInvalidAttempt,
  onConfirm,
}: {
  corner?: number;
  speed?: number;
  width?: number;
  disabled?: boolean;
  onInvalidAttempt?: () => void;
  onConfirm?: () => void;
} = {}) {
  const [done, setDone] = useState(false);
  const [held, setHeld] = useState(false);
  const [hot, setHot] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(SPAN);
  const reducedMotion = useReducedMotion();
  const completed = useRef(false);
  const track = useRef<HTMLDivElement | null>(null);

  const grip = useRef<{ id: number; grab: number | null; moved: boolean } | null>(null);
  const beat = useRef(0);

  const x = useMotionValue(0);

  const anchor = useMotionValue(0);

  const pulse = useMotionValue(1);

  const shown = useMotionValue(1);

  const span = clamp(Math.round(width ?? measuredWidth), MIN, MAX);
  const TRAVEL = span - PAD * 2 - GRIP;

  const r = clamp(corner, 0, CORNER);

  const gripR = Math.max(0, r - PAD);

  const mark = TRAVEL;

  const stiff = 260 + (clamp(speed, 0, 100) / 100) * 640;

  const spring = {
    type: "spring" as const,
    stiffness: stiff,
    damping: 2 * Math.sqrt(stiff * 0.9),
    mass: 0.9,
  };

  const home = { ...spring, damping: 2 * Math.sqrt(stiff * 0.9) * 0.62 };

  useEffect(() => () => {
    window.clearTimeout(beat.current);
  }, []);

  useEffect(() => {
    if (width !== undefined || !track.current) return;
    const observer = new ResizeObserver(([entry]) => setMeasuredWidth(entry.contentRect.width));
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [width]);

  const live = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  }>({ move: () => {}, up: () => {} });

  useEffect(() => {
    const onMove = (e: PointerEvent) => live.current.move(e);
    const onUp = (e: PointerEvent) => live.current.up(e);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const seen = useTransform(x, (v) => clamp(v, 0, TRAVEL));
  const wide = useTransform([seen, anchor], ([v, a]: number[]) =>
    GRIP + clamp(a - v, 0, TRAVEL));

  const over = useTransform(x, (v) => Math.max(0, -v));

  const squash = useTransform(over, (o) => 1 - Math.min(0.08, o / 110));
  const wash = useTransform(seen, (v) => v + GRIP);
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0]);

  const arrow = useTransform([seen, shown], ([v, on]: number[]) =>
    on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1));

  const sx = useTransform(squash, (q) => q * (hot && !held && !done ? SWELL : 1));
  const sy = useTransform(squash, (q) => (1 / q) * (hot && !held && !done ? SWELL : 1));

  const local = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return 0;

    const k = box.width / span;
    return (clientX - box.left) / (k || 1);
  };

  const finish = () => {
    if (completed.current || disabled) return;
    completed.current = true;
    setDone(true);

    anchor.set(x.get());
    if (reducedMotion) {
      shown.set(0);
      x.set(0);
      onConfirm?.();
      return;
    }
    animate(shown, 0, { duration: 0.12 });
    animate(x, 0, spring);
    const settle = animate(pulse, [1, 0.974, 1], {
      duration: 0.46,
      times: [0, 0.62, 1],
      ease: [0.33, 0.55, 0.2, 1],

      delay: 0.1,
    });
    settle.then(() => onConfirm?.());
    beat.current = window.setTimeout(() => {
      setDone(false);
      completed.current = false;
      animate(shown, 1, { duration: 0.2, delay: 0.12 });

      animate(anchor, 0, { type: "spring", stiffness: 380, damping: 34, mass: 0.9 });
    }, HOLD);
  };

  const down = (e: ReactPointerEvent) => {
    if (disabled) {
      onInvalidAttempt?.();
      return;
    }
    if (done || completed.current) return;
    e.stopPropagation();

    grip.current = { id: e.pointerId, grab: null, moved: false };
    setHeld(true);

    try { track.current?.setPointerCapture(e.pointerId); } catch { setHeld(true); }
  };

  const move = (e: PointerEvent | ReactPointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const at = local(e.clientX);
    if (g.grab === null) { g.grab = at - x.get(); return; }
    const next = clamp(at - g.grab, 0, TRAVEL);
    if (Math.abs(next - x.get()) > 0.5) g.moved = true;
    x.set(next);
  };

  const up = (e: PointerEvent | ReactPointerEvent) => {
    const g = grip.current;
    if (!g) return;
    grip.current = null;

    try { track.current?.releasePointerCapture?.(e.pointerId); } catch { setHeld(false); }
    setHeld(false);
    if (x.get() >= mark && e.type !== "pointercancel") finish();
    else {
      if (g.moved) animate(x, 0, home);
    }
  };

  useLayoutEffect(() => {
    live.current = { move, up };
  });

  return (
    <div className={styles.root} style={{ width: width === undefined ? "100%" : span, height: H }} data-disabled={disabled || undefined}>
      <motion.div
        className={styles.track}
        ref={track}
        style={{ borderRadius: r, scale: pulse }}
        data-held={held || undefined}
        data-done={done || undefined}
        onPointerDown={down}
      >

        <motion.i
          className={styles.wash}
          aria-hidden="true"
          style={{ width: wash, borderRadius: gripR }}
        />

        <motion.span className={styles.say} style={{ opacity: say }}>
          Slide to confirm
        </motion.span>

        <motion.button
          type="button"
          className={styles.grip}
          onPointerEnter={() => setHot(true)}
          onPointerLeave={() => setHot(false)}
          style={{
            x: seen,
            scaleX: sx,
            scaleY: sy,

            width: wide,
            borderRadius: gripR,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.7 }}
          aria-disabled={disabled || done}
          aria-label={done ? "Confirmed" : "Slide to confirm"}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (disabled) { onInvalidAttempt?.(); return; }
              x.set(mark);
              finish();
            }
          }}
        >
          <motion.span className={styles.arrow} style={{ opacity: arrow }} aria-hidden="true">
            <IconArrowRight width={20} height={20} fill="currentColor" />
          </motion.span>

          <motion.span
            className={styles.done}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.7 }}
            transition={{ duration: 0.18, ease: [0.33, 0.55, 0.2, 1] }}
          >
            <IconCheckmark width={19} height={19} fill="currentColor" />
            Confirmed
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
  );
}
