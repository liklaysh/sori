import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Globe,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@sori/ui";
import { useAdminApi } from "../../../hooks/useAdminApi";

type DiagnosticStatus = "ok" | "degraded" | "down" | "error" | string;

interface DiagnosticsPayload {
  status: DiagnosticStatus;
  generatedAt: string;
  version: {
    name: string;
    version: string;
    apiVersion: string;
    buildId: string;
    commit: string;
    environment: string;
  };
  services: Record<string, { status: DiagnosticStatus; latency: number | null; error?: string }>;
  migrations: {
    appliedCount: number;
    latest: { id: number; hash: string; createdAt: string | null } | null;
  };
  telemetrySchema: {
    status: DiagnosticStatus;
    expectedColumns: number;
    presentColumns: number;
    missingColumns: string[];
  };
  runtime: {
    environment: string;
    uptime: number;
    node: string;
    retentionDays: number;
    maxUploadSizeMb: number;
  };
  endpoints: Record<string, string>;
}

export default function DiagnosticsTab() {
  const { t } = useTranslation(["admin"]);
  const api = useAdminApi();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    const res = await api.getDiagnostics();
    if (res.data) {
      setDiagnostics(res.data);
      setError(null);
    } else {
      setError(res.error || t("admin:diagnostics.errors.fetchFailed"));
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchDiagnostics();
  }, []);

  const copyPayload = async () => {
    if (!diagnostics) return;
    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    toast.success(t("admin:diagnostics.toasts.copied"));
  };

  if (loading && !diagnostics) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-sori-text-muted">
        <Activity className="h-10 w-10 animate-pulse mb-4 text-sori-accent-danger" />
        <p className="font-bold uppercase tracking-widest text-[10px]">{t("admin:diagnostics.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <h2 className="text-2xl font-black text-sori-text-strong uppercase tracking-tight">{t("admin:diagnostics.title")}</h2>
          <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">{t("admin:diagnostics.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchDiagnostics()}
            className="flex items-center gap-2 rounded-xl border border-sori-border-subtle bg-sori-surface-main px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sori-text-muted hover:text-sori-text-strong transition"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {t("admin:diagnostics.refresh")}
          </button>
          <button
            type="button"
            onClick={() => void copyPayload()}
            className="flex items-center gap-2 rounded-xl border border-sori-accent-danger bg-sori-accent-danger-subtle px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sori-accent-danger hover:bg-sori-accent-danger hover:text-sori-text-on-accent transition"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("admin:diagnostics.copyJson")}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-sori-accent-danger-subtle border border-sori-accent-danger text-sori-accent-danger flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {diagnostics && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatusCard
              title={t("admin:diagnostics.overall")}
              value={statusLabel(diagnostics.status, t)}
              status={diagnostics.status}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <StatusCard
              title={t("admin:diagnostics.version")}
              value={`${diagnostics.version.version} • ${diagnostics.version.buildId}`}
              status="ok"
              icon={<Server className="h-5 w-5" />}
            />
            <StatusCard
              title={t("admin:diagnostics.generated")}
              value={new Date(diagnostics.generatedAt).toLocaleString()}
              status="ok"
              icon={<Clock className="h-5 w-5" />}
            />
          </div>

          <section className="grid gap-4 lg:grid-cols-3">
            {Object.entries(diagnostics.services).map(([key, service]) => (
              <StatusCard
                key={key}
                title={t(`admin:diagnostics.services.${key}`)}
                value={service.latency === null ? service.error || statusLabel(service.status, t) : `${service.latency} ms`}
                status={service.status}
                icon={key === "database" ? <Database className="h-5 w-5" /> : key === "storage" ? <HardDrive className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
              />
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <InfoPanel title={t("admin:diagnostics.migrations.title")}>
              <KeyValue label={t("admin:diagnostics.migrations.applied")} value={String(diagnostics.migrations.appliedCount)} />
              <KeyValue label={t("admin:diagnostics.migrations.latest")} value={diagnostics.migrations.latest?.hash?.slice(0, 12) || "—"} />
              <KeyValue label={t("admin:diagnostics.migrations.createdAt")} value={diagnostics.migrations.latest?.createdAt || "—"} />
            </InfoPanel>

            <InfoPanel title={t("admin:diagnostics.telemetrySchema.title")}>
              <KeyValue label={t("admin:diagnostics.telemetrySchema.status")} value={statusLabel(diagnostics.telemetrySchema.status, t)} tone={diagnostics.telemetrySchema.status} />
              <KeyValue label={t("admin:diagnostics.telemetrySchema.columns")} value={`${diagnostics.telemetrySchema.presentColumns}/${diagnostics.telemetrySchema.expectedColumns}`} />
              <KeyValue label={t("admin:diagnostics.telemetrySchema.missing")} value={diagnostics.telemetrySchema.missingColumns.join(", ") || "—"} />
            </InfoPanel>
          </section>

          <InfoPanel title={t("admin:diagnostics.runtime.title")}>
            <div className="grid gap-3 md:grid-cols-2">
              <KeyValue label={t("admin:diagnostics.runtime.environment")} value={diagnostics.runtime.environment} />
              <KeyValue label={t("admin:diagnostics.runtime.node")} value={diagnostics.runtime.node} />
              <KeyValue label={t("admin:diagnostics.runtime.uptime")} value={`${diagnostics.runtime.uptime}s`} />
              <KeyValue label={t("admin:diagnostics.runtime.retention")} value={`${diagnostics.runtime.retentionDays}d`} />
              <KeyValue label={t("admin:diagnostics.runtime.uploadLimit")} value={`${diagnostics.runtime.maxUploadSizeMb} MB`} />
            </div>
          </InfoPanel>

          <InfoPanel title={t("admin:diagnostics.endpoints.title")}>
            <div className="grid gap-2">
              {Object.entries(diagnostics.endpoints).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 rounded-xl bg-sori-surface-base/70 px-3 py-2">
                  <Globe className="h-4 w-4 shrink-0 text-sori-text-muted" />
                  <span className="w-24 shrink-0 text-[10px] font-black uppercase tracking-widest text-sori-text-dim">{key}</span>
                  <span className="min-w-0 truncate text-xs font-bold text-sori-text-strong">{value}</span>
                </div>
              ))}
            </div>
          </InfoPanel>
        </>
      )}
    </div>
  );
}

