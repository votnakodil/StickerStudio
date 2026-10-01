"use client";

// BeUI Bubble Slider (MIT), adapted to the editor's light and dark surfaces.
// Source: https://github.com/starc007/ui-components/blob/main/components/motion/range-slider-bubble.tsx
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useEffect } from "react";
import { SPRING_GLIDE, SPRING_PANEL, SPRING_PRESS } from "../../lib/ease";
import { type SliderOptions, useSlider } from "../../lib/hooks/useSlider";
import { cn } from "./classNames";
import styles from "./BubbleSlider.module.css";

const SPRING_TILT = { stiffness: 260, damping: 22, mass: 0.4 } as const;
const FULL_TILT = 320;

export interface BubbleSliderProps extends SliderOptions {
  format?: (value: number) => string;
  showBubble?: boolean;
  className?: string;
}

export function BubbleSlider({ format, showBubble = true, className, ...options }: BubbleSliderProps) {
  const reduce = useReducedMotion();
  const { percent, current, dragging, trackProps, sliderProps } = useSlider({
    ...options,
    formatValueText: options.formatValueText ?? format,
  });
  const readout = format ? format(current) : current;
  const target = useMotionValue(percent);
  useEffect(() => { target.set(percent); }, [percent, target]);
  const smooth = useSpring(target, SPRING_GLIDE);
  const position = reduce ? target : smooth;
  const left = useMotionTemplate`${position}%`;
  const velocity = useVelocity(position);
  const lean = useSpring(useTransform(velocity, [-FULL_TILT, 0, FULL_TILT], [1, 0, -1], { clamp: true }), SPRING_TILT);
  const tilt = useTransform(lean, (value) => value * 16);
  const squash = useTransform(lean, (value) => 1 + Math.abs(value) * 0.18);
  const stretch = useTransform(lean, (value) => 1 - Math.abs(value) * 0.12);

  return (
    <div className={cn(styles.root, !showBubble && styles.compact, options.disabled && styles.disabled, className)}>
      <div {...trackProps} className={styles.track}>
        <motion.div className={styles.fill} style={{ width: left }} />
        <motion.div
          className={styles.thumb}
          style={{ left, x: "-50%", y: "-50%" }}
          animate={reduce ? undefined : { scale: dragging ? 1.25 : 1 }}
          transition={SPRING_PRESS}
        />
        <motion.div className={styles.bubbleAnchor} style={{ left, x: "-50%" }}>
          <AnimatePresence>
            {dragging && showBubble && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.5, y: 8, transition: { duration: 0.12 } }}
                transition={reduce ? { duration: 0.12 } : SPRING_PANEL}
                style={reduce ? undefined : { rotate: tilt, scaleX: squash, scaleY: stretch, originY: 1 }}
                className={styles.bubble}
              >
                {readout}
                <span className={styles.bubbleTip} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <button type="button" {...sliderProps} className={styles.hitArea} />
      </div>
    </div>
  );
}
