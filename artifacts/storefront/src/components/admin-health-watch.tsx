import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  RefreshCw,
  Database,
  Mail,
  Send,
  HardDrive,
  CreditCard,
  Bot,
  Cpu,
  Zap,
  Clock,
  AlertTriangle,
  TestTube2,
  Loader2,
  Wifi,
  FolderOpen,
  UploadCloud,
  Settings2,
  Server,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "fail" | "skip";

interface ServiceCheck {
  service: string;
  key: string;
  status: CheckStatus;
  detail: string;
  envVars: string[];
  configured: boolean;
}

interface EnvInfo {
  PORT: string | null;
  PORT_API: string | null;
  APP_URL: string | null;
  ADMIN_EMAIL: string | null;
}

interface HealthReport {
  checks: ServiceCheck[];
  summary: { ok: number; fail: number; skip: number };
  durationMs: number;
  checkedAt: string;
  adminEmail: string | null;
  envInfo: EnvInfo;
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "api-server": Server,
  supabase: Database,
  smtp: Mail,
  resend: Send,
  s3: HardDrive,
  stripe: CreditCard,
  telegram: Bot,
  groq: Cpu,
  nvidia: Zap,
  "local-storage": FolderOpen,
  storefront: Globe,
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> OK
      </span>
    );
  if (status === "fail")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        <XCircle className="h-3.5 w-3.5" /> FAIL
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      <MinusCircle className="h-3.5 w-3.5" /> NOT SET
    </span>
  );
}

// ── Admin email ping button ───────────────────────────────────────────────────

function AdminEmailPingButton({ adminEmail }: { adminEmail: string | null }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [err, setErr] = useState("");

  async function ping() {
    setState("sending");
    setErr("");
    try {
      const r = await fetch("/api/admin/email/ping", { method: "POST", credentials: "include" });
      const data = (await r.json()) as { ok?: boolean; to?: string; error?: string; detail?: string };
      if (r.ok && data.ok) {
        setState("ok");
        setTimeout(() => setState("idle"), 6000);
      } else {
        setErr(data.detail ?? data.error ?? `HTTP ${r.status}`);
        setState("fail");
      }
    } catch (e) {
      setErr(String(e));
      setState("fail");
    }
  }

  if (!adminEmail) return (
    <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
      <TestTube2 className="h-3.5 w-3.5" />
      Set <code className="bg-muted px-1 rounded">ADMIN_EMAIL</code> in your <code className="bg-muted px-1 rounded">.env</code> to enable one-click ping.
    </p>
  );

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <TestTube2 className="h-3.5 w-3.5" />
          Ping <span className="font-mono font-medium text-foreground">{adminEmail}</span>
        </p>
        <Button size="sm" variant="outline" onClick={ping} disabled={state === "sending"} className="gap-1.5 shrink-0 h-7 text-xs">
          {state === "sending" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {state === "sending" ? "Sending…" : "Send ping"}
        </Button>
      </div>
      {state === "ok" && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ping sent to {adminEmail} ✓
        </p>
      )}
      {state === "fail" && (
        <p className="flex items-start gap-1.5 text-xs text-rose-600">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-all">{err}</span>
        </p>
      )}
    </div>
  );
}

// ── SMTP custom test email ────────────────────────────────────────────────────

function SmtpCustomTestButton({ smtpOk }: { smtpOk: boolean }) {
  const [to, setTo] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [err, setErr] = useState("");

  async function send() {
    if (!to.trim()) return;
    setState("sending");
    setErr("");
    try {
      const r = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: to.trim() }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; detail?: string };
      if (r.ok && data.ok) {
        setState("ok");
        setTimeout(() => setState("idle"), 5000);
      } else {
        setErr(data.detail ?? data.error ?? `HTTP ${r.status}`);
        setState("fail");
      }
    } catch (e) {
      setErr(String(e));
      setState("fail");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Or send to any address{!smtpOk && <span className="text-amber-500"> (will try Resend fallback)</span>}:
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="anyone@example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Button size="sm" onClick={send} disabled={state === "sending" || !to.trim()} className="gap-1.5 shrink-0">
          {state === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {state === "sending" ? "Sending…" : "Send"}
        </Button>
      </div>
      {state === "ok" && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Sent to {to}
        </p>
      )}
      {state === "fail" && (
        <p className="flex items-start gap-1.5 text-xs text-rose-600">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-all">{err}</span>
        </p>
      )}
    </div>
  );
}

