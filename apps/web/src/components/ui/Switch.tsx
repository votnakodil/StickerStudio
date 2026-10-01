"use client";

// BeUI Switch (MIT), adapted to the editor theme.
// Source: https://beui.dev/r/switch/raw
import { animate, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./classNames";
import styles from "./Switch.module.css";

const THUMB_SPRING = { type: "spring", stiffness: 800, damping: 80, mass: 4 } as const;

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, disabled, label, ariaLabel, className }: SwitchProps) {
  const id = useId();
  const thumbRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    if (!thumbRef.current || reduce) return;
    if (disabled && isPressed) {
      animate(thumbRef.current, { x: [0, -2, 2, -1, 0] }, { delay: 0.2, duration: 0.6 });
    }
  }, [disabled, isPressed, reduce]);

  const squish = !disabled && isPointer && isPressed && !reduce;
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : THUMB_SPRING}>
      <span className={cn(styles.root, className)}>
        <motion.button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel ?? label}
          disabled={disabled}
          onClick={() => !disabled && onCheckedChange(!checked)}
          onPointerDown={(event) => {
            setIsPressed(true);
            setIsPointer(event.type.startsWith("pointer"));
          }}
          onPointerUp={() => setIsPressed(false)}
          onPointerLeave={() => setIsPressed(false)}
          initial={false}
          data-state={checked ? "checked" : "unchecked"}
          className={cn(styles.track, checked && styles.checked)}
        >
          <motion.div ref={thumbRef} layout animate={{ scale: squish ? 0.9 : 1 }} className={styles.thumb}>
            <div className={cn(styles.thumbInner, squish && (checked ? styles.squishRight : styles.squishLeft))} />
          </motion.div>
        </motion.button>
        {label ? <label htmlFor={id} className={styles.label}>{label}</label> : null}
      </span>
    </MotionConfig>
  );
}
