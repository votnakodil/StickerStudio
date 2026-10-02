import type { CSSProperties } from "react";

export const TEXT_SHIMMER_KEYFRAMES =
  "@keyframes sticker-text-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}" +
  "@media (prefers-reduced-motion: reduce){.sticker-text-shimmer{animation:none !important}}";

export const TEXT_SHIMMER_CLASS_NAME =
  "sticker-text-shimmer bg-[length:200%_100%] bg-clip-text text-transparent bg-[linear-gradient(110deg,var(--muted-foreground)_30%,var(--foreground)_50%,var(--muted-foreground)_70%)]";

function pausedAnimationName(duration: number, repeatDelay: number) {
  return `sticker-text-shimmer-${String(duration).replace('.', '_')}-${String(repeatDelay).replace('.', '_')}`;
}

export function textShimmerPauseKeyframes(duration: number, repeatDelay: number) {
  const sweepEnd = (duration / (duration + repeatDelay) * 100).toFixed(4);
  return `@keyframes ${pausedAnimationName(duration, repeatDelay)}{0%{background-position:200% 0}${sweepEnd}%{background-position:-200% 0}100%{background-position:-200% 0}}`;
}

export function textShimmerStyle(duration: number, repeatDelay = 0): CSSProperties {
  return {

    backgroundColor: "var(--muted-foreground)",
    backgroundRepeat: "no-repeat",
    animation: repeatDelay > 0
      ? `${pausedAnimationName(duration, repeatDelay)} ${duration + repeatDelay}s linear infinite`
      : `sticker-text-shimmer ${duration}s linear infinite`,
  };
}
