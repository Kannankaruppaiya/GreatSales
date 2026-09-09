import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Crown,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth, useLastTenantId } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/config";
import { Button, Input } from "@/components/ui";
import { PortalCrest, type CrestState } from "./PortalCrest";

export type LoginRole = "super_admin" | "admin" | "mgmt" | "sales";

interface RoleConfig {
  id: LoginRole;
  label: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  route: string;
  defaultEmail: string;
  destination: string;
  title: string;
  description: string;
}

const ROLE_CONFIGS: Record<LoginRole, RoleConfig> = {
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    badge: "GLOBAL OWNER",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-300 dark:border-purple-800",
    icon: Crown,
    route: "/super-admin/login",
    defaultEmail: "superadmin@greatsales.in",
    destination: "/managements",
    title: "Super Admin Portal",
    description: "Full multi-tenant authority. Access and oversee all company workspaces and global governance.",
  },
  admin: {
    id: "admin",
    label: "Administrator",
    badge: "TENANT ADMIN",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800",
    icon: ShieldCheck,
    route: "/admin/login",
    defaultEmail: "admin@greatsales.in",
    destination: `/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`,
    title: "Administrator Portal",
    description: "Operational management. Full authority over users, master data, customer assignments, and pipelines.",
  },
  mgmt: {
    id: "mgmt",
    label: "Management",
    badge: "EXECUTIVE VIEW",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-300 dark:border-blue-800",
    icon: Users,
    route: "/management/login",
    defaultEmail: "mgmt@greatsales.in",
    destination: `/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`,
    title: "Management Portal",
    description: "Executive oversight. Real-time dashboards, recurring projection grids, and analytics (Read-Only).",
  },
  sales: {
    id: "sales",
    label: "Salesperson",
    badge: "FIELD SALES",
    badgeColor: "bg-sky-500/10 text-sky-600 border-sky-300 dark:border-sky-800",
    icon: UserRound,
    route: "/sales/login",
    defaultEmail: "sales@greatsales.in",
    destination: `/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`,
    title: "Salesperson Portal",
    description:
      "Your accounts. Recurring projections, new sales pipeline, orders, and collections follow-up.",
  },
};

function resolveRoleFromPath(pathname: string, roleParam?: string): LoginRole {
  if (roleParam === "super-admin" || roleParam === "super_admin" || roleParam === "superadmin") return "super_admin";
  if (roleParam === "sales" || roleParam === "salesperson") return "sales";
  if (roleParam === "admin" || roleParam === "administrator") return "admin";
  if (roleParam === "mgmt" || roleParam === "management" || roleParam === "manager") return "mgmt";

  // Segment-anchored, not a substring `.includes()` — the app has no `base`
  // in vite.config.ts today so `.includes("sales")` would happen to be
  // correct, but it's a latent trap: serving the app under any base path
  // that merely contains "sales" (or "admin"/"management") would make every
  // login URL resolve to that portal. Matching only the first path segment
  // keeps this correct regardless of how the app is deployed.
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  if (firstSegment === "super-admin" || firstSegment === "superadmin") return "super_admin";
  if (firstSegment === "sales") return "sales";
  if (firstSegment === "admin") return "admin";
  if (firstSegment === "management" || firstSegment === "mgmt") return "mgmt";

  return "admin";
}

interface LoginPageProps {
  initialRole?: LoginRole;
}

/** Tab order, shared by the links and by the sliding indicator that has to
 *  know which cell of the 2×2 grid to sit over. */
const TAB_ORDER: LoginRole[] = ["super_admin", "admin", "mgmt", "sales"];

/** Seeded demo logins per web role. These mirror the POC v6 users created by
 *  `packages/db/prisma/seed.ts` (admin / manager / the salespeople). Exported so
 *  a test can check them against the seed instead of a hand-typed expectation. */
export const DEMO_EMAIL_BY_ROLE: Partial<Record<LoginRole, string>> = {
  admin: env.DEMO_EMAIL,
  mgmt: env.DEMO_EMAIL.replace(/^admin@/, "manager@"),
  sales: env.DEMO_EMAIL.replace(/^admin@/, "megala@"),
};

export const DEMO_PASSWORD_BY_ROLE: Partial<Record<LoginRole, string>> = {
  admin: env.DEMO_PASSWORD,
  mgmt: env.DEMO_PASSWORD_STAFF,
  sales: env.DEMO_PASSWORD_STAFF,
};

/**
 * Turn a failure into something the person at the keyboard can act on.
 *
 * The server deliberately answers every bad-credential case with one
 * indistinguishable message, so this must not invent a more specific reason
 * for a 401 — doing so would hand an attacker the account-enumeration signal
 * the API was careful not to give. Only genuinely different outcomes
 * (throttled, locked, unreachable) get their own text.
 */
