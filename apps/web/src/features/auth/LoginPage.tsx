import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Crown,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth, SalesWebLoginError } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/config";
import { Button, Input } from "@/components/ui";

export type LoginRole = "super_admin" | "admin" | "mgmt";

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
};

function resolveRoleFromPath(pathname: string, roleParam?: string): LoginRole {
  if (roleParam === "super-admin" || roleParam === "super_admin" || roleParam === "superadmin") return "super_admin";
  if (roleParam === "admin" || roleParam === "administrator") return "admin";
  if (roleParam === "mgmt" || roleParam === "management" || roleParam === "manager") return "mgmt";

  if (pathname.includes("super-admin") || pathname.includes("superadmin")) return "super_admin";
  if (pathname.includes("admin")) return "admin";
  if (pathname.includes("management") || pathname.includes("mgmt")) return "mgmt";

  return "admin";
}

interface LoginPageProps {
  initialRole?: LoginRole;
}

/** Seeded demo emails per web role (the API authenticates these against tenant_acme). */
const DEMO_EMAIL_BY_ROLE: Partial<Record<LoginRole, string>> = {
  admin: env.DEMO_EMAIL,
  mgmt: env.DEMO_EMAIL.replace(/^admin@/, "manager@"),
};

export default function LoginPage({ initialRole }: LoginPageProps) {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const { roleParam } = useParams<{ roleParam?: string }>();

  const activeRole: LoginRole = initialRole || resolveRoleFromPath(location.pathname, roleParam);
  const config = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.admin;
  const demoEmail = DEMO_EMAIL_BY_ROLE[activeRole] ?? config.defaultEmail;

  const [tenantId, setTenantId] = useState(env.DEMO_TENANT_ID);
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(env.DEMO_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update the prefilled email when the active role changes
  useEffect(() => {
    setEmail(demoEmail);
  }, [demoEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole === "super_admin") return;

    setBusy(true);
    setError(null);
    try {
      await login(tenantId, email, password);
      navigate(config.destination, { replace: true });
    } catch (err) {
      if (err instanceof SalesWebLoginError) setError(err.message);
      else if (err instanceof ApiError) setError(err.message);
      else setError("Could not reach the API. Is it running?");
    } finally {
      setBusy(false);
    }
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
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-2 rounded-xl border border-line">
              {(["super_admin", "admin", "mgmt"] as LoginRole[]).map((rKey) => {
                const rConf = ROLE_CONFIGS[rKey];
                const isActive = activeRole === rKey;
                const Icon = rConf.icon;

                return (
                  <Link
                    key={rKey}
                    to={rConf.route}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-surface text-ink shadow-xs border border-line"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-brand" : "text-muted"}`} />
                    <span className="truncate">{rConf.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── Active Portal Header ── */}
          <div className="p-4 rounded-xl border border-line bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 border border-line">
                  <config.icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-ink font-sans">
                    {config.title}
                  </h2>
                  <span className={`inline-block rounded border px-1.5 py-0.2 text-[9px] font-extrabold tracking-wider uppercase ${config.badgeColor}`}>
                    {config.badge}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed">
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
                <label className="mb-1.5 block text-xs font-bold text-ink">Tenant ID</label>
                <div className="flex items-stretch overflow-hidden rounded-lg border border-line focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 bg-surface shadow-xs">
                  <span className="grid place-items-center px-3 text-muted">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <input
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="h-9 flex-1 bg-surface pr-2 text-xs font-semibold text-ink focus:outline-none"
                    placeholder="tenant_acme"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink">Email Address</label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="pl-9 text-xs font-semibold"
                    required
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink">Password</label>
                <div className="relative">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 text-xs font-semibold"
                    required
                  />
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red/40 bg-red-soft px-3 py-2 text-xs text-red">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-10 font-bold" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authenticating {config.label}…
                  </>
                ) : (
                  <>
                    Sign In to {config.label} <ArrowRight className="h-4 w-4 ml-1.5" />
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
