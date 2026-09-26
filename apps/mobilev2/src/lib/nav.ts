/**
 * Leave a screen after its work is done.
 *
 * `router.back()` is a no-op when there is nothing behind the screen — one
 * opened from a notification, a shared link or a reloaded web tab — which left
 * a saved form sitting on screen looking unsaved. Going to the section's list
 * instead is what "back" means there.
 */
import type { Router } from "expo-router";

export function leave(router: Router, fallback: string): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
