"use client";

import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";

export interface NumericInputProps
  extends Omit<InputProps, "type" | "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /** Allow a single decimal point. Default true. */
  allowDecimal?: boolean;
  /** Allow a leading minus sign. Default false — most quantities/prices here can't go negative. */
  allowNegative?: boolean;
}

const NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function sanitize(raw: string, allowDecimal: boolean, allowNegative: boolean) {
  let negative = false;
  let s = raw;
  if (allowNegative && s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (allowDecimal) {
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  return negative ? `-${s}` : s;
}

/**
 * A number-shaped text input that blocks invalid keystrokes and pastes at the
 * character level, rather than relying on <input type="number"> — which
 * still happily accepts "e", "+", stray "-", and multiple ".", and silently
 * clears on some invalid states across browsers.
 */
const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChange,
      allowDecimal = true,
      allowNegative = false,
      onKeyDown,
      onPaste,
      inputMode,
      ...props
    },
    ref
  ) => {
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // shortcuts (copy/paste/select-all/etc.)
      if (NAV_KEYS.has(e.key)) return;
      if (/^[0-9]$/.test(e.key)) return;
      if (allowDecimal && e.key === "." && !value.includes(".")) return;
      if (
        allowNegative &&
        e.key === "-" &&
        value === "" &&
        e.currentTarget.selectionStart === 0
      ) {
        return;
      }
      e.preventDefault();
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      onPaste?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart ?? value.length;
      const end = target.selectionEnd ?? value.length;
      const pasted = sanitize(
        e.clipboardData.getData("text"),
        allowDecimal,
        allowNegative
      );
      onChange(value.slice(0, start) + pasted + value.slice(end));
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode ?? (allowDecimal ? "decimal" : "numeric")}
        value={value}
        onChange={(e) => onChange(sanitize(e.target.value, allowDecimal, allowNegative))}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        {...props}
      />
    );
  }
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
