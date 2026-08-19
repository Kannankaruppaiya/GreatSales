import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Role } from "../data/constants";
import { useUi } from "../store/ui";
import { Button, Input } from "../components/ui";

export default function LoginPage() {
  const login = useUi((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/dashboard";

  const [workspace, setWorkspace] = useState("greatsales");
  const [email, setEmail] = useState("admin@greatsales.test");
  const [password, setPassword] = useState("Passw0rd!");
  const [role, setRole] = useState<Role>("admin");
  const [busy, setBusy] = useState(false);

  const performLogin = (targetRole: Role) => {
    setBusy(true);
    setTimeout(() => {
      login(targetRole);
      setBusy(false);
      navigate(from, { replace: true });
    }, 300);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(role);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr] bg-canvas">
      {/* Brand Hero Panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-ink via-slate-900 to-brand-ink lg:flex lg:flex-col lg:justify-between lg:p-14 lg:text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #10b981 0, transparent 50%), radial-gradient(circle at 80% 80%, #047857 0, transparent 40%)",
          }}
        />

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
            <p className="text-xs text-white/60 font-medium">B2B Distribution Sales & Receivables Intelligence</p>
          </div>
        </div>

        <div className="relative max-w-lg space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Commit. Track. <br />
            <span className="text-emerald-300">
              Achieve Growth.
            </span>
          </h1>
          <p className="text-[15px] leading-relaxed text-white/70">
            The unified recurring-sales projection, pipeline acceleration, and receivables platform. One source of truth from sales reps in the field to executive leadership.
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
                desc: "Granular access isolation for Sales, Admin, and Executive Management.",
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

      {/* Form Panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px] space-y-6">
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

          <div>
            <h2 className="text-2xl font-extrabold text-ink tracking-tight font-sans">
              Sign in to your account
            </h2>
            <p className="mt-1 text-xs font-medium text-muted">
              Select your persona below for instant access or enter credentials.
            </p>
          </div>

          {/* 1-Click Fast Persona Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              1-Click Fast Demo Login
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: "admin" as Role, label: "Admin", subtitle: "Full Governance", icon: ShieldCheck },
                { role: "mgmt" as Role, label: "Management", subtitle: "Read-Only View", icon: Users },
              ].map((p) => (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => {
                    setRole(p.role);
                    performLogin(p.role);
                  }}
                  className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer group shadow-xs hover:scale-[1.02] ${
                    role === p.role
                      ? "border-brand bg-brand-soft/40 ring-1 ring-brand/50"
                      : "border-line bg-surface hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p.icon className={`h-4 w-4 ${role === p.role ? "text-brand-ink" : "text-muted group-hover:text-brand"}`} />
                    {role === p.role && <CheckCircle2 className="h-3.5 w-3.5 text-brand" />}
                  </div>
                  <div className="text-xs font-bold text-ink">{p.label}</div>
                  <div className="text-[10px] text-muted truncate">{p.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-line" />
            <span className="bg-canvas px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
              Or Sign In With Workspace Credentials
            </span>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink">Workspace Tenant</label>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-line focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 bg-surface shadow-xs">
                <span className="grid place-items-center px-3 text-muted">
                  <Building2 className="h-4 w-4" />
                </span>
                <input
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="h-9 flex-1 bg-surface pr-2 text-xs font-semibold text-ink focus:outline-none"
                  placeholder="greatsales"
                />
                <span className="grid place-items-center bg-surface-2 px-3 text-[11px] font-bold text-muted border-l border-line">
                  .greatsales.app
                </span>
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
                />
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
              </div>
            </div>

            <Button type="submit" className="w-full h-10 font-bold" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authenticating Session…
                </>
              ) : (
                <>
                  Enter Workspace <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-[11.5px] text-muted font-medium">
            Protected with role-based access control & token persistence.
          </p>
        </div>
      </div>
    </div>
  );
}
