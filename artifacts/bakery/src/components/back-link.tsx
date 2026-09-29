import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface BackLinkProps {
  href: string;
  children?: ReactNode;
  className?: string;
  tone?: "default" | "inverse";
  ariaLabel?: string;
  testId?: string;
}

export function BackLink({
  href,
  children,
  className,
  tone = "default",
  ariaLabel,
  testId,
}: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
        tone === "inverse"
          ? "border-white/25 bg-white/10 text-white hover:bg-white/15"
          : "border-border bg-card text-foreground hover:bg-muted",
        !children && "w-12 px-0",
        className,
      )}
      aria-label={ariaLabel ?? (!children ? "Back" : undefined)}
      data-testid={testId}
    >
      <ArrowLeft size={20} aria-hidden="true" />
      {children && <span>{children}</span>}
    </Link>
  );
}