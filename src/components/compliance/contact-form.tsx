"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { submitContact } from "@/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await submitContact({ name, email, message });
      if (!res.ok) {
        setError(res.error ?? "Couldn't send your message.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't send your message. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 text-base font-semibold">Message sent</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks {name.split(" ")[0]} — we&apos;ll reply to {email} within one business
          day.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setSent(false);
            setName("");
            setEmail("");
            setMessage("");
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name" className="text-xs">
            Name
          </Label>
          <Input
            id="contact-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="contact-email" className="text-xs">
            Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="contact-message" className="text-xs">
          Message
        </Label>
        <Textarea
          id="contact-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Include your order number or batch number if your question is about a specific shipment."
          className="mt-1"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="tap">
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Send message
      </Button>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        We cannot answer questions about human dosing, therapeutic use, or medical
        outcomes — our products are supplied For Research Use Only.
      </p>
    </form>
  );
}

export default ContactForm;
