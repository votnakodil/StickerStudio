"use client";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion, useTransform } from "motion/react";
import { CloseButton } from "@/shared/ui/CloseButton/CloseButton";
import { motionTokens } from "@/shared/lib/motion";
import styles from "./BottomSheet.module.css";
export interface BottomSheetProps {
    trigger?: ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: string;
    description?: string;
    descriptionClassName?: string;
    dimBackdrop?: boolean;
    detents?: number[];
    initialDetent?: number;
    onDetentChange?: (index: number) => void;
    closeLabel?: string;
    className?: string;
    children: ReactNode;
}
const HeaderActionContext = createContext<HTMLDivElement | null>(null);
export function BottomSheetHeaderAction({ children }: { children: ReactNode }) {
    const target = useContext(HeaderActionContext);
    return target ? createPortal(children, target) : null;
}
type Stop = number | "closed";
type Drag = {
    startY: number;
    origin: number;
    from: number;
    moved: boolean;
    samples: {
        t: number;
        y: number;
    }[];
};
const EXTENSION = 160;
const CLOSED_GAP = 40;
const PROJECTION = .2;
const FLICK = 320;
const STRETCH = 120;
const LOW_DIM = .78;
const settle = motionTokens.spring.smooth;
const enter = { ...motionTokens.spring.morph, visualDuration: .32, bounce: .32 };
const leave = { ...motionTokens.spring.smooth, visualDuration: .3 };
const fade = { duration: motionTokens.duration.fast, ease: "linear" } as const;
const rubber = (distance: number) => (1 - 1 / (distance * .55 / STRETCH + 1)) * STRETCH;
const unrubber = (stretch: number) => (1 / (1 - Math.min(stretch, STRETCH - 1) / STRETCH) - 1) * STRETCH / .55;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function velocityOf(samples: Drag["samples"], now: number) {
    const recent = samples.filter(sample => now - sample.t <= 80);
    const first = recent[0], last = recent[recent.length - 1];
    if (!first || !last || last === first || now - last.t > 60)
        return 0;
    return (last.y - first.y) / ((last.t - first.t) / 1000);
}
export function BottomSheet({ trigger, open: openProp, defaultOpen = false, onOpenChange, ...props }: BottomSheetProps) {
    const [uncontrolled, setUncontrolled] = useState(defaultOpen);
    const open = openProp ?? uncontrolled;
    const setOpen = useCallback((next: boolean) => {
        if (openProp === undefined)
            setUncontrolled(next);
        onOpenChange?.(next);
    }, [openProp, onOpenChange]);
    const dismiss = useCallback(() => setOpen(false), [setOpen]);
    return <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
    {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
    
    <AnimatePresence>{open && <DialogPrimitive.Portal key="sheet" forceMount><Sheet {...props} onDismiss={dismiss}/></DialogPrimitive.Portal>}</AnimatePresence>
  </DialogPrimitive.Root>;
}
function Sheet({ title, description, descriptionClassName, dimBackdrop = true, detents = [.45, .92], initialDetent = 0, onDetentChange, closeLabel = "Close", className, children, onDismiss }: Omit<BottomSheetProps, "trigger" | "open" | "defaultOpen" | "onOpenChange"> & {
    onDismiss: () => void;
}) {
    const [headerAction, setHeaderAction] = useState<HTMLDivElement | null>(null);
    const [isPresent, safeToRemove] = usePresence();
    const reduced = useReducedMotion() ?? false;
    const detentKey = detents.join(",");
    const stops = useMemo(() => detentKey.split(",").map(Number).filter(stop => stop > 0).sort((a, b) => a - b), [detentKey]);
    const top = stops.length - 1;
    const [detent, setDetent] = useState(() => clamp(Math.round(initialDetent), 0, top));
    const [announcement, setAnnouncement] = useState("");
    const sheetRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const y = useMotionValue(4000);
    const height = useMotionValue(0);
    const presence = useMotionValue(1);
    const detentRef = useRef(detent);
    const aim = useRef<Stop>(detent);
    const drag = useRef<Drag | null>(null);
    const arrive = useRef<(() => void) | undefined>(undefined);
    const suppressClick = useRef(false);
    const mounted = useRef(false);
    const presenceChange = useRef({ present: isPresent, at: 0 });
    useLayoutEffect(() => { presenceChange.current = { present: isPresent, at: performance.now() }; }, [isPresent]);
    const offset = useCallback((stop: Stop) => {
        const full = height.get();
        return stop === "closed" ? full + CLOSED_GAP : full * (1 - stops[stop] / stops[top]);
    }, [height, stops, top]);
    const backdrop = useTransform([y, height, presence], ([offsetY, full, shown]: number[]) => {
        if (!full)
            return 0;
        const low = full * (1 - stops[0] / stops[top]), closed = full + CLOSED_GAP;
        const dim = offsetY <= low ? 1 - (1 - LOW_DIM) * (low ? offsetY / low : 0) : LOW_DIM * (1 - (offsetY - low) / (closed - low));
        return clamp(dim, 0, 1) * shown;
    });
    const go = useCallback((stop: Stop, velocity?: number, onArrive?: () => void, entering = false) => {
        aim.current = stop;
        arrive.current = onArrive;
        const target = offset(stop);
        const done = () => { const callback = arrive.current; arrive.current = undefined; callback?.(); };
        if (reduced) {
            y.jump(target);
            done();
            return;
        }
        animate(y, target, { ...(stop === "closed" ? leave : entering ? enter : settle), ...(velocity === undefined ? {} : { velocity }), onComplete: done });
    }, [offset, reduced, y]);
    const rest = useCallback((stop: number, velocity?: number) => {
        if (stop !== detentRef.current) {
            detentRef.current = stop;
            setDetent(stop);
            onDetentChange?.(stop);
            setAnnouncement(stop === top ? "Sheet expanded" : stop === 0 ? "Sheet collapsed" : `Sheet at ${Math.round(stops[stop] * 100)} percent height`);
        }
        const body = bodyRef.current;
        if (stop !== top && body && body.scrollTop > 0)
            body.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        go(stop, velocity);
    }, [go, onDetentChange, reduced, stops, top]);
    useLayoutEffect(() => {
        const sheet = sheetRef.current;
        if (!sheet)
            return;
        if (!mounted.current) {
            mounted.current = true;
            height.set(sheet.offsetHeight - EXTENSION);
            y.jump(offset("closed"));
            if (reduced) {
                y.jump(offset(detentRef.current));
                presence.jump(0);
            }
        }
        if (isPresent) {
            if (reduced) {
                y.jump(offset(detentRef.current));
                animate(presence, 1, fade);
                return;
            }
            presence.jump(1);
            go(detentRef.current, undefined, undefined, true);
            return;
        }
        if (reduced) {
            animate(presence, 0, { ...fade, onComplete: safeToRemove });
            return;
        }
        if (aim.current === "closed" && y.isAnimating())
            arrive.current = safeToRemove;
        else
            go("closed", undefined, safeToRemove);
    }, [go, height, isPresent, offset, presence, reduced, safeToRemove, y]);
    useEffect(() => {
        const sheet = sheetRef.current;
        if (!sheet || typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(() => {
            const next = sheet.offsetHeight - EXTENSION;
            if (next === height.get())
                return;
            height.set(next);
            const stop = aim.current;
            if (drag.current || stop === "closed")
                return;
            if (y.isAnimating())
                go(stop);
            else
                y.jump(offset(stop));
        });
        observer.observe(sheet);
        return () => observer.disconnect();
    }, [go, height, offset, y]);
    const beginDrag = useCallback((clientY: number, time: number) => {
        y.stop();
        const current = y.get();
        drag.current = { startY: clientY, origin: current < 0 ? -unrubber(-current) : current, from: detentRef.current, moved: false, samples: [{ t: time, y: clientY }] };
    }, [y]);
    const moveDrag = useCallback((clientY: number, time: number) => {
        const state = drag.current;
        if (!state)
            return;
        const delta = clientY - state.startY;
        if (!state.moved) {
            if (Math.abs(delta) < 3)
                return;
            state.moved = true;
            sheetRef.current?.setAttribute("data-dragging", "");
        }
        const raw = state.origin + delta;
        y.set(raw < 0 ? -rubber(-raw) : raw);
        state.samples.push({ t: time, y: clientY });
        if (state.samples.length > 12)
            state.samples.shift();
    }, [y]);
    const endDrag = useCallback((time: number) => {
        const state = drag.current;
        drag.current = null;
        sheetRef.current?.removeAttribute("data-dragging");
        if (!state)
            return;
        if (!state.moved) {
            const stop = aim.current;
            if (stop !== "closed")
                go(stop);
            return;
        }
        suppressClick.current = true;
        const current = y.get();
        const velocity = current < 0 ? 0 : velocityOf(state.samples, time);
        const projected = current + velocity * PROJECTION;
        const candidates: Stop[] = [...stops.map((_, index) => index), "closed"];
        let target = candidates.reduce((best, stop) => Math.abs(offset(stop) - projected) < Math.abs(offset(best) - projected) ? stop : best);
        if (Math.abs(velocity) > FLICK && target === state.from)
            target = velocity < 0 ? Math.min(state.from + 1, top) : state.from === 0 ? "closed" : state.from - 1;
        if (target === "closed") {
            if (!reduced)
                go("closed", velocity);
            onDismiss();
            return;
        }
        rest(target, velocity);
    }, [go, offset, onDismiss, reduced, rest, stops, top, y]);
    useEffect(() => {
        const body = bodyRef.current;
        if (!body)
            return;
        let gesture: {
            x: number;
            y: number;
            mode: "pending" | "sheet" | "native";
        } | null = null;
        const start = (event: TouchEvent) => {
            const touch = event.touches[0];
            gesture = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY, mode: "pending" } : null;
        };
        const move = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!gesture || !touch || event.touches.length !== 1)
                return;
            const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
            if (gesture.mode === "pending") {
                const expanded = detentRef.current === top;
                if (expanded) {
                    const scrollable = body.scrollHeight > body.clientHeight + 1;
                    gesture.mode = Math.abs(dy) >= Math.abs(dx) && (!scrollable || (body.scrollTop <= 0 && dy > 0)) ? "sheet" : "native";
                }
                else {
                    if (Math.hypot(dx, dy) < 4)
                        return;
                    gesture.mode = Math.abs(dy) >= Math.abs(dx) ? "sheet" : "native";
                }
                if (gesture.mode === "sheet")
                    beginDrag(touch.clientY, event.timeStamp);
            }
            if (gesture.mode !== "sheet")
                return;
            if (event.cancelable)
                event.preventDefault();
            moveDrag(touch.clientY, event.timeStamp);
        };
        const end = (event: TouchEvent) => {
            if (gesture?.mode === "sheet")
                endDrag(event.timeStamp);
            gesture = null;
        };
        body.addEventListener("touchstart", start, { passive: true });
        body.addEventListener("touchmove", move, { passive: false });
        body.addEventListener("touchend", end);
        body.addEventListener("touchcancel", end);
        return () => {
            body.removeEventListener("touchstart", start);
            body.removeEventListener("touchmove", move);
            body.removeEventListener("touchend", end);
            body.removeEventListener("touchcancel", end);
        };
    }, [beginDrag, endDrag, moveDrag, top]);
    useEffect(() => {
        const body = bodyRef.current, sheet = sheetRef.current;
        if (!body || !sheet)
            return;
        const update = () => sheet.toggleAttribute("data-scrolled", body.scrollTop > 1);
        body.addEventListener("scroll", update, { passive: true });
        return () => body.removeEventListener("scroll", update);
    }, []);
    function headerDown(event: ReactPointerEvent<HTMLDivElement>) {
        const target = event.target instanceof Element ? event.target : null;
        if (event.button !== 0 || !event.isPrimary)
            return;
        if (target?.closest("button, a, input, select, textarea, [role='button']") && !target.closest("[data-grabber]"))
            return;
        beginDrag(event.clientY, event.timeStamp);
        const header = event.currentTarget, id = event.pointerId;
        const outside = (next: PointerEvent) => next.pointerId === id && !(next.target instanceof Node && header.contains(next.target));
        const move = (next: PointerEvent) => {
            if (!outside(next) || !drag.current)
                return;
            moveDrag(next.clientY, next.timeStamp);
            if (drag.current?.moved && !header.hasPointerCapture(id)) {
                try {
                    header.setPointerCapture(id);
                }
                catch {
                    return;
                }
            }
        };
        const up = (next: PointerEvent) => {
            if (next.pointerId !== id)
                return;
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            if (outside(next))
                endDrag(next.timeStamp);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    }
    function headerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!drag.current)
            return;
        if (event.pointerType === "mouse" && event.buttons === 0) {
            endDrag(event.timeStamp);
            return;
        }
        moveDrag(event.clientY, event.timeStamp);
        if (drag.current.moved && !event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.setPointerCapture(event.pointerId);
    }
    function headerUp(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        endDrag(event.timeStamp);
    }
    function grabberClick() {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
        rest(detentRef.current === top ? 0 : top);
    }
    function grabberKey(event: KeyboardEvent<HTMLButtonElement>) {
        const current = detentRef.current;
        const next = event.key === "ArrowUp" ? Math.min(current + 1, top) : event.key === "ArrowDown" ? Math.max(current - 1, 0) : event.key === "Home" ? top : event.key === "End" ? 0 : null;
        if (next === null)
            return;
        event.preventDefault();
        rest(next);
    }
    function bodyWheel(event: WheelEvent<HTMLDivElement>) {
        if (detentRef.current !== top && event.deltaY > 4 && !drag.current)
            rest(top);
    }
    function bodyFocus(event: FocusEvent<HTMLDivElement>) {
        if (detentRef.current === top || !(event.target instanceof Element))
            return;
        if (event.target.getBoundingClientRect().bottom > window.innerHeight - 8)
            rest(top);
    }
    function sheetKey(event: KeyboardEvent<HTMLDivElement>) {
        const body = bodyRef.current;
        if (!body || (event.target !== event.currentTarget && event.target !== body))
            return;
        const down = event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey);
        const up = event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey);
        if (!down && !up)
            return;
        event.preventDefault();
        if (down && detentRef.current !== top) {
            rest(top);
            return;
        }
        const step = event.key.startsWith("Arrow") ? 48 : body.clientHeight * .85;
        body.scrollBy({ top: down ? step : -step, behavior: reduced ? "auto" : "smooth" });
    }
    const expanded = detent === top;
    const style = { y, opacity: presence, "--sheet-max": stops[top], "--sheet-extension": `${EXTENSION}px` } as unknown as CSSProperties;
    return <HeaderActionContext.Provider value={headerAction}>
    <DialogPrimitive.Overlay asChild forceMount>
      <motion.div className={styles.overlay} style={{ opacity: dimBackdrop ? backdrop : 0 }}/>
    </DialogPrimitive.Overlay>
    <DialogPrimitive.Content asChild forceMount {...(description ? {} : { "aria-describedby": undefined })} onEscapeKeyDown={event => event.stopPropagation()} onOpenAutoFocus={event => { event.preventDefault(); sheetRef.current?.focus({ preventScroll: true }); }} onPointerDownOutside={event => { const { present, at } = presenceChange.current; if (!present || event.detail.originalEvent.timeStamp < at)
        event.preventDefault(); }}>
      <motion.div ref={sheetRef} className={[styles.sheet, className].filter(Boolean).join(" ")} style={style} data-expanded={expanded ? "" : undefined} onKeyDown={sheetKey}>
        <div className={styles.header} onPointerDown={headerDown} onPointerMove={headerMove} onPointerUp={headerUp} onPointerCancel={headerUp}>
          <button type="button" className={styles.grabber} data-grabber="" aria-label={expanded ? "Collapse sheet" : "Expand sheet"} aria-expanded={expanded} onClick={grabberClick} onKeyDown={grabberKey}>
            <span className={styles.grabberBar} aria-hidden="true"/>
          </button>
          <div className={styles.headRow}>
            <div ref={setHeaderAction} className={styles.headerAction}/>
            <div className={styles.headText}>
              <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className={[styles.description, descriptionClassName].filter(Boolean).join(" ")}>{description}</DialogPrimitive.Description> : null}
            </div>
            <DialogPrimitive.Close asChild>
              <CloseButton aria-label={closeLabel}/>
            </DialogPrimitive.Close>
          </div>
        </div>
        <div ref={bodyRef} className={styles.body} onWheel={bodyWheel} onFocus={bodyFocus}>{children}</div>
        <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
      </motion.div>
    </DialogPrimitive.Content>
  </HeaderActionContext.Provider>;
}
export const BottomSheetClose = DialogPrimitive.Close;
export default BottomSheet;
