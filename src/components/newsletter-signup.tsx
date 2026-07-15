"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";

import { subscribeNewsletter } from "@/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export function NewsletterSignup({
  className,
  source = "footer",
}: {
  className?: string;
  source?: string;
}) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setPending(true);
    try {
      const result = await subscribeNewsletter({ email: email.trim(), source });
      if (result.ok) {
        toast({
          title: "You're subscribed",
          description: "Watch your inbox for research updates and COA releases.",
        });
        setEmail("");
      } else {
        toast({
          title: "Couldn't subscribe",
          description: result.error ?? "Please try again in a moment.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't subscribe",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex w-full max-w-sm flex-col gap-2 sm:flex-row", className)}
    >
      <div className="relative flex-1">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@lab.com"
          aria-label="Email address"
          className="pl-9"
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Subscribe
      </Button>
    </form>
  );
}

export default NewsletterSignup;
