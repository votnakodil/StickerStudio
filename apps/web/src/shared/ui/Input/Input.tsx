"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/classNames";

export type InputClassNames = {
  root?: string;
  label?: string;
  field?: string;
  input?: string;
  leftIcon?: string;
  rightIcon?: string;
  successIcon?: string;
  errorMessage?: string;
};

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> {
  label?: string;
  appearance?: "default" | "auth";
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;

  error?: string | boolean;

  onLimitReached?: () => void;
  reserveErrorLine?: boolean;
  success?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  classNames?: InputClassNames;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    appearance = "default",
    value: valueProp,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    onBeforeInput,
    onPaste,
    maxLength,
    onLimitReached,
    error,
    reserveErrorLine = false,
    success,
    leftIcon,
    rightIcon,
    className,
    classNames,
    disabled,
    id: idProp,
    type,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const reduce = useReducedMotion();

  const controlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const value = controlled ? (valueProp ?? "") : internal;

  const [focused, setFocused] = useState(false);

  const fieldRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [limitAttempt, setLimitAttempt] = useState(0);

  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : null;

  const rightSlot = success ? null : rightIcon;

  useEffect(() => {
    if (!fieldRef.current || reduce || !hasError) return;
    animate(
      fieldRef.current,
      { x: [0, -6, 6, -4, 4, -2, 0] },
      { duration: 0.45 },
    );
    if (limitAttempt && errorRef.current) {
      animate(errorRef.current, { scale: [1, 1.04, 1] }, { duration: 0.3 });
    }
  }, [hasError, limitAttempt, reduce]);

  const notifyLimit = () => {
    setLimitAttempt(previous => previous + 1);
    onLimitReached?.();
  };

  const exceedsLimit = (input: HTMLInputElement, text: string) => maxLength !== undefined &&
    input.value.length - ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0)) + text.length > maxLength;

  const handleChange = (next: string) => {
    if (maxLength !== undefined && next.length > maxLength) {
      next = next.slice(0, maxLength);
      notifyLimit();
    }
    if (!controlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div
      className={cn("flex flex-col gap-1.5", className, classNames?.root)}
    >
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            "px-1 text-sm font-medium text-foreground",
            classNames?.label,
          )}
        >
          {label}
        </label>
      ) : null}

      <div
        ref={fieldRef}
        data-state={
          hasError
            ? "error"
            : success
              ? "success"
              : focused
                ? "focused"
                : "idle"
        }
        className={cn(
          "relative h-11 overflow-hidden rounded-full border transition-colors duration-200",
          "border-border",
          appearance === "auth" && "h-14 bg-(--auth-field)",
          focused && !hasError && "border-foreground/40 ring-2 ring-ring/40",
          hasError && "border-destructive ring-2 ring-destructive/25",
          disabled && "opacity-60",
          classNames?.field,
        )}
      >
        {leftIcon ? (
          <span
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4",
              classNames?.leftIcon,
            )}
          >
            {leftIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={hasError || undefined}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          {...rest}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={event => {
            onKeyDown?.(event);
            if (!event.defaultPrevented && !event.nativeEvent.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && exceedsLimit(event.currentTarget, event.key)) {
              event.preventDefault();
              notifyLimit();
            }
          }}
          onBeforeInput={event => {
            onBeforeInput?.(event);
            const text = (event.nativeEvent as InputEvent).data;
            if (!event.defaultPrevented && text && exceedsLimit(event.currentTarget, text)) {
              event.preventDefault();
              notifyLimit();
            }
          }}
          onPaste={event => {
            onPaste?.(event);
            if (!event.defaultPrevented && exceedsLimit(event.currentTarget, event.clipboardData.getData('text'))) notifyLimit();
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          className={cn(
            "peer h-full w-full bg-transparent text-base leading-6 text-foreground caret-foreground outline-none",
            "placeholder:text-muted-foreground/60",
            leftIcon ? "pl-10" : "pl-3.5",
            rightSlot || success ? "pr-10" : "pr-3.5",
            disabled && "cursor-not-allowed",
            classNames?.input,
          )}
        />

        {success ? (
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn(
              "absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-success)",
              classNames?.successIcon,
            )}
          >
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </motion.svg>
        ) : rightSlot ? (
          <span
            className={cn(
              "absolute right-0 top-0 flex h-full items-center text-muted-foreground [&_button]:grid [&_button]:size-11 [&_button]:place-items-center [&_svg]:h-4 [&_svg]:w-4",
              classNames?.rightIcon,
            )}
          >
            {rightSlot}
          </span>
        ) : null}
      </div>

      <div className={reserveErrorLine ? "min-h-4" : "contents"}>
        <AnimatePresence initial={false}>
          {errorMessage ? (
            <motion.p
              ref={errorRef}
              style={{ transformOrigin: "left center" }}
              id={`${id}-error`}
              role="alert"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, filter: "blur(4px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, filter: "blur(4px)" }
              }
              transition={{ duration: 0.2 }}
              className={cn(
                "px-1 text-xs text-destructive",
                classNames?.errorMessage,
              )}
            >
              {errorMessage}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
});
