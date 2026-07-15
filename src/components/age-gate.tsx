"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STORAGE_KEY = "ebl-age-ok";

export function AgeGate() {
  // Default to enabled unless explicitly disabled via env.
  const enabled = process.env.NEXT_PUBLIC_AGE_GATE !== "false";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    try {
      const ok = window.localStorage.getItem(STORAGE_KEY);
      if (ok !== "true") {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — err on the side of showing the gate.
      setOpen(true);
    }
  }, [enabled]);

  function handleConfirm() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  function handleExit() {
    window.location.href = "https://www.google.com";
  }

  if (!enabled) return null;

  return (
    <Dialog open={open}>
      <DialogContent
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md border-primary/30 text-center sm:rounded-lg"
      >
        <DialogHeader className="items-center text-center">
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FlaskConical className="h-7 w-7 text-primary" aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl">Are you 18 or older?</DialogTitle>
          <DialogDescription className="text-balance">
            These products are For Research Use Only (RUO) and are not intended for human
            consumption, diagnostic, or therapeutic use. By entering, you confirm you are at
            least 18 years old and a qualified researcher or purchaser for lawful research
            purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={handleExit} className="sm:flex-1">
            Exit
          </Button>
          <Button onClick={handleConfirm} className="sm:flex-1">
            I am 18+
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AgeGate;
