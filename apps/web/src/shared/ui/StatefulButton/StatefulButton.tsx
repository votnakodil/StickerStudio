"use client";
import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps, type Variants, } from "motion/react";
import { forwardRef, type ReactNode, useLayoutEffect, useRef, useState, } from "react";
import { EASE_OUT, SPRING_SWAP } from "@/shared/lib/motion";
import { TEXT_SWAP_STAGGER as CASCADE_STAGGER, TEXT_SWAP_VARIANTS as CASCADE_LETTER_VARIANTS } from "@/shared/lib/motion/textMotion";
import { Button, type ButtonProps } from "@/shared/ui/Button/Button";
export type ButtonState = "idle" | "loading" | "success" | "error";
export interface StatefulButtonProps extends Omit<ButtonProps, "children"> {
    state?: ButtonState;
    children: ReactNode;
    loadingText?: ReactNode;
    successText?: ReactNode;
    successIcon?: ReactNode;
    errorText?: ReactNode;
    icon?: ReactNode;
    iconWidth?: number;
    textAnimate?: HTMLMotionProps<"span">["animate"];
}
const ROLL_BLUR = "blur(6px)";
const ICON_VARIANTS: Variants = {
    initial: { opacity: 0, width: 0, scale: 0.7, filter: ROLL_BLUR },
    animate: (width: number = 24) => ({
        opacity: 1,
        width,
        scale: 1,
        filter: "blur(0px)",
        transition: SPRING_SWAP,
    }),
    exit: {
        opacity: 0,
        width: 0,
        scale: 0.7,
        filter: ROLL_BLUR,
        transition: { duration: 0.16, ease: EASE_OUT },
    },
};
function IconSlot({ keyId, children, width = 24 }: {
    keyId: string;
    children: ReactNode;
    width?: number;
}) {
    const reduce = useReducedMotion();
    return (<motion.span key={keyId} custom={width} variants={ICON_VARIANTS} initial={reduce ? { opacity: 0 } : "initial"} animate={reduce ? { opacity: 1, width } : "animate"} exit={reduce ? { opacity: 0 } : "exit"} transition={reduce ? { duration: 0.15 } : undefined} className="inline-grid shrink-0 place-items-center overflow-hidden">
      {children}
    </motion.span>);
}
function TextSlot({ value, children, }: {
    value: string;
    children: ReactNode;
}) {
    const reduce = useReducedMotion();
    const measureRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState<number>();
    const label = typeof children === "string" ? children : null;
    const cascade = label !== null && !reduce;
    useLayoutEffect(() => {
        const element = measureRef.current;
        if (!element)
            return;
        const measure = () => {
            const nextWidth = element.offsetWidth;
            if (nextWidth)
                setWidth((current) => (current === nextWidth ? current : nextWidth));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [children, cascade, label]);
    return (<motion.span initial={false} animate={{ width }} transition={reduce ? { duration: 0 } : SPRING_SWAP} className="relative inline-block overflow-hidden whitespace-nowrap align-bottom">
      <span ref={measureRef} aria-hidden className="invisible inline-block whitespace-nowrap">
        {cascade
            ? label.split("").map((char, index) => (<span key={index} className="inline-block whitespace-pre">
                {char}
              </span>))
            : children}
      </span>

      {cascade ? (<>
          <span className="sr-only">{label}</span>
          <AnimatePresence initial={false}>
            <motion.span key={`cascade-${value}`} aria-hidden initial="initial" animate="animate" exit="exit" className="absolute left-0 top-0 inline-block whitespace-pre">
              {label.split("").map((char, index) => (<motion.span key={index} custom={index * CASCADE_STAGGER} variants={CASCADE_LETTER_VARIANTS} className="inline-block whitespace-pre will-change-[opacity,filter,transform]">
                  {char}
                </motion.span>))}
            </motion.span>
          </AnimatePresence>
        </>) : (<AnimatePresence initial={false}>
          <motion.span key={`text-${value}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: ROLL_BLUR }} animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14, filter: ROLL_BLUR }} transition={reduce ? { duration: 0.15 } : SPRING_SWAP} className="absolute left-0 top-0 inline-block will-change-[opacity,filter,transform]">
            {children}
          </motion.span>
        </AnimatePresence>)}
    </motion.span>);
}
export const StatefulButton = forwardRef<HTMLButtonElement, StatefulButtonProps>(function StatefulButton({ state = "idle", children, loadingText = "Loading", successText = "Done", successIcon, errorText = "Try again", icon, iconWidth = 24, textAnimate, disabled, ...rest }, ref) {
    const isBusy = state === "loading";
    const stateText = state === "loading"
        ? loadingText
        : state === "success"
            ? successText
            : state === "error"
                ? errorText
                : children;
    const textKey = typeof stateText === "string" ? `${state}-${stateText}` : state;
    return (<Button ref={ref} disabled={disabled || isBusy} aria-busy={isBusy} whileHover={undefined} {...rest}>
      <span aria-live="polite" className="relative inline-flex items-center justify-center overflow-hidden">
        <AnimatePresence initial={false}>
          {state === "loading" ? (<IconSlot keyId="loading-icon">
              <Loader2 className="h-4 w-4 animate-spin"/>
            </IconSlot>) : null}
          {state === "success" && successIcon !== null ? (<IconSlot keyId="success-icon">
              {successIcon ?? <Check className="h-4 w-4"/>}
            </IconSlot>) : null}
          {state === "error" ? (<IconSlot keyId="error-icon">
              <X className="h-4 w-4"/>
            </IconSlot>) : null}
        </AnimatePresence>

        <motion.span className="inline-flex" animate={textAnimate}>
          <TextSlot value={textKey}>{stateText}</TextSlot>
        </motion.span>

        <AnimatePresence initial={false}>
          {state === "idle" && icon ? (<IconSlot keyId="idle-icon" width={iconWidth}>{icon}</IconSlot>) : null}
        </AnimatePresence>
      </span>
    </Button>);
});