// ── Local storage sync button ─────────────────────────────────────────────────

function LocalStorageSyncButton() {
  const [state, setState] = useState<"idle" | "syncing" | "ok" | "fail">("idle");
  const [result, setResult] = useState<{ synced: number; skipped: number; errors: string[] } | null>(null);
  const [err, setErr] = useState("");

  async function runSync() {
    setState("syncing");
    setResult(null);
    setErr("");
    try {
      const r = await fetch("/api/admin/storage/sync", { method: "POST", credentials: "include" });
      const data = (await r.json()) as { synced?: number; skipped?: number; errors?: string[]; error?: string; detail?: string };
      if (r.ok && data.synced !== undefined) {
        setResult({ synced: data.synced, skipped: data.skipped ?? 0, errors: data.errors ?? [] });
        setState("ok");
      } else {
        setErr(data.detail ?? data.error ?? `HTTP ${r.status}`);
        setState("fail");
      }
    } catch (e) {
      setErr(String(e));
      setState("fail");
    }
  }

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <UploadCloud className="h-3.5 w-3.5" />
          Sync local files → S3
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={runSync}
          disabled={state === "syncing"}
          className="gap-1.5 shrink-0 h-7 text-xs"
        >
          {state === "syncing" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
          {state === "syncing" ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      {state === "ok" && result && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sync complete
          </p>
          <p>
            <span className="font-medium">{result.synced}</span> uploaded · <span className="font-medium">{result.skipped}</span> skipped (already in S3)
          </p>
          {result.errors.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}: {result.errors[0]}
            </p>
          )}
        </div>
      )}
      {state === "fail" && (
        <p className="flex items-start gap-1.5 text-xs text-rose-600">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-all">{err || "S3 not configured — set FILE_* env vars first."}</span>
        </p>
      )}
    </div>
  );
}

// ── SMTP fix tips ─────────────────────────────────────────────────────────────

