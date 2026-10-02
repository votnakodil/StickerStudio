"use client";

// BeUI Morph Select (MIT), adapted to this project's theme and icon setup.
// Source: https://beui.dev/r/select-morph/raw
import { AnimatePresence, motion, useReducedMotion, type Transition, type Variants } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/classNames";
import styles from "./SelectMorph.module.css";

const MORPH: Transition = { type: "spring", duration: 0.5, bounce: 0.22 };
const CLOSE_MORPH: Transition = { type: "spring", duration: 0.38, bounce: 0 };
const LIST: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } } };
const ITEM: Variants = { hidden: { opacity: 0, y: -6, filter: "blur(3px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } };

// Same geometry and stroke as the ChevronDown and Check icons in BeUI's source.
function ChevronDown() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

function Check() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
}

type MorphContextValue = {
  value?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  select: (value: string) => void;
  register: (value: string, label: string) => void;
  unregister: (value: string) => void;
  labelFor: (value?: string) => string | undefined;
  placeholder: string;
  setPlaceholder: (placeholder: string) => void;
  reduce: boolean;
  layoutId: string;
  triggerId: string;
  listId: string;
  disabled: boolean;
};

const MorphContext = createContext<MorphContextValue | null>(null);

function useMorphContext(component: string) {
  const context = useContext(MorphContext);
  if (!context) throw new Error(`${component} must be used inside MorphSelect`);
  return context;
}

export function MorphSelect({ value, defaultValue, onValueChange, disabled = false, className, children }: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  const [labels, setLabels] = useState<Map<string, { label: string; count: number }>>(() => new Map());
  const [placeholder, setPlaceholder] = useState("Select");
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const select = useCallback((next: string) => {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
    setOpen(false);
  }, [controlled, onValueChange]);

  const register = useCallback((itemValue: string, label: string) => {
    setLabels((previous) => {
      const next = new Map(previous);
      next.set(itemValue, { label, count: (previous.get(itemValue)?.count ?? 0) + 1 });
      return next;
    });
  }, []);

  const unregister = useCallback((itemValue: string) => {
    setLabels((previous) => {
      const entry = previous.get(itemValue);
      if (!entry) return previous;
      const next = new Map(previous);
      if (entry.count <= 1) next.delete(itemValue);
      else next.set(itemValue, { label: entry.label, count: entry.count - 1 });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const context = useMemo<MorphContextValue>(() => ({
    value: current,
    open,
    setOpen,
    select,
    register,
    unregister,
    labelFor: (itemValue) => itemValue === undefined ? undefined : labels.get(itemValue)?.label,
    placeholder,
    setPlaceholder,
    reduce,
    layoutId: `${baseId}-surface`,
    triggerId: `${baseId}-trigger`,
    listId: `${baseId}-list`,
    disabled,
  }), [current, open, select, register, unregister, labels, placeholder, reduce, baseId, disabled]);

  return (
    <MorphContext.Provider value={context}>
      <div ref={rootRef} className={cn(styles.root, className)}>
        {children}
        <span aria-hidden="true" className={styles.fixedValue}>{context.labelFor(current) ?? placeholder}</span>
      </div>
    </MorphContext.Provider>
  );
}

export function MorphSelectValue({ placeholder, className }: { placeholder?: string; className?: string }) {
  const context = useMorphContext("MorphSelectValue");
  const { setPlaceholder } = context;
  useEffect(() => { if (placeholder) setPlaceholder(placeholder); }, [placeholder, setPlaceholder]);
  const label = context.labelFor(context.value);
  return <span className={cn(styles.value, className)}>{label ?? placeholder ?? "Select"}</span>;
}

export function MorphSelectTrigger({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const context = useMorphContext("MorphSelectTrigger");
  return (
    <>
      <div aria-hidden="true" inert className={cn(styles.row, styles.sizer)}>{children}<ChevronDown /></div>
      <AnimatePresence initial={false} mode="popLayout">
        {!context.open ? (
          <motion.button
            key="trigger"
            layoutId={context.layoutId}
            type="button"
            id={context.triggerId}
            disabled={context.disabled}
            aria-label={label ? `${label}: ${context.labelFor(context.value) ?? context.value ?? "Select"}` : undefined}
            aria-haspopup="listbox"
            aria-expanded={context.open}
            aria-controls={context.listId}
            onClick={() => context.setOpen(true)}
            transition={context.reduce ? { duration: 0 } : CLOSE_MORPH}
            style={{ borderRadius: 12 }}
            className={cn(styles.row, styles.trigger, className)}
          >
            <motion.span layout="position" className={cn(styles.value, styles.movingValue)}>{children}</motion.span>
            <motion.span layout="position" className={styles.chevron}><ChevronDown /></motion.span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function MorphSelectContent({ children, className }: { children: ReactNode; className?: string }) {
  const context = useMorphContext("MorphSelectContent");
  const label = context.labelFor(context.value);
  return (
    <>
      <div className={styles.registrar}>{children}</div>
      <AnimatePresence initial={false} mode="popLayout">
        {context.open ? (
          <motion.div
            key="panel"
            layoutId={context.layoutId}
            id={context.listId}
            role="listbox"
            aria-labelledby={context.triggerId}
            transition={context.reduce ? { duration: 0 } : MORPH}
            style={{ borderRadius: 12 }}
            className={cn(styles.panel, className)}
          >
            <motion.button type="button" layout="position" aria-label={`Close ${label ?? context.placeholder} menu`} aria-expanded onClick={() => context.setOpen(false)} className={cn(styles.row, styles.header)}>
              <span className={cn(styles.value, styles.movingValue)}>{label ?? context.placeholder}</span>
              <motion.span animate={{ rotate: 180 }} transition={context.reduce ? { duration: 0 } : MORPH} className={styles.chevron}><ChevronDown /></motion.span>
            </motion.button>
            <div className={styles.divider} />
            <motion.ul initial="hidden" animate="show" variants={context.reduce ? undefined : LIST} className={styles.list}>{children}</motion.ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function MorphSelectItem({ value, label, disabled = false, className, children }: { value: string; label?: string; disabled?: boolean; className?: string; children: ReactNode }) {
  const context = useMorphContext("MorphSelectItem");
  const { register, unregister } = context;
  const selected = context.value === value;
  const itemLabel = label ?? (typeof children === "string" ? children : value);
  useLayoutEffect(() => {
    register(value, itemLabel);
    return () => unregister(value);
  }, [register, unregister, value, itemLabel]);
  return (
    <motion.li variants={context.reduce ? undefined : ITEM}>
      <button type="button" role="option" aria-selected={selected} disabled={disabled} onClick={() => context.select(value)} className={cn(styles.item, selected && styles.selected, className)}>
        {children}{selected ? <Check /> : null}
      </button>
    </motion.li>
  );
}