function statusLabel(status: DiagnosticStatus, t: (key: string) => string) {
  if (status === "ok") return t("admin:diagnostics.status.ok");
  if (status === "degraded") return t("admin:diagnostics.status.degraded");
  if (status === "down") return t("admin:diagnostics.status.down");
  if (status === "error") return t("admin:diagnostics.status.error");
  return status;
}

function statusTone(status: DiagnosticStatus) {
  if (status === "ok") return "border-sori-accent-secondary text-sori-accent-secondary bg-sori-accent-secondary/10";
  if (status === "degraded") return "border-sori-accent-warning text-sori-accent-warning bg-sori-accent-warning/10";
  return "border-sori-accent-danger text-sori-accent-danger bg-sori-accent-danger-subtle";
}

function StatusCard(props: { title: string; value: string; status: DiagnosticStatus; icon: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border bg-sori-surface-main p-5 shadow-inner", statusTone(props.status))}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-sori-text-muted">{props.title}</p>
        {props.status === "ok" ? <CheckCircle2 className="h-4 w-4" /> : props.icon}
      </div>
      <p className="truncate text-lg font-black text-sori-text-strong">{props.value}</p>
    </div>
  );
}

function InfoPanel(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-sori-border-subtle bg-sori-surface-main p-5">
      <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-sori-text-muted">{props.title}</h3>
      {props.children}
    </section>
  );
}

function KeyValue(props: { label: string; value: string; tone?: DiagnosticStatus }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-sori-border-subtle py-2 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-sori-text-dim">{props.label}</span>
      <span className={cn("min-w-0 truncate text-right text-xs font-bold", props.tone ? statusTone(props.tone) : "text-sori-text-strong")}>
        {props.value}
      </span>
    </div>
  );
}
