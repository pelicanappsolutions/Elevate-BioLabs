"use client";

import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";

/** Digits-only phone formatter → "(512) 555-1234". Stores the formatted string;
 *  validation strips non-digits and checks for 10 digits. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const NAV_KEYS = new Set([
  "Backspace", "Delete", "Tab", "Escape", "Enter",
  "ArrowLeft", "ArrowRight", "Home", "End",
]);

export interface PhoneInputProps
  extends Omit<InputProps, "type" | "onChange" | "value" | "inputMode"> {
  value: string;
  onChange: (value: string) => void;
}

/** Phone field that blocks non-digit keystrokes and auto-formats as US phone. */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, onKeyDown, onPaste, ...props }, ref) => {
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (NAV_KEYS.has(e.key)) return;
      if (/^[0-9]$/.test(e.key)) return;
      e.preventDefault();
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      onPaste?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      onChange(formatPhone(e.clipboardData.getData("text")));
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="tel"
        placeholder="(555) 123-4567"
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
