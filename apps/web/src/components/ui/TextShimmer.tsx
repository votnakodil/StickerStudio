
import { cn } from "./classNames";
import type { ElementType, ReactNode } from "react";
import {
  TEXT_SHIMMER_CLASS_NAME,
  TEXT_SHIMMER_KEYFRAMES,
  textShimmerPauseKeyframes,
  textShimmerStyle,
} from "./textShimmerAnimation";

export interface TextShimmerProps {
  children: ReactNode;
  as?: ElementType;
  duration?: number;
  repeatDelay?: number;
  className?: string;
}

export function TextShimmer({ children, as: Comp = "span", duration = 2.5, repeatDelay = 0, className }: TextShimmerProps) {
  return (
    <>
      <style>
        {TEXT_SHIMMER_KEYFRAMES}
        {repeatDelay > 0 ? textShimmerPauseKeyframes(duration, repeatDelay) : null}
      </style>
      <Comp
        style={textShimmerStyle(duration, repeatDelay)}
        className={cn(
          "inline-block",
          TEXT_SHIMMER_CLASS_NAME,
          className,
        )}
      >
        {children}
      </Comp>
    </>
  );
}