function describeLoginFailure(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return "That email and password combination is not correct.";
      case 403:
        // Lockout. The server's message already says how to recover.
        return err.message;
      case 429:
        return "Too many sign-in attempts. Please wait a minute and try again.";
      case 400:
        return err.message || "Please check the details you entered.";
      default:
        if (err.status >= 500) {
          return "The server had a problem signing you in. Please try again shortly.";
        }
        return err.message;
    }
  }
  // No HTTP status at all: DNS, offline, CORS, or the API is down.
  return "Could not reach the server. Check your connection and try again.";
}

export default function LoginPage({ initialRole }: LoginPageProps) {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const { roleParam } = useParams<{ roleParam?: string }>();

  const activeRole: LoginRole = initialRole || resolveRoleFromPath(location.pathname, roleParam);
  const config = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.admin;
  const demoEmail = DEMO_EMAIL_BY_ROLE[activeRole] ?? config.defaultEmail;
  const demoPassword = DEMO_PASSWORD_BY_ROLE[activeRole] ?? env.DEMO_PASSWORD;

  // Remembering the workspace is a convenience, not a credential — it saves a
  // returning user retyping an opaque id they did not choose.
  const rememberedTenant = useLastTenantId();

  const [tenantId, setTenantId] = useState(
    rememberedTenant || env.DEMO_TENANT_ID,
  );
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the crest is reporting. `granted` is its own flag rather than a
  // derived value because it has to survive the gap between the token
  // arriving and the route actually changing — that gap is the only moment
  // the lock is seen springing open.
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [granted, setGranted] = useState(false);
  const [tick, setTick] = useState(0);

  const crestState: CrestState = granted
    ? "open"
    : busy
      ? "busy"
      : error
        ? "denied"
        : passwordFocused
          ? "locked"
          : "idle";

  // Update the prefilled credentials when the active role changes
  useEffect(() => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  }, [demoEmail, demoPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole === "super_admin") return;
    // A second submit while the first is in flight would burn one of the five
    // attempts the server allows per minute, for nothing.
    if (busy) return;

    setBusy(true);
    setError(null);

    // Only the call to `login` belongs inside the catch. Anything after it has
    // already succeeded, and reporting a failure there would tell someone their
    // password was wrong when it was not — which is exactly what happened when
    // the celebration pause below was first written inside the try: jsdom has
    // no window.matchMedia, so a successful sign-in surfaced as bad credentials.
    let signedIn = false;
    try {
      await login(tenantId.trim(), email.trim(), password);
      signedIn = true;
    } catch (err) {
      setError(describeLoginFailure(err));
    } finally {
      setBusy(false);
    }
    if (!signedIn) return;

    // Hold the route for as long as the shackle takes to spring open (520ms in
    // index.css), so the one moment the lock is doing its job is not cut off by
    // the dashboard mounting over it. Anyone who asked for reduced motion has
    // no animation to wait for, and environments without matchMedia at all
    // (jsdom) simply do not wait.
    setGranted(true);
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && typeof window.matchMedia === "function") {
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    navigate(config.destination, { replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr] bg-canvas">
      {/* ── Brand Hero Panel ── */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-ink via-slate-900 to-brand-ink lg:flex lg:flex-col lg:justify-between lg:p-14 lg:text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #10b981 0, transparent 50%), radial-gradient(circle at 80% 80%, #047857 0, transparent 40%)",
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-emerald-400 text-white font-black shadow-lg shadow-brand/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight">GreatSales</span>
              <span className="rounded bg-brand/30 border border-brand/40 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300">
                PRO
              </span>
            </div>
            <p className="text-xs text-white/60 font-medium">B2B Distribution Sales &amp; Receivables Intelligence</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative max-w-lg space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Commit. Track. <br />
            <span className="text-emerald-300">Achieve Growth.</span>
          </h1>
          <p className="text-[15px] leading-relaxed text-white/70">
            The unified recurring-sales projection, pipeline acceleration, and receivables platform. One source of truth
            from sales reps in the field to executive leadership.
          </p>

          <div className="grid grid-cols-1 gap-4 pt-2">
            {[
              {
                icon: TrendingUp,
                title: "Spreadsheet Commitment Grids",
                desc: "Inline editable monthly projections with pixel-perfect conversion tracking.",
              },
              {
                icon: BarChart3,
                title: "Pipeline & Fulfillment Stepper",
                desc: "9-stage deal conversion and 6-stage logistics dispatch matrix.",
              },
              {
                icon: ShieldCheck,
                title: "Role-Aware Multi-Tenant Control",
                desc: "Dedicated portals for Super Admin, Tenant Administrator, and Executive Management.",
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3.5 rounded-xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/20 text-emerald-400 border border-brand/30">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{f.title}</div>
                  <div className="text-xs text-white/60 leading-normal mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/40 border-t border-white/10 pt-4">
          <span>© 2026 GreatSales Industrial Enterprise</span>
          <span>Version 2.4 PRO · Verified Build</span>
        </div>
      </div>

      {/* ── Form Panel ── */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] space-y-6">

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white font-extrabold shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-ink">GreatSales PRO</div>
              <div className="text-xs text-muted">Distribution Management</div>
            </div>
          </div>

          {/* ── Role Navigation Tabs (Direct URL routes) ── */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-2">
              Select Portal URL
            </label>
            <div className="portal-tabs grid grid-cols-2 gap-1.5 p-1 bg-surface-2 rounded-xl border border-line">
              {/* One thumb that slides between the four cells, rather than
                  four backgrounds switching on and off. The grid is 2×2, so
                  column is index % 2 and row is index / 2. */}
              <span
                className="portal-tabs__thumb"
                aria-hidden="true"
                style={{
                  transform: `translate(${TAB_ORDER.indexOf(activeRole) % 2 ? "calc(100% + 6px)" : "0px"}, ${
                    TAB_ORDER.indexOf(activeRole) > 1 ? "calc(100% + 6px)" : "0px"
                  })`,
                  height: "calc(50% - 5px)",
                }}
              />
              {TAB_ORDER.map((rKey) => {
                const rConf = ROLE_CONFIGS[rKey];
                const isActive = activeRole === rKey;
                const Icon = rConf.icon;

                return (
                  <Link
                    key={rKey}
                    to={rConf.route}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative z-10 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors duration-200 ${
                      isActive ? "text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 transition-colors duration-200 ${isActive ? "text-brand" : "text-muted"}`} />
                    <span className="truncate">{rConf.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── Active Portal Header ── */}
          <div className="flex flex-col items-center gap-3 pt-1 text-center">
            <PortalCrest state={crestState} icon={config.icon} tick={tick} />
            <div className="space-y-1.5">
              <h2 className="text-base font-extrabold text-ink font-sans">
                {config.title}
              </h2>
              <span className={`inline-block rounded border px-1.5 py-0.5 text-3xs font-extrabold tracking-wider uppercase ${config.badgeColor}`}>
                {config.badge}
              </span>
            </div>
            <p className="max-w-sm text-xs text-muted leading-relaxed">
              {config.description}
            </p>
          </div>

          {/* ── Active Portal Body ── */}
          {activeRole === "super_admin" ? (
            <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/60 p-5 text-center dark:border-purple-900/40 dark:bg-purple-950/20">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-purple-500/10 text-purple-700">
                <Crown className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-ink">Platform Sign-In Coming Soon</h3>
              <p className="text-xs text-muted leading-relaxed">
                Super Admin uses a dedicated platform sign-in (arriving in Phase 0.5). For now,
                use the Administrator portal.
              </p>
              <Link
                to="/admin/login"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand-ink transition-colors"
              >
                Go to Administrator Portal
              </Link>
            </div>
          ) : (
            /* ── Credential Form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-tenant"
                  className="mb-1.5 block text-xs font-bold text-ink"
                >
                  Tenant ID
                </label>
                <div className="field flex items-stretch overflow-hidden rounded-lg border border-line transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 bg-surface shadow-xs">
                  <span className="field__icon grid place-items-center px-3 text-muted">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input
                    id="login-tenant"
                    name="tenantId"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="h-11 flex-1 bg-surface pr-2 text-xs font-semibold text-ink focus:outline-none"
                    placeholder="tenant_acme"
                    autoComplete="organization"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={!!error}
                    aria-describedby={error ? "login-error" : undefined}
                    disabled={busy}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-xs font-bold text-ink"
                >
                  Email Address
                </label>
                <div className="relative field">
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-11 pl-9 text-sm font-semibold"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={!!error}
                    aria-describedby={error ? "login-error" : undefined}
                    disabled={busy}
                    required
                  />
                  <Mail
                    className="field__icon absolute left-3 top-3.5 h-4 w-4 text-muted pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-xs font-bold text-ink"
                >
                  Password
                </label>
                <div className="relative field">
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setTick((t) => t + 1);
                      if (error) setError(null);
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="••••••••"
                    className="h-11 pl-9 text-sm font-semibold"
                    autoComplete="current-password"
                    aria-invalid={!!error}
                    aria-describedby={error ? "login-error" : undefined}
                    disabled={busy}
                    required
                  />
                  <Lock
                    className="field__icon absolute left-3 top-3.5 h-4 w-4 text-muted pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {error && (
                <div
                  id="login-error"
                  role="alert"
                  aria-live="assertive"
                  className="field-error rounded-lg border border-red/40 bg-red-soft px-3 py-2 text-xs text-red"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="signin-btn w-full h-11 font-bold"
                disabled={busy || granted}
                aria-busy={busy}
              >
                {granted ? (
                  <>
                    <Check className="h-4 w-4 mr-2" /> Welcome back
                  </>
                ) : busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authenticating {config.label}…
                  </>
                ) : (
                  <>
                    Sign In to {config.label}{" "}
                    <ArrowRight className="signin-btn__arrow h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
