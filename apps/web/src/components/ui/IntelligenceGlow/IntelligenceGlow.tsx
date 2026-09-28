"use client";

import type { CSSProperties } from "react";
import { GLOW_LAYERS, type GlowLayer } from "./layers";
import styles from "./IntelligenceGlow.module.css";

export type IntelligenceGlowProps = {
  active?: boolean;
  className?: string;
  scale?: number;
  layers?: readonly GlowLayer[];
};

export function IntelligenceGlow({ active, className, scale = 1, layers = GLOW_LAYERS }: IntelligenceGlowProps) {
  const activation = active === undefined ? undefined : {
    "--intelligence-glow-opacity": active ? 1 : 0,
    "--intelligence-glow-play-state": active ? "running" : "paused",
  } as CSSProperties;

  return (
    <span aria-hidden="true" className={[styles.glow, className].filter(Boolean).join(" ")} style={activation}>
      {layers.map(({ t, b, o, breathe, delay }, index) => (
        <span
          key={index}
          className={`${styles.layerWrap} ${breathe ? styles.breathe : ""}`}
          style={{ "--ig-opacity": o, "--ig-blur": `${b * scale}px`, animationDelay: delay } as CSSProperties}
        >
          <span className={styles.ringMask} style={{ "--ig-thickness": `${Math.max(1.5, t * scale)}px` } as CSSProperties}>
            <span className={styles.layer} />
          </span>
        </span>
      ))}
    </span>
  );
}
