"use client";

import { IconChevronLeft, IconChevronRight } from "symbols-react";
import { AnimatePresence, cancelFrame, frame, motion, MotionConfig, useReducedMotion, type Transition } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { EASE_OUT } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/classNames";

type Variant = "pill" | "underline" | "segment";

type Ctx = {
  value: string;
  selected: Set<string>;
  multiple: boolean;
  setValue: (v: string) => void;
  layoutId: string;
  variant: Variant;
  motionTransition?: Transition;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

const transition: Transition = {
  type: "spring",
  stiffness: 245,
  damping: 36,
  mass: 1.2,
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  multipleValues,
  onMultipleValueChange,
  variant = "pill",
  children,
  className,
  motionTransition,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  multipleValues?: string[];
  onMultipleValueChange?: (values: string[]) => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
  motionTransition?: Transition;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const multiple = multipleValues !== undefined;
  const selected = useMemo(() => new Set(multiple ? multipleValues : [current]), [multiple, multipleValues, current]);
  const setValue = useCallback(
    (v: string) => {
      if (multiple) {
        const next = new Set(multipleValues);
        if (next.has(v)) next.delete(v);
        else next.add(v);
        onMultipleValueChange?.(Array.from(next));
        return;
      }
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, multiple, multipleValues, onMultipleValueChange, onValueChange],
  );
  const contextValue = useMemo(
    () => ({ value: current, selected, multiple, setValue, layoutId, variant, motionTransition }),
    [current, selected, multiple, layoutId, setValue, variant, motionTransition],
  );
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : motionTransition ?? transition}>
      <TabsCtx.Provider value={contextValue}>
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

const listClasses: Record<Variant, string> = {
  pill: "inline-flex items-center gap-1 rounded-full bg-[var(--palette-perceptual09)] p-1 dark:bg-[var(--palette-perceptual03)]",
  underline: "inline-flex items-center gap-1 border-b border-[var(--palette-perceptual06)] dark:border-[var(--palette-perceptual08)]",
  segment: "inline-flex items-center gap-0 rounded-lg bg-[var(--palette-perceptual09)] p-0.5 dark:bg-[var(--palette-perceptual03)]",
};

export function TabsList({
  children,
  className,
  wrapperClassName,
  indicatorClassName,
  label,
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  indicatorClassName?: string;
  label?: string;
}) {
  const { variant, value, selected, multiple, motionTransition } = useTabs();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportId = useId();
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
  const [indicatorBounds, setIndicatorBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const measuredIndicator = variant !== "underline" && !multiple && !!motionTransition;

  const measureIndicator = useCallback(() => {
    if (!measuredIndicator) return;
    const target = listRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!target) return;
    const next = { x: target.parentElement!.offsetLeft, y: target.parentElement!.offsetTop, width: target.offsetWidth, height: target.offsetHeight };
    setIndicatorBounds((previous) => previous && Object.keys(next).every((key) => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
  }, [measuredIndicator]);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    const overflow = viewport.scrollWidth > root.clientWidth + 1;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const rtl = getComputedStyle(viewport).direction === "rtl";
    const fromLeft = Math.max(0, Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft));
    const next = { overflow, left: fromLeft > 1, right: fromLeft < max - 1 };
    setEdges((previous) => previous.overflow === next.overflow && previous.left === next.left && previous.right === next.right ? previous : next);
  }, []);

  const reveal = useCallback((tab: HTMLElement | null) => {
    const viewport = viewportRef.current;
    if (!viewport || !tab) return;
    const frame = viewport.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const rtl = getComputedStyle(viewport).direction === "rtl";
    const fromLeft = Math.max(0, Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft));
    const left = frame.left + (fromLeft > 1 ? 36 : 0);
    const right = frame.right - (fromLeft < max - 1 ? 36 : 0);
    const delta = item.left < left ? item.left - left : item.right > right ? item.right - right : 0;
    if (delta) viewport.scrollBy({ left: delta, behavior: reduce ? "instant" : "smooth" });
  }, [reduce]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!root || !viewport || !list) return;
    const update = () => {
      measure();
      measureIndicator();
      reveal(list.querySelector<HTMLElement>('[data-tabs-active="true"]'));
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(viewport);
    observer.observe(list);
    viewport.addEventListener("scroll", measure, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", measure);
    };
  }, [measure, measureIndicator, reveal]);

  useLayoutEffect(() => {
    void children;
    void value;
    void edges.overflow;
    measure();
    measureIndicator();
    reveal(listRef.current?.querySelector<HTMLElement>('[data-tabs-active="true"]') ?? null);
  }, [children, value, selected, edges.overflow, measure, measureIndicator, reveal]);

  useLayoutEffect(() => {
    if (variant === "underline") return;
    const list = listRef.current;
    if (!list) return;
    void children;
    const labels = Array.from(list.querySelectorAll<HTMLElement>("[data-tabs-label]"));
    if (labels.length === 0 || labels.every((label) => getComputedStyle(label).display === "none")) return;
    const indicator = list.querySelector<HTMLElement>("[data-tabs-indicator]");
    const target = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (multiple) {
      labels.forEach((label) => {
        const ownIndicator = label.closest("button")?.parentElement?.querySelector<HTMLElement>("[data-tabs-indicator]");
        label.style.clipPath = ownIndicator ? "inset(0)" : "inset(0 100% 0 0)";
      });
      return;
    }
    if (!indicator || !target || target.dataset.tabsValue !== value) {
      for (const label of labels) label.style.clipPath = "inset(0 100% 0 0)";
      return;
    }
    let frames = 0;
    let stillFrames = 0;
    let previous: { left: number; right: number } | undefined;
    const syncClips = () => {
      const pill = (reduce ? target : indicator).getBoundingClientRect();
      const clips = labels.map((label) => {
        const bounds = label.getBoundingClientRect();
        const left = Math.max(0, Math.min(bounds.width, pill.left - bounds.left));
        const right = Math.max(0, Math.min(bounds.width, bounds.right - pill.right));
        return left + right >= bounds.width ? "inset(0 100% 0 0)" : `inset(0 ${right}px 0 ${left}px)`;
      });
      labels.forEach((label, index) => {
        if (label.style.clipPath !== clips[index]) label.style.clipPath = clips[index];
      });
      frames += 1;
      stillFrames = previous && Math.abs(pill.left - previous.left) < 0.01 && Math.abs(pill.right - previous.right) < 0.01 ? stillFrames + 1 : 0;
      previous = { left: pill.left, right: pill.right };
      if (reduce || (frames > 2 && stillFrames >= 2)) cancelFrame(syncClips);
    };
    frame.postRender(syncClips, true);
    return () => cancelFrame(syncClips);
  }, [value, selected, multiple, children, variant, reduce]);

  const scroll = (direction: number) => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollBy({ left: direction * viewport.clientWidth * 0.8, behavior: reduce ? "instant" : "smooth" });
  };
  const controlClass = "absolute inset-y-0 z-20 cursor-pointer inline-flex w-9 items-center justify-center text-[var(--palette-perceptual02)] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-0 dark:text-[var(--palette-perceptual07)]";
  const surfaceClass = variant === "pill" ? "rounded-full bg-[var(--palette-perceptual09)] dark:bg-[var(--palette-perceptual03)]" : variant === "segment" ? "rounded-lg bg-[var(--palette-perceptual09)] dark:bg-[var(--palette-perceptual03)]" : "";

  return (
    <div ref={rootRef} className={cn("relative isolate flex w-full max-w-full min-w-0 items-center", edges.overflow && surfaceClass, wrapperClassName)}>
      {edges.overflow && (
        <button type="button" aria-label="Scroll tabs left" aria-controls={viewportId} disabled={!edges.left} onClick={() => scroll(-1)} className={cn(controlClass, "left-0 rounded-l-full")}>
          <IconChevronLeft width={12} height={17} fill="currentColor" aria-hidden="true" />
        </button>
      )}
      <motion.div
        ref={viewportRef}
        id={viewportId}
        layoutScroll
        className={cn("w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", edges.overflow && "[border-radius:inherit]")}
        style={edges.overflow ? {
          maskImage: `linear-gradient(to right, ${edges.left ? "transparent, var(--palette-black) 40px" : "var(--palette-black), var(--palette-black) 0px"}, ${edges.right ? "var(--palette-black) calc(100% - 40px), transparent" : "var(--palette-black) 100%"})`,
        } : undefined}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement && event.target.getAttribute("role") === "tab") reveal(event.target);
        }}
      >
        <div ref={listRef} role={multiple ? "group" : "tablist"} aria-label={label} className={cn(listClasses[variant], "relative w-max", className)}>
          {measuredIndicator && indicatorBounds && (
            <motion.span
              data-tabs-indicator=""
              aria-hidden="true"
              initial={false}
              animate={{ x: indicatorBounds.x, y: indicatorBounds.y, width: indicatorBounds.width, height: indicatorBounds.height }}
              transition={reduce ? { duration: 0 } : motionTransition}
              className={cn("pointer-events-none absolute left-0 top-0 bg-[var(--palette-focus-blue)]", variant === "pill" ? "rounded-full" : "rounded-md", indicatorClassName)}
            />
          )}
          {children}
        </div>
      </motion.div>
      {edges.overflow && edges.left && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-[inherit] backdrop-blur-[2px] [mask-image:linear-gradient(to_right,var(--palette-black),transparent)]" />
      )}
      {edges.overflow && edges.right && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-[inherit] backdrop-blur-[2px] [mask-image:linear-gradient(to_left,var(--palette-black),transparent)]" />
      )}
      {edges.overflow && (
        <button type="button" aria-label="Scroll tabs right" aria-controls={viewportId} disabled={!edges.right} onClick={() => scroll(1)} className={cn(controlClass, "right-0 rounded-r-full")}>
          <IconChevronRight width={12} height={17} fill="currentColor" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const { selected, multiple, setValue, layoutId, variant, motionTransition } = useTabs();
  const reduce = useReducedMotion();
  const active = selected.has(value);
  const tabId = `${layoutId}-${value}-tab`;
  const panelId = `${layoutId}-${value}-panel`;
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const tabs = Array.from(event.currentTarget.closest('[role="tablist"], [role="group"]')?.querySelectorAll<HTMLButtonElement>(multiple ? '[data-tabs-value]:not(:disabled)' : '[role="tab"]:not(:disabled)') ?? []);
    if (tabs.length === 0) return;
    const index = tabs.indexOf(event.currentTarget);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };
  const [initialClip] = useState(() => active ? "inset(0)" : "inset(0 100% 0 0)");

  if (variant === "underline") {
    return (
      <button
        type="button"
        disabled={disabled}
        role={multiple ? undefined : "tab"}
        aria-label={ariaLabel}
        id={tabId}
        aria-controls={multiple ? undefined : panelId}
        aria-selected={multiple ? undefined : active}
        aria-pressed={multiple ? active : undefined}
        tabIndex={multiple || active ? 0 : -1}
        data-tabs-value={value}
        data-tabs-active={active || undefined}
        onKeyDown={handleKeyDown}
        onClick={() => setValue(value)}
        className={cn(
          "relative isolate cursor-pointer disabled:cursor-default px-3 pb-2.5 pt-1 -mb-px text-sm font-medium transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap shrink-0",
          active ? "text-[var(--palette-perceptual02)] dark:text-[var(--palette-perceptual07)]" : "text-[var(--palette-perceptual04)] hover:text-[var(--palette-perceptual02)] dark:text-[var(--palette-perceptual05)] dark:hover:text-[var(--palette-perceptual07)]",
          className,
        )}
      >
        {children}
        {active ? (
        <motion.span
          layoutId={multiple ? `${layoutId}-${value}` : layoutId}
          layout
          className={cn(
            "absolute bottom-0 left-0 right-0 h-px bg-[var(--palette-perceptual03)] dark:bg-[var(--palette-perceptual06)]",
            indicatorClassName,
          )}
        />
        ) : null}
      </button>
    );
  }

  const radius = variant === "pill" ? "rounded-full" : "rounded-md";

  return (
    <div className="relative shrink-0">
      <AnimatePresence initial={false}>
        {active && !(motionTransition && !multiple) ? (
          <motion.span
            key="indicator"
            data-tabs-indicator=""
            layoutId={multiple ? undefined : layoutId}
            layout={!multiple}
            initial={multiple && !reduce ? { scale: 0.72, opacity: 0 } : undefined}
            animate={multiple ? { scale: 1, opacity: 1 } : undefined}
            exit={multiple && !reduce ? { scale: 0.72, opacity: 0 } : undefined}
            transition={multiple ? reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 19, mass: 0.65 } : reduce ? { duration: 0 } : motionTransition}
            style={{ borderRadius: variant === "pill" ? 9999 : 8 }}
            className={cn(
              "absolute inset-0 bg-[var(--palette-perceptual03)] dark:bg-[var(--palette-perceptual06)]",
              radius,
              indicatorClassName,
            )}
          />
        ) : null}
      </AnimatePresence>
      <motion.button
        type="button"
        disabled={disabled}
        role={multiple ? undefined : "tab"}
        aria-label={ariaLabel}
        id={tabId}
        aria-controls={multiple ? undefined : panelId}
        aria-selected={multiple ? undefined : active}
        aria-pressed={multiple ? active : undefined}
        tabIndex={multiple || active ? 0 : -1}
        onKeyDown={handleKeyDown}
        data-tabs-value={value}
        data-tabs-active={active || undefined}
        onClick={() => setValue(value)}
        whileTap={multiple && !reduce ? { scale: 0.93 } : undefined}
        transition={multiple ? reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 19, mass: 0.65 } : undefined}
        className={cn(
          "relative z-10 cursor-pointer inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none disabled:opacity-40 disabled:cursor-default",
          "text-[var(--palette-perceptual04)] hover:text-[var(--palette-perceptual02)] dark:text-[var(--palette-perceptual05)] dark:hover:text-[var(--palette-perceptual07)]",
          radius,
          className,
        )}
      >
        {children}
        <span
          data-tabs-label=""
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-[var(--palette-perceptual07)] [gap:inherit] [padding:inherit] dark:text-[var(--palette-perceptual03)]"
          style={{ clipPath: initialClip }}
        >
          {children}
        </span>
      </motion.button>
    </div>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: current, layoutId } = useTabs();
  const reduce = useReducedMotion();
  const active = current === value;
  if (!active) {
    return (
      <div id={`${layoutId}-${value}-panel`} role="tabpanel" aria-labelledby={`${layoutId}-${value}-tab`} hidden className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      key={value}
      id={`${layoutId}-${value}-panel`}
      role="tabpanel"
      aria-labelledby={`${layoutId}-${value}-tab`}
      tabIndex={0}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className={cn("mt-4", className)}
    >
      {children}
    </motion.div>
  );
}
