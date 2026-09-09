/**
 * The padlock at the top of the sign-in form.
 *
 * It is the one moving thing on the login page, and it moves because it is
 * reporting: hanging open until you touch the password field, seated shut and
 * ticking a tumbler per keystroke while you type, dial spinning while the
 * server decides, springing open on the way to the dashboard, rattling on a
 * bad password. The role icon sits in the lock body so it also says which of
 * the four portals you are standing at.
 *
 * All the animation lives in index.css, keyed off `data-state`. This file is
 * geometry plus one prop.
 */
import type { ElementType } from "react";

export type CrestState = "idle" | "locked" | "busy" | "open" | "denied";

interface PortalCrestProps {
  state: CrestState;
  /** Role icon shown inside the lock body (Crown, ShieldCheck, Users, UserRound). */
  icon: ElementType;
  /**
   * Bumped on every password keystroke. It is used as a React key so the
   * tumbler node remounts and replays its animation — a CSS animation only
   * fires once per mount, so re-triggering it any other way needs a timer.
   */
  tick?: number;
}

/** Dial ticks at twelve positions, drawn once and rotated into place. */
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

export function PortalCrest({ state, icon: Icon, tick = 0 }: PortalCrestProps) {
  return (
    <div
      className="crest"
      data-state={state}
      role="img"
      aria-label={
        state === "open"
          ? "Signed in"
          : state === "denied"
            ? "Sign-in failed"
            : state === "busy"
              ? "Signing in"
              : "Secure portal sign-in"
      }
    >
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle className="crest__ring" cx="48" cy="48" r="42" />

        {/* Remounted per keystroke — see `tick`. */}
        <g key={tick} className={tick > 0 ? "crest__ticks crest__tick-pulse" : "crest__ticks"}>
          {TICKS.map((deg) => (
            <line
              key={deg}
              x1="48"
              y1="2"
              x2="48"
              y2="8"
              transform={`rotate(${deg} 48 48)`}
            />
          ))}
        </g>

        {/* Progress arc: same radius as the ring, so it reads as the dial
            turning rather than a second ring appearing. */}
        <circle className="crest__arc" cx="48" cy="48" r="42" />

        <path className="crest__shackle" d="M34 50 V40 a14 14 0 0 1 28 0 V50" />
        <rect className="crest__body" x="26" y="48" width="44" height="30" rx="8" />
      </svg>

      <span className="crest__badge">
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}
