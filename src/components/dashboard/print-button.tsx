"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog — users "Save as PDF" from there, so no
 *  server-side PDF dependency is needed. Hidden from the printout itself. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="mr-1.5 h-3.5 w-3.5" />
      Print / Save as PDF
    </Button>
  );
}

export default PrintButton;
