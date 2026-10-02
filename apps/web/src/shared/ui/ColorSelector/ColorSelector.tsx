"use client";

// BeUI Animated Color Selector (MIT), adapted to the editor theme.
// Source: https://beui.dev/r/color-selector/raw
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useId, useState, type ComponentPropsWithRef } from "react";
import { cn } from "@/shared/lib/classNames";
import styles from "./ColorSelector.module.css";

const SPRING_LAYOUT = { type: "spring" as const, stiffness: 420, damping: 25, mass: 0.75 };
const SPRING_PRESS = { type: "spring" as const, stiffness: 500, damping: 25, mass: 0.6 };

type ColorSelectorContextValue = {
  value: string;
  select: (value: string) => void;
  name: string;
  disabled: boolean;
  required: boolean;
  form?: string;
};

const ColorSelectorContext = createContext<ColorSelectorContextValue | null>(null);

export interface ColorSelectorProps extends Omit<ComponentPropsWithRef<"fieldset">, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
}

export function ColorSelector({ value, defaultValue = "", onValueChange, name, disabled = false, required = false, form, className, children, ...props }: ColorSelectorProps) {
  const id = useId();
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  return (
    <ColorSelectorContext.Provider value={{
      value: current,
      select: (next) => {
        if (next === current) return;
        if (value === undefined) setInternal(next);
        onValueChange?.(next);
      },
      name: name ?? id,
      disabled,
      required,
      form,
    }}>
      <fieldset {...props} disabled={disabled} form={form} className={cn(styles.root, className)}>
        <LayoutGroup id={id}>{children}</LayoutGroup>
      </fieldset>
    </ColorSelectorContext.Provider>
  );
}

export type ColorSelectorLabelProps = ComponentPropsWithRef<"legend">;
export function ColorSelectorLabel({ className, ...props }: ColorSelectorLabelProps) {
  return <legend {...props} className={cn(styles.label, className)} />;
}

export type ColorSelectorListProps = ComponentPropsWithRef<"div">;
export function ColorSelectorList({ className, ...props }: ColorSelectorListProps) {
  return <div {...props} className={cn(styles.list, className)} />;
}

export interface ColorSelectorItemProps extends Omit<ComponentPropsWithRef<"input">, "type" | "value" | "defaultValue" | "checked" | "defaultChecked" | "name" | "children" | "size"> {
  value: string;
  color: string;
  label: string;
  className?: string;
  swatchBackground?: string;
}

export function ColorSelectorItem({ value, color, label, disabled = false, className, style, onChange, swatchBackground, ...props }: ColorSelectorItemProps) {
  const context = useContext(ColorSelectorContext);
  const reduce = useReducedMotion();
  if (!context) throw new Error("ColorSelectorItem must be used within ColorSelector");
  const selected = context.value === value;
  const unavailable = disabled || context.disabled;
  return (
    <motion.label tabIndex={-1} whileTap={reduce || unavailable ? undefined : { scale: 0.94 }} transition={SPRING_PRESS} className={cn(styles.item, unavailable && styles.unavailable)}>
      <input
        {...props}
        type="radio"
        name={context.name}
        value={value}
        checked={selected}
        disabled={unavailable}
        required={context.required}
        form={context.form}
        aria-label={label}
        onChange={(event) => {
          onChange?.(event);
          if (!event.defaultPrevented) context.select(value);
        }}
        className={styles.input}
      />
      <span aria-hidden="true" style={style} className={cn(styles.surface, className)}>
        {selected && <motion.span layoutId={reduce ? undefined : "color-selection"} initial={false} transition={SPRING_LAYOUT} className={styles.ring} style={{ borderColor: `color-mix(in srgb, ${color} 80%, var(--palette-focus-blue))` }} />}
        <span className={styles.dot} style={{ background: swatchBackground ?? color }} />
      </span>
    </motion.label>
  );
}
