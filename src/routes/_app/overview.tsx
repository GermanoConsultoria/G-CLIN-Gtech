import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  format, eachMonthOfInterval,
  startOfMonth, endOfMonth, parseISO, isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, Calendar, CheckCircle2, XCircle, Clock,
  TrendingUp, TrendingDown, DollarSign, MessageCircle, BellRing,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { buildMessage, whatsappLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/_app/overview")({ component: Overview });

type Appointment = {
  id: string;
  client_name: string;
  phone: string;
  status: "agendado" | "confirmado" | "concluido" | "cancelado" | "falta";
  service_name: string | null;
  type: "procedimento" | "avaliacao" | "retorno" | "encaixe";
  scheduled_at: string;
};

type Lancamento = {
  id: string;
  tipo: string;
  valor: number;
  status: string;
  dt_vencimento: string;
};

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusConfig = {
  agendado:  { label: "Aguardando", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluido: { label: "Concluído",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelado: { label: "Cancelado",  cls: "bg-red-50 text-red-600 border-red-200" },
  falta:     { label: "Falta",      cls: "bg-red-50 text-red-600 border-red-200" },
} as const;

// ─── Componentes auxiliares ────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8 first:mt-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  progress,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
  progress?: number;
}) {
  const toneMap = {
    default: { icon: "bg-primary/10 text-primary",     value: "text-foreground" },
    success: { icon: "bg-success/15 text-success",     value: "text-success" },
    warning: { icon: "bg-warning/15 text-warning",     value: "text-warning" },
    danger:  { icon: "bg-destructive/15 text-destructive", value: "text-destructive" },
  };
  const t = toneMap[tone];

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`font-display text-3xl font-bold leading-none ${t.value}`}>
        {value}
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FinRow({
  label,
  value,
  tone = "default",
  bold,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger" | "default";
  bold?: boolean;
}) {
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    danger:  "text-destructive",
    default: "text-foreground",
  };
  return (
    <div className={`flex justify-between items-baseline py-2 border-b border-border last:border-0 ${bold ? "pt-3" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold ${colorMap[tone]} ${bold ? "text-base" : ""}`}>
        {formatBRL(value)}
      </span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card p-3 shadow-lg text-xs space-y-1">
      <div className="font-semibold text-foreground mb-1 capitalize">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

function Overview() {
  const { user } = useAuth();

  const today = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState("");
  const [to]            = [today];

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [lancamentos,  setLancamentos]  = useState<Lancamento[]>([]);
  const [qtdPendentes, setQtdPendentes] = useState(0);

  const carregarPendentes = async () => {
    const { count } = await supabase
      .from("lancamento_financeiro")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "RECEITA")
      .eq("status", "PENDENTE");
    setQtdPendentes(count ?? 0);
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("appointments")
        .select("id, client_name, phone, status, service_name, type, scheduled_at")
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("lancamento_financeiro")
        .select("id, tipo, valor, status, dt_vencimento")
        .neq("status", "CANCELADO"),
    ]).then(([{ data: a }, { data: l }]) => {
      const appts = (a as Appointment[]) ?? [];
      setAppointments(appts);
      if (appts.length > 0) {
        setFrom(appts[0].scheduled_at.slice(0, 10));
      } else {
        setFrom(format(new Date(), "yyyy-MM") + "-01");
      }
      setLancamentos((l as Lancamento[]) ?? []);
    });
    carregarPendentes();

    const intervalo = setInterval(carregarPendentes, 60_000);
    return () => clearInterval(intervalo);
  }, [user]);

  // ── Hoje ──────────────────────────────────────────────────────────────────
  const todayAppts = useMemo(
    () => appointments.filter((a) => isToday(parseISO(a.scheduled_at))),
    [appointments],
  );

  const todayStats = useMemo(() => {
    const total      = todayAppts.length;
    const concluidos = todayAppts.filter((a) => a.status === "concluido").length;
    const confirmados = todayAppts.filter((a) => a.status === "confirmado").length;
    const aguardando = todayAppts.filter((a) => a.status === "agendado").length;
    const problemas  = todayAppts.filter((a) => a.status === "cancelado" || a.status === "falta").length;
    const progresso  = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    return { total, concluidos, confirmados, aguardando, problemas, progresso };
  }, [todayAppts]);

  // Próximos agendamentos de hoje que ainda não foram concluídos/cancelados
  const proximosHoje = useMemo(
    () =>
      todayAppts
        .filter((a) => a.status === "agendado" || a.status === "confirmado")
        .slice(0, 5),
    [todayAppts],
  );

  // ── Período ───────────────────────────────────────────────────────────────
  const periodoStats = useMemo(() => {
    const recebido = lancamentos.filter((l) => l.tipo === "RECEITA" && l.status === "PAGO").reduce((s, l) => s + Number(l.valor), 0);
    const aReceber = lancamentos.filter((l) => l.tipo === "RECEITA" && l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);
    const pago     = lancamentos.filter((l) => l.tipo === "DESPESA" && l.status === "PAGO").reduce((s, l) => s + Number(l.valor), 0);
    const aPagar   = lancamentos.filter((l) => l.tipo === "DESPESA" && l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);
    const saldo    = recebido - pago;
    const previsto = (recebido + aReceber) - (pago + aPagar);
    return { aReceber, recebido, aPagar, pago, saldo, previsto };
  }, [lancamentos]);

  // ── Gráfico mensal ────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!from || !to) return [];
    const meses = eachMonthOfInterval({ start: parseISO(from), end: parseISO(to) });

    return meses.map((mes) => {
      const label    = format(mes, "MMM/yy", { locale: ptBR });
      const mesStart = format(startOfMonth(mes), "yyyy-MM-dd");
      const mesEnd   = format(endOfMonth(mes),   "yyyy-MM-dd");

      const receita = lancamentos
        .filter((l) => l.tipo === "RECEITA" && l.status === "PAGO" && l.dt_vencimento.slice(0, 10) >= mesStart && l.dt_vencimento.slice(0, 10) <= mesEnd)
        .reduce((s, l) => s + Number(l.valor), 0);

      const custo = lancamentos
        .filter((l) => l.tipo === "DESPESA" && l.status === "PAGO" && l.dt_vencimento.slice(0, 10) >= mesStart && l.dt_vencimento.slice(0, 10) <= mesEnd)
        .reduce((s, l) => s + Number(l.valor), 0);

      return {
        mes: label,
        Receita: parseFloat(receita.toFixed(2)),
        Custo:   parseFloat(custo.toFixed(2)),
        Lucro:   parseFloat((receita - custo).toFixed(2)),
      };
    });
  }, [lancamentos, from, to]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Painel de informações</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        {qtdPendentes > 0 && (
          <Link
            to="/pending-payments"
            className="relative flex items-center justify-center h-10 w-10 rounded-full bg-orange-100 hover:bg-orange-200 transition-colors"
            title={`${qtdPendentes} pagamento(s) pendente(s)`}
          >
            <BellRing className="h-5 w-5 text-orange-600" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {qtdPendentes > 99 ? "99+" : qtdPendentes}
            </span>
          </Link>
        )}
      </div>

      {qtdPendentes > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-sm text-orange-800">
            Você tem <strong>{qtdPendentes} pagamento{qtdPendentes !== 1 ? "s" : ""} pendente{qtdPendentes !== 1 ? "s" : ""}</strong>.{" "}
            <Link to="/pending-payments" className="underline font-medium hover:text-orange-900">
              Verifique os pagamentos pendentes.
            </Link>
          </p>
        </div>
      )}

      {/* ── Hoje em destaque ── */}
      <SectionTitle>Hoje em destaque</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Calendar}
          label="Agendamentos hoje"
          value={todayStats.total}
          tone="default"
          progress={todayStats.progresso}
          sub={`${todayStats.concluidos} de ${todayStats.total} concluídos`}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Confirmados hoje"
          value={todayStats.confirmados}
          tone="success"
          sub={todayStats.total > 0 ? `${Math.round((todayStats.confirmados / todayStats.total) * 100)}% de confirmação` : "—"}
        />
        <KpiCard
          icon={Clock}
          label="Aguardando confirmação"
          value={todayStats.aguardando}
          tone="warning"
          sub={todayStats.aguardando > 0 ? "Enviar lembrete pelo WhatsApp" : "Todos responderam"}
        />
        <KpiCard
          icon={XCircle}
          label="Faltas / cancelados"
          value={todayStats.problemas}
          tone={todayStats.problemas > 0 ? "danger" : "default"}
          sub={todayStats.problemas === 0 ? "Nenhuma ocorrência" : undefined}
        />
      </div>

      {/* ── Próximos atendimentos ── */}
      {proximosHoje.length > 0 && (
        <>
          <SectionTitle>Próximos atendimentos de hoje</SectionTitle>
          <div className="flex flex-col gap-2">
            {proximosHoje.map((a) => {
              const cfg = statusConfig[a.status];
              const hora = format(parseISO(a.scheduled_at), "HH:mm");
              const msg = buildMessage({
                kind: "confirmacao",
                patientName: a.client_name,
                scheduledAt: parseISO(a.scheduled_at),
                type: a.type === "retorno" ? "retorno" : "consulta",
              });
              const link = whatsappLink(a.phone, msg);

              return (
                <div
                  key={a.id}
                  className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow-card)]"
                >
                  <span className="w-10 text-sm font-semibold text-primary shrink-0">{hora}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{a.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.service_name ?? "Sem serviço definido"}
                    </p>
                  </div>
                  <span className={`hidden sm:inline-flex text-xs px-2.5 py-0.5 rounded-full border font-medium shrink-0 ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                  {a.status === "agendado" && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Lembrete
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {proximosHoje.length === 0 && (
        <>
          <SectionTitle>Próximos atendimentos de hoje</SectionTitle>
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Nenhum atendimento pendente para hoje.
          </div>
        </>
      )}

      {/* ── Resultado do período ── */}
      <SectionTitle>Resultado do período</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Gráfico */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold mb-4">Resultado mensal</p>
          {chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sem dados no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  formatter={(value) => (
                    <span style={{ color: "var(--color-foreground)" }}>{value}</span>
                  )}
                />
                <Bar dataKey="Receita" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Custo"   fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Lucro"   fill="var(--success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Resumo financeiro */}
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold mb-2">Financeiro do período</p>
          <FinRow label="Receita recebida"  value={periodoStats.recebido} tone="success" />
          <FinRow label="A receber"         value={periodoStats.aReceber} tone="warning" />
          <FinRow label="Despesas pagas"    value={periodoStats.pago}     tone="danger"  />
          <FinRow label="A pagar"           value={periodoStats.aPagar}   tone="danger"  />
          <FinRow label="Saldo realizado"   value={periodoStats.saldo}    tone={periodoStats.saldo >= 0 ? "success" : "danger"} bold />
          <FinRow label="Resultado previsto" value={periodoStats.previsto} tone={periodoStats.previsto >= 0 ? "success" : "danger"} bold />
        </div>
      </div>
    </div>
  );
}