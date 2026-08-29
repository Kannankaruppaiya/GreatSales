/**
 * Skeleton — placeholder block for loading content, so layouts don't jump. The
 * pulse is disabled under the OS "reduce motion" setting via motion-reduce.
 */
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse motion-reduce:animate-none rounded-md bg-skeleton", className)}
    />
  );
}
