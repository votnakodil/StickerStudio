export type GlowLayer = {
  t: number;
  b: number;
  o: number;
  breathe: boolean;
  delay: string;
};

export const GLOW_LAYERS: GlowLayer[] = [
  { t: 3, b: 15, o: 1, breathe: false, delay: "0s" },
  { t: 8, b: 12, o: 1, breathe: false, delay: "0s" },
  { t: 9, b: 28, o: 1, breathe: true, delay: "0s" },
  { t: 18, b: 32, o: 0.9, breathe: true, delay: "0.2s" },
];
