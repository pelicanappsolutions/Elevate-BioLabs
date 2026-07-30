"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { FlaskConical, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, ShoppingCart, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/verify-coa", label: "Verify COA" },
  { href: "/compliance", label: "Compliance" },
  { href: "/compliance#about", label: "About" },
];

function CartBadgeCount() {
  const hydrated = useCart((s) => s.hydrated);
  const count = useCart((s) => s.count());

  if (!hydrated || count <= 0) return null;

  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-none text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SearchForm({
  className,
  onSubmitted,
  autoFocus,
}: {
  className?: string;
  onSubmitted?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    onSubmitted?.();
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)} role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search standards, CAS, SKU..."
        aria-label="Search products"
        autoFocus={autoFocus}
        className="pl-9"
      />
    </form>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="relative z-40">
      {/* RUO banner strip */}
      <div className="w-full bg-primary/10 py-1.5 text-center text-xs font-medium text-primary">
        Analytical reference standards for laboratory research — not for human or veterinary use
      </div>

      <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container-tight flex h-16 items-center justify-between gap-4">
          {/* Left: logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2 tap" aria-label="Elevate Bio-Labs home">
            <FlaskConical className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              Elevate Bio-Labs
            </span>
          </Link>

          {/* Center: desktop nav links */}
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right: search (desktop), cart, account */}
          <div className="flex items-center gap-2">
            <SearchForm className="hidden w-56 xl:block" />

            <Link
              href="/cart"
              aria-label="View cart"
              className="tap relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ShoppingCart className="h-5 w-5" />
              <CartBadgeCount />
            </Link>

            {isAuthed ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="tap hidden h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </Link>
                )}
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  className="hidden sm:inline-flex"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="tap hidden h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                >
                  <User className="h-4 w-4" />
                  Login
                </Link>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/register">Sign up</Link>
                </Button>
              </>
            )}

            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[85vw] flex-col gap-6 sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    Elevate Bio-Labs
                  </SheetTitle>
                </SheetHeader>

                <SearchForm onSubmitted={() => setMobileOpen(false)} />

                <nav className="flex flex-col gap-1" aria-label="Mobile primary">
                  {NAV_LINKS.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        className="tap flex items-center rounded-lg px-3 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                  {isAuthed ? (
                    <>
                      {isAdmin && (
                        <SheetClose asChild>
                          <Link
                            href="/admin"
                            className="tap flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Admin
                          </Link>
                        </SheetClose>
                      )}
                      <SheetClose asChild>
                        <Button asChild>
                          <Link href="/dashboard">Dashboard</Link>
                        </Button>
                      </SheetClose>
                      <Button
                        variant="outline"
                        onClick={() => signOut({ callbackUrl: "/" })}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </Button>
                    </>
                  ) : (
                    <>
                      <SheetClose asChild>
                        <Link
                          href="/login"
                          className="tap flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <User className="h-4 w-4" />
                          Login
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button asChild>
                          <Link href="/register">Sign up</Link>
                        </Button>
                      </SheetClose>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </div>
  );
}