function SmtpFixTips({ detail }: { detail: string }) {
  const isGmail = (process.env.SMTP_HOST ?? "").includes("gmail") || detail.toLowerCase().includes("gmail");
  const isAuth = detail.toLowerCase().includes("auth") || detail.toLowerCase().includes("535") || detail.toLowerCase().includes("username") || detail.toLowerCase().includes("password");
  const isConnect = detail.toLowerCase().includes("connect") || detail.toLowerCase().includes("econnrefused") || detail.toLowerCase().includes("timeout");

  return (
    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1.5 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
      <p className="font-semibold flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" /> Fix suggestions
      </p>
      {isAuth && (
        <>
          <p>• <strong>Gmail:</strong> You must use an <strong>App Password</strong>, not your regular password. Go to <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">myaccount.google.com/apppasswords</code> and create one.</p>
          <p>• Make sure <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_USER</code> is your full Gmail address (e.g. <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">you@gmail.com</code>).</p>
        </>
      )}
      {isConnect && (
        <>
          <p>• Check that your VPS firewall allows outbound port <strong>587</strong> (or 465). Some providers block it by default.</p>
          <p>• Try <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_PORT=465</code> with SSL, or <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_PORT=587</code> with STARTTLS.</p>
        </>
      )}
      {!isAuth && !isConnect && (
        <p>• Verify all four vars are set: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_HOST</code>, <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_PORT</code>, <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_USER</code>, <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_PASSWORD</code>.</p>
      )}
      <p>• Run <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">bash check-env.sh</code> on your VPS to validate all env vars at once.</p>
    </div>
  );
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({ check, adminEmail }: { check: ServiceCheck; adminEmail: string | null }) {
  const Icon = SERVICE_ICONS[check.key] ?? Wifi;
  const isSmtp = check.key === "smtp";
  const isLocalStorage = check.key === "local-storage";
  const borderColor =
    check.status === "ok"
      ? "border-emerald-200 dark:border-emerald-800"
      : check.status === "fail"
        ? "border-rose-200 dark:border-rose-800"
        : "border-border/50";
  const bg =
    check.status === "ok"
      ? "bg-emerald-50/30 dark:bg-emerald-950/20"
      : check.status === "fail"
        ? "bg-rose-50/30 dark:bg-rose-950/20"
        : "bg-muted/20";

  return (
    <div className={`rounded-xl border ${borderColor} ${bg} p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${
            check.status === "ok" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300"
            : check.status === "fail" ? "bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300"
            : "bg-muted text-muted-foreground"
          }`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">{check.service}</span>
        </div>
        <StatusBadge status={check.status} />
      </div>

      <p className={`text-xs break-all ${
        check.status === "fail" ? "text-rose-700 dark:text-rose-300 font-mono"
        : "text-muted-foreground"
      }`}>
        {check.detail}
      </p>

      {check.status === "skip" && check.envVars.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {check.envVars.map((v) => (
            <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {v}
            </code>
          ))}
        </div>
      )}

      {isSmtp && check.status === "fail" && <SmtpFixTips detail={check.detail} />}
      {isSmtp && (
        <div className="mt-3 border-t border-border/40 pt-3 space-y-3">
          <AdminEmailPingButton adminEmail={adminEmail} />
          <SmtpCustomTestButton smtpOk={check.status === "ok"} />
        </div>
      )}
      {isLocalStorage && <LocalStorageSyncButton />}
    </div>
  );
}

// ── Env config info card ──────────────────────────────────────────────────────

function EnvInfoCard({ envInfo }: { envInfo: EnvInfo }) {
  const rows: { label: string; key: keyof EnvInfo; sensitive?: boolean }[] = [
    { label: "PORT",        key: "PORT" },
    { label: "PORT_API",    key: "PORT_API" },
    { label: "APP_URL",     key: "APP_URL" },
    { label: "ADMIN_EMAIL", key: "ADMIN_EMAIL" },
  ];

  const missing = rows.filter((r) => !envInfo[r.key]).length;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      missing > 0
        ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20"
        : "border-border/50 bg-muted/20"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${
            missing > 0
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300"
              : "bg-muted text-muted-foreground"
          }`}>
            <Settings2 className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">Environment config</span>
        </div>
        {missing > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {missing} not set
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> All set
          </span>
        )}
      </div>

      <table className="w-full text-xs">
        <tbody className="divide-y divide-border/40">
          {rows.map(({ label, key }) => {
            const val = envInfo[key];
            return (
              <tr key={key}>
                <td className="py-1.5 pr-4 font-mono text-muted-foreground w-36 shrink-0">
                  {label}
                </td>
                <td className="py-1.5">
                  {val ? (
                    <span className="font-mono text-foreground break-all">{val}</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> not set
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ report }: { report: HealthReport }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/50 bg-card px-5 py-3 text-sm shadow-sm">
      <div className="flex items-center gap-2 font-semibold">
        <Wifi className="h-4 w-4 text-muted-foreground" />
        Service health
      </div>
      <div className="flex gap-3 ml-auto text-xs">
        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> {report.summary.ok} OK
        </span>
        {report.summary.fail > 0 && (
          <span className="flex items-center gap-1 text-rose-600 font-semibold">
            <XCircle className="h-3.5 w-3.5" /> {report.summary.fail} failing
          </span>
        )}
        <span className="flex items-center gap-1 text-muted-foreground">
          <MinusCircle className="h-3.5 w-3.5" /> {report.summary.skip} not set
        </span>
        <span className="flex items-center gap-1 text-muted-foreground border-l border-border/50 pl-3">
          <Clock className="h-3.5 w-3.5" />
          {new Date(report.checkedAt).toLocaleTimeString()}
          <span className="text-muted-foreground/60">({report.durationMs} ms)</span>
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminHealthWatch() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/health-watch", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as HealthReport;
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Auto-refresh every 30 s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(runCheck, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, runCheck]);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={runCheck}
            disabled={loading}
            className="gap-2"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {loading ? "Checking…" : "Refresh now"}
          </Button>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-input accent-primary"
            />
            Auto-refresh every 30 s
          </label>
        </div>
        {report && (
          <p className="text-xs text-muted-foreground">
            Last checked: {new Date(report.checkedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Failed to fetch health status: {error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !report && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-muted/20 p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Results */}
      {report && (
        <>
          <SummaryBar report={report} />
          {report.envInfo && <EnvInfoCard envInfo={report.envInfo} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.checks.map((check) => (
              <ServiceCard key={check.key} check={check} adminEmail={report.adminEmail} />
            ))}
          </div>

          {report.summary.fail > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {report.summary.fail} service{report.summary.fail !== 1 ? "s are" : " is"} failing
              </p>
              <p className="text-xs">
                Check your <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">.env</code> file on the VPS and run <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">bash check-env.sh</code> to validate all variables. Restart the service after any change: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">sudo systemctl restart allmart</code>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
