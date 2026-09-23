import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Pencil, Calendar as CalendarIcon, Phone, Zap, AlertTriangle, CheckCircle2, XCircle, Clock, List, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { FormaPagamento } from "@/lib/financeiro.types";
import { generateSlotsForDay, type BusinessHoursRow } from "@/lib/business-hours";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

type Service = { id: string; name: string; duration_minutes: number; price: number; is_hof: boolean; plano_contas_id: string | null; category_group: string | null };

export type Appointment = {
  id: string;
  client_name: string;
  phone: string;
  service_id: string | null;
  service_name: string | null;
  appointment_services?: { id: string; service_id: string; service_name: string; price: number; cost: number; duration_minutes: number; is_hof: boolean }[];
  type: "procedimento" | "avaliacao" | "retorno" | "encaixe";
  scheduled_at: string;
  status: "agendado" | "confirmado" | "concluido" | "cancelado" | "falta" | "pendente_pagamento";
  notes: string | null;
  wants_to_anticipate: boolean;
  extra_charge: boolean;
};

const statusStyle: Record<Appointment["status"], { cls: string; icon: typeof Clock; label: string }> = {
  agendado:            { cls: "bg-warning/15 text-warning border-warning/30",            icon: Clock,         label: "Aguardando" },
  confirmado:          { cls: "bg-success/15 text-success border-success/30",            icon: CheckCircle2,  label: "Confirmado" },
  concluido:           { cls: "bg-muted text-muted-foreground",                           icon: CheckCircle2,  label: "Concluído" },
  cancelado:           { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle,       label: "Cancelado" },
  falta:               { cls: "bg-orange-100 text-orange-700 border-orange-200",          icon: AlertTriangle, label: "Falta" },
  pendente_pagamento:  { cls: "bg-orange-100 text-orange-700 border-orange-200",          icon: Clock,         label: "Pend. Pagamento" },
};

const CATEGORIAS_MODAL = [
  { value: "sobrancelhas",     label: "Sobrancelhas" },
  { value: "micropigmentacao", label: "Micropigmentação" },
  { value: "depilacao",        label: "Depilação" },
  { value: "facial",           label: "Tratamento Facial" },
  { value: "hof",              label: "HOF (Alto Valor)" },
  { value: "outros",           label: "Outros" },
] as const;

function generateAllSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 19; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

function getAvailableSlots(
  date: string,
  newDuration: number,
  existingAppts: { scheduled_at: string; service_id: string | null }[],
  services: Service[],
  editingId?: string,
  bh?: BusinessHoursRow | null,
  blockedSlots?: { date: string; start_time: string; end_time: string }[],
): string[] {
  const allSlots = bh ? generateSlotsForDay(bh, newDuration) : generateAllSlots();
  const busyIntervals = existingAppts
    .filter((a: any) => a.id !== editingId)
    .map((a) => {
      const start = new Date(a.scheduled_at).getTime();
      const svc = services.find((s) => s.id === a.service_id);
      const duration = svc?.duration_minutes ?? 30;
      return { start, end: start + duration * 60 * 1000 };
    });

  // Bloqueios do dia
  const dayBlocks = (blockedSlots ?? [])
    .filter(b => b.date === date)
    .map(b => ({
      start: new Date(`${date}T${b.start_time}`).getTime(),
      end: new Date(`${date}T${b.end_time}`).getTime(),
    }));

  return allSlots.filter((slot) => {
    const slotStart = new Date(`${date}T${slot}`).getTime();
    const slotEnd = slotStart + newDuration * 60 * 1000;
    const isBusy = busyIntervals.some((b) => slotStart < b.end && slotEnd > b.start);
    const isBlocked = dayBlocks.some((b) => slotStart < b.end && slotEnd > b.start);
    return !isBusy && !isBlocked;
  });
}

function Dashboard() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursRow[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<{ id: string; date: string; start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [anticipateFor, setAnticipateFor] = useState<Appointment | null>(null);
  const [concludingAppt, setConcludingAppt] = useState<Appointment | null>(null);
  const [pendingPaymentAppt, setPendingPaymentAppt] = useState<Appointment | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState<"hoje" | "mes" | "dia">("hoje");
  const [filtroDataDia, setFiltroDataDia] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  const apptsFiltrados = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");
    return appts.filter((a) => {
      if (filtroStatus !== "TODOS" && a.status !== filtroStatus) return false;
      const data = a.scheduled_at.slice(0, 10);
      if (filtroPeriodo === "hoje") return data === hoje;
      if (filtroPeriodo === "mes") return data >= inicioMes && data <= fimMes;
      if (filtroPeriodo === "dia") return !filtroDataDia || data === filtroDataDia;
      return true;
    });
  }, [appts, filtroStatus, filtroPeriodo, filtroDataDia]);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: s }, { data: bh }, { data: bs }] = await Promise.all([
      supabase.from("appointments").select("*, appointment_services(*)").order("scheduled_at", { ascending: true }),
      supabase.from("services").select("*").eq("active", true).order("name"),
      supabase.from("business_hours").select("weekday,is_open,open_time,close_time,break_start,break_end"),
      supabase.from("blocked_slots").select("id,date,start_time,end_time").gte("date", new Date().toISOString().slice(0,10)),
    ]);
    setAppts((a as Appointment[]) ?? []);
    setServices((s as Service[]) ?? []);
    setBusinessHours((bh as BusinessHoursRow[]) ?? []);
    setBlockedSlots((bs as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este agendamento?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Agendamento removido");
    load();
  };

  const updateStatus = async (a: Appointment, status: Appointment["status"]) => {
    if (status === "concluido") {
      setConcludingAppt(a);
      return;
    }
    if (status === "pendente_pagamento") {
      setPendingPaymentAppt(a);
      return;
    }

    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) return toast.error(error.message);

    // Ao confirmar, cria o paciente automaticamente se ainda não existir
    if (status === "confirmado") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const { data: existente } = await db
        .from("pacientes")
        .select("id")
        .eq("user_id", user!.id)
        .ilike("nome", a.client_name.trim())
        .maybeSingle();

      if (!existente) {
        const { error: pacErr } = await db.from("pacientes").insert({
          user_id: user!.id,
          nome: a.client_name.trim(),
          telefone: a.phone,
        });
        if (pacErr) {
          toast.warning("Agendamento confirmado, mas falha ao criar paciente: " + pacErr.message);
        } else {
          toast.success("Agendamento confirmado e paciente adicionado!");
        }
      } else {
        toast.success("Agendamento confirmado!");
      }
    }

    if (status === "cancelado") setAnticipateFor({ ...a, status });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            {apptsFiltrados.length !== appts.length
              ? `${apptsFiltrados.length} de ${appts.length} procedimentos`
              : `${appts.length} ${appts.length === 1 ? "procedimento" : "procedimentos"} no total`}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-[image:var(--gradient-hero)] shadow-[var(--shadow-soft)]">
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </DialogTrigger>
          <AppointmentDialog
            services={services}
            allAppts={appts}
            editing={editing}
            businessHours={businessHours}
            blockedSlots={blockedSlots}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSaved={() => { setOpen(false); setEditing(null); load(); }}
          />
        </Dialog>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border bg-muted/50 p-1 gap-0.5">
          {([
            { value: "hoje", label: "Hoje" },
            { value: "mes",  label: "Este Mês" },
            { value: "dia",  label: "Selecionar Dia" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFiltroPeriodo(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filtroPeriodo === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {filtroPeriodo === "dia" && (
          <Input
            type="date"
            value={filtroDataDia}
            onChange={(e) => setFiltroDataDia(e.target.value)}
            className="h-9 w-44 text-sm"
          />
        )}
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            <SelectItem value="agendado">Aguardando</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="pendente_pagamento">Pend. Pagamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="falta">Falta</SelectItem>
          </SelectContent>
        </Select>
        {(filtroStatus !== "TODOS" || filtroPeriodo !== "hoje") && (
          <button
            onClick={() => { setFiltroStatus("TODOS"); setFiltroPeriodo("hoje"); setFiltroDataDia(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list"><List className="h-4 w-4 mr-1" /> Lista</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-1" /> Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {apptsFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
                <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {appts.length === 0 ? "Nenhum agendamento ainda" : "Nenhum resultado para os filtros aplicados"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {appts.length === 0 ? 'Clique em "Novo agendamento" para começar.' : "Tente ajustar os filtros acima."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {apptsFiltrados.map((a) => {
                  const date = new Date(a.scheduled_at);
                  const s = statusStyle[a.status];
                  const SIcon = s.icon;
                  const svc = services.find((sv) => sv.id === a.service_id);
                  return (
                    <div key={a.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <div className="text-center leading-tight">
                            <div className="text-xs font-medium uppercase">{format(date, "MMM", { locale: ptBR })}</div>
                            <div className="text-lg font-bold">{format(date, "dd")}</div>
                          </div>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-semibold">{a.client_name}</h3>
                            <Badge variant="outline" className={s.cls}>
                              <SIcon className="mr-1 h-3 w-3" /> {s.label}
                            </Badge>
                            {a.service_name && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                {a.service_name}
                                {svc && (
                                  <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {svc.duration_minutes}min
                                  </span>
                                )}
                              </Badge>
                            )}
                            {a.wants_to_anticipate && (
                              <Badge variant="outline" className="border-primary/30 text-primary">
                                <Zap className="mr-1 h-3 w-3" /> Aceita antecipar
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>{format(date, "EEEE, HH:mm", { locale: ptBR })}</span>
                            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={a.status} onValueChange={(v) => updateStatus(a, v as Appointment["status"])}>
                          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agendado">Aguardando</SelectItem>
                            <SelectItem value="confirmado">Confirmado</SelectItem>
                            <SelectItem value="pendente_pagamento">Pend. Pagamento</SelectItem>
                            <SelectItem value="concluido">Concluído</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                            <SelectItem value="falta">Falta</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <CalendarView appts={apptsFiltrados} services={services} onEdit={(a) => { setEditing(a); setOpen(true); }} />
          </TabsContent>
        </Tabs>
      )}

      <ConcludeDialog
        appt={concludingAppt}
        services={services}
        onClose={() => setConcludingAppt(null)}
        onSaved={() => { setConcludingAppt(null); load(); }}
      />
      <PendentePagamentoDialog
        appt={pendingPaymentAppt}
        services={services}
        onClose={() => setPendingPaymentAppt(null)}
        onSaved={() => { setPendingPaymentAppt(null); load(); }}
      />
      <AnticipateDialog appts={appts} canceled={anticipateFor} onClose={() => setAnticipateFor(null)} />
    </div>
  );
}

const FORMAS_PAGAMENTO: { value: FormaPagamento | "PENDENTE"; label: string }[] = [
  { value: "DINHEIRO",       label: "Dinheiro" },
  { value: "PIX",            label: "PIX" },
  { value: "CARTAO_CREDITO", label: "Cartão de Crédito" },
  { value: "CARTAO_DEBITO",  label: "Cartão de Débito" },
  { value: "CONVENIO",       label: "Convênio" },
  { value: "PENDENTE",       label: "Pendente — cobrar depois" },
];

async function resolverPlanoContas(
  svc: Service | undefined,
  userId: string,
): Promise<string | null> {
  if (svc?.plano_contas_id) return svc.plano_contas_id;
  const { data: params } = await supabase
    .from("parametros")
    .select("plano_contas_padrao_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (params?.plano_contas_padrao_id) return params.plano_contas_padrao_id;
  const { data: pc } = await supabase
    .from("plano_contas")
    .select("id")
    .eq("tipo", "RECEITA")
    .eq("ativo", true)
    .order("nome")
    .limit(1)
    .maybeSingle();
  return pc?.id ?? null;
}

async function verificarDuplicata(appointmentId: string): Promise<boolean> {
  const { count } = await supabase
    .from("lancamento_financeiro")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", appointmentId);
  return (count ?? 0) > 0;
}

function ConcludeDialog({ appt, services, onClose, onSaved }: {
  appt: Appointment | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "PENDENTE">("DINHEIRO");
  const [saving, setSaving] = useState(false);

  const svc = services.find((s) => s.id === appt?.service_id);
  const totalPrice = appt?.appointment_services
    ? appt.appointment_services
        .filter(s => !s.is_hof)
        .reduce((sum, s) => sum + (s.price ?? 0), 0)
    : (svc && !svc.is_hof ? svc.price : 0);
  const isHof = svc?.is_hof ?? false;

  useEffect(() => {
    if (appt) {
      const found = services.find((s) => s.id === appt.service_id);
      setValor(found ? String(found.price) : "0");
      setFormaPagamento("DINHEIRO");
    }
  }, [appt, services]);

  const handleConfirm = async () => {
    if (!appt || !user) return;
    setSaving(true);

    const { error: apptError } = await supabase.from("appointments").update({ status: "concluido" }).eq("id", appt.id);
    if (apptError) { toast.error(apptError.message); setSaving(false); return; }

    const valorNum = Number(valor);
    const jaExiste = await verificarDuplicata(appt.id);

    if (jaExiste) {
      toast.success("Procedimento concluído. (Lançamento já existia para este agendamento)");
      setSaving(false);
      onSaved();
      return;
    }

    const planoContasId = await resolverPlanoContas(svc, user.id);

    if (!planoContasId) {
      toast.error("Nenhuma conta de receita cadastrada. Crie uma em Finanças → Plano de Contas.");
      toast.success("Procedimento concluído.");
      setSaving(false);
      onSaved();
      return;
    }

    const isPendente = formaPagamento === "PENDENTE";
    const dtVencimento = new Date(appt.scheduled_at).toISOString().split("T")[0];

    const { error: lancError } = await supabase.from("lancamento_financeiro").insert({
      tipo: "RECEITA",
      descricao: appt.service_name ?? "Procedimento",
      beneficiario: appt.client_name,
      valor: valorNum,
      dt_vencimento: `${dtVencimento}T00:00:00.000Z`,
      status: isPendente ? "PENDENTE" : "PAGO",
      dt_pagamento: isPendente ? null : new Date().toISOString().split("T")[0],
      forma_pagamento: isPendente ? null : formaPagamento,
      plano_contas_id: planoContasId,
      appointment_id: appt.id,
      created_by: user.id,
    });

    if (lancError) {
      toast.warning(`Procedimento concluído, mas falha ao criar lançamento: ${lancError.message}`);
    } else {
      toast.success("Procedimento concluído e lançamento criado!");
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={!!appt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Concluir procedimento
          </DialogTitle>
        </DialogHeader>
        {appt && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{appt.client_name}</div>
              <div className="text-muted-foreground">{appt.service_name ?? "Sem serviço"}</div>
              {isHof && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  ✨ Procedimento HOF — informe o valor cobrado
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{isHof ? "Valor cobrado (R$)" : "Confirmar valor (R$)"}</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
              {!isHof && <p className="text-xs text-muted-foreground">Valor do serviço pré-preenchido. Ajuste se necessário.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento | "PENDENTE")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handleConfirm} disabled={saving || !valor || Number(valor) <= 0}>
                {saving ? "Salvando..." : "Concluir e lançar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PendentePagamentoDialog({ appt, services, onClose, onSaved }: {
  appt: Appointment | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  const svc = services.find((s) => s.id === appt?.service_id);
  const isHof = svc?.is_hof ?? false;

  useEffect(() => {
    if (appt) {
      const found = services.find((s) => s.id === appt.service_id);
      setValor(found ? String(found.price) : "0");
    }
  }, [appt, services]);

  const handleConfirm = async () => {
    if (!appt || !user) return;
    setSaving(true);

    const { error: apptError } = await supabase
      .from("appointments")
      .update({ status: "pendente_pagamento" })
      .eq("id", appt.id);
    if (apptError) { toast.error(apptError.message); setSaving(false); return; }

    const jaExiste = await verificarDuplicata(appt.id);
    if (jaExiste) {
      toast.success("Status atualizado. (Lançamento já existia para este agendamento)");
      setSaving(false);
      onSaved();
      return;
    }

    const planoContasId = await resolverPlanoContas(svc, user.id);
    if (!planoContasId) {
      toast.warning("Status atualizado. Configure o plano de contas em Finanças → Plano de Contas.");
      setSaving(false);
      onSaved();
      return;
    }

    const dtVencimento = new Date(appt.scheduled_at).toISOString().split("T")[0];

    const { error: lancError } = await supabase.from("lancamento_financeiro").insert({
      tipo: "RECEITA",
      descricao: appt.service_name ?? "Procedimento",
      beneficiario: appt.client_name,
      valor: Number(valor),
      dt_vencimento: `${dtVencimento}T00:00:00.000Z`,
      status: "PENDENTE",
      dt_pagamento: null,
      forma_pagamento: null,
      plano_contas_id: planoContasId,
      appointment_id: appt.id,
      created_by: user.id,
    });

    if (lancError) {
      toast.warning(`Status atualizado, mas falha ao criar lançamento: ${lancError.message}`);
    } else {
      toast.success("Marcado como pendente de pagamento e lançamento criado!");
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={!!appt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" /> Pendente de pagamento
          </DialogTitle>
        </DialogHeader>
        {appt && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{appt.client_name}</div>
              <div className="text-muted-foreground">{appt.service_name ?? "Sem serviço"}</div>
              {isHof && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  ✨ Procedimento HOF — informe o valor a cobrar
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{isHof ? "Valor a cobrar (R$)" : "Valor (R$)"}</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
              <p className="text-xs text-muted-foreground">Um lançamento PENDENTE será criado no financeiro.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white"
                onClick={handleConfirm}
                disabled={saving || !valor || Number(valor) < 0}
              >
                {saving ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnticipateDialog({ appts, canceled, onClose }: { appts: Appointment[]; canceled: Appointment | null; onClose: () => void }) {
  const candidates = useMemo(() => {
    if (!canceled) return [];
    const slot = new Date(canceled.scheduled_at);
    return appts.filter((x) =>
      x.id !== canceled.id &&
      x.wants_to_anticipate &&
      x.status !== "cancelado" &&
      x.status !== "concluido" &&
      new Date(x.scheduled_at) > slot,
    );
  }, [appts, canceled]);

  return (
    <Dialog open={!!canceled} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Oferecer vaga antecipada
          </DialogTitle>
          <DialogDescription>
            {canceled && (<>Vaga liberada: <b>{format(new Date(canceled.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</b>. Quem responder SIM primeiro fica com o horário.</>)}
          </DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
            Nenhum cliente futuro marcou que aceita antecipar.
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-auto">
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{c.client_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Atual: {format(new Date(c.scheduled_at), "dd/MM HH:mm", { locale: ptBR })} · {c.phone}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServicoSelect({
  services,
  value,
  onChange,
}: {
  services: Service[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    CATEGORIAS_MODAL.forEach((c) => { init[c.value] = true; });
    return init;
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const grupos = CATEGORIAS_MODAL.map((cat) => ({
    ...cat,
    services: services.filter((s) => (s.category_group ?? "outros") === cat.value),
  })).filter((g) => g.services.length > 0);

  const svcSelecionado = value !== "none" ? services.find((s) => s.id === value) : null;

  const toggleGrupo = (v: string) =>
    setExpandidos((prev) => ({ ...prev, [v]: !prev[v] }));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={svcSelecionado ? "text-foreground" : "text-muted-foreground"}>
          {svcSelecionado ? svcSelecionado.name : "Selecione um serviço..."}
        </span>
        <ChevronDown size={15} className={`text-muted-foreground transition-transform duration-150 ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-72 overflow-y-auto rounded-xl border bg-card shadow-2xl">
          <button
            type="button"
            onClick={() => { onChange("none"); setAberto(false); }}
            className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${value === "none" ? "font-medium text-primary" : "text-muted-foreground"}`}
          >
            Nenhum
          </button>

          {grupos.map((grupo) => (
            <div key={grupo.value}>
              <button
                type="button"
                onClick={() => toggleGrupo(grupo.value)}
                className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-semibold" style={{ color: "#4A688C" }}>
                  {grupo.label}
                </span>
                <ChevronDown
                  size={13}
                  style={{ color: "#A0B6D0" }}
                  className={`transition-transform duration-150 ${expandidos[grupo.value] ? "rotate-180" : ""}`}
                />
              </button>

              {expandidos[grupo.value] && (
                <div>
                  {grupo.services.map((svc) => (
                    <button
                      type="button"
                      key={svc.id}
                      onClick={() => { onChange(svc.id); setAberto(false); }}
                      className={`flex w-full items-center justify-between px-5 py-2.5 text-left transition-colors hover:bg-muted/50 ${value === svc.id ? "bg-primary/5 text-primary" : ""}`}
                    >
                      <span className="text-sm">{svc.name}</span>
                      <div className="ml-2 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span>{svc.duration_minutes}min</span>
                        <span>
                          {svc.is_hof && Number(svc.price) === 0
                            ? "Sob avaliação"
                            : `R$ ${Number(svc.price).toFixed(2)}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentDialog({ services, allAppts, editing, businessHours, blockedSlots, onClose, onSaved }: {
  services: Service[];
  allAppts: Appointment[];
  editing: Appointment | null;
  businessHours: BusinessHoursRow[];
  blockedSlots: { id: string; date: string; start_time: string; end_time: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string>("none");
  const [extraServices, setExtraServices] = useState<string[]>([]);

  const addExtraService = () => setExtraServices((prev) => [...prev, "none"]);
  const removeExtraService = (idx: number) => setExtraServices((prev) => prev.filter((_, i) => i !== idx));
  const updateExtraService = (idx: number, val: string) => setExtraServices((prev) => prev.map((v, i) => i === idx ? val : v));
  const [type, setType] = useState<Appointment["type"]>("procedimento");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [anticipate, setAnticipate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isSlotPast = (slot: string): boolean => {
    if (editing) return false;
    const today = format(now, "yyyy-MM-dd");
    if (date !== today) return false;
    return isBefore(new Date(`${date}T${slot}`), now);
  };

  useEffect(() => {
    if (editing) {
      const d = new Date(editing.scheduled_at);
      setName(editing.client_name);
      setPhone(editing.phone);
      setServiceId(editing.service_id ?? "none");
      const extras = (editing.appointment_services ?? [])
        .filter(s => s.service_id !== editing.service_id)
        .map(s => s.service_id);
      setExtraServices(extras);
      setType(editing.type);
      setDate(format(d, "yyyy-MM-dd"));
      setTime(format(d, "HH:mm"));
      setNotes(editing.notes ?? "");
      setAnticipate(editing.wants_to_anticipate);
    } else {
      setName("");
      setPhone("");
      setServiceId("none");
      setExtraServices([]);
      setType("procedimento");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setTime("");
      setNotes("");
      setAnticipate(false);
    }
  }, [editing]);

  const bhForDay = useMemo(() => {
    const dow = new Date(date + "T00:00:00").getDay();
    return businessHours.find((r) => r.weekday === dow) ?? null;
  }, [date, businessHours]);

  const availableSlots = useMemo(() => {
    const allSelectedIds = [serviceId, ...extraServices].filter(id => id !== "none");
    const totalDuration = allSelectedIds.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      return sum + (svc?.duration_minutes ?? 0);
    }, 0);
    const duration = totalDuration > 0 ? totalDuration : 30;
    const dayAppts = allAppts.filter((a) => {
      const d = a.scheduled_at.slice(0, 10);
      return d === date && a.status !== "cancelado" && a.status !== "falta";
    });
    return getAvailableSlots(date, duration, dayAppts, services, editing?.id, bhForDay, blockedSlots);
  }, [date, serviceId, allAppts, services, editing, bhForDay, blockedSlots]);

  useEffect(() => {
    if (time && availableSlots.length > 0 && !availableSlots.includes(time)) {
      setTime("");
    }
  }, [availableSlots]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setServiceId("none");
    setExtraServices([]);
    setType("procedimento");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setTime("");
    setNotes("");
    setAnticipate(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !time) return;
    if (isSlotPast(time)) {
      toast.error("Este horário já passou. Escolha um horário futuro para hoje ou selecione outra data.");
      return;
    }
    setSaving(true);
    const scheduled_at = new Date(`${date}T${time}`).toISOString();
    const allSelectedIds = [serviceId, ...extraServices].filter(id => id !== "none");
    const allServiceNames = allSelectedIds.map(id => services.find(s => s.id === id)?.name).filter(Boolean);
    const service = services.find((s) => s.id === serviceId);
    const payload = {
      user_id: user.id,
      client_name: name,
      phone,
      service_id: serviceId === "none" ? null : serviceId,
      service_name: allServiceNames.length > 0 ? allServiceNames.join(" + ") : null,
      type,
      scheduled_at,
      notes: notes || null,
      wants_to_anticipate: anticipate,
      extra_charge: false,
    };
    let apptId: string | null = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase.from("appointments").insert(payload).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      apptId = data.id;
    }

    // Salvar appointment_services
    if (apptId) {
      await supabase.from("appointment_services").delete().eq("appointment_id", apptId);
      const allIds = [serviceId, ...extraServices].filter(id => id !== "none");
      const serviceRows = allIds.map(id => {
        const svc = services.find(s => s.id === id);
        return {
          appointment_id: apptId,
          service_id: id,
          service_name: svc?.name ?? "",
          price: svc?.price ?? 0,
          cost: svc?.cost ?? 0,
          duration_minutes: svc?.duration_minutes ?? 30,
          is_hof: svc?.is_hof ?? false,
        };
      });
      if (serviceRows.length > 0) {
        const { error: svcErr } = await supabase.from("appointment_services").insert(serviceRows);
        if (svcErr) console.error("Erro ao salvar serviços:", svcErr.message);
      }
    }

    setSaving(false);
    toast.success(editing ? "Agendamento atualizado" : "Agendamento criado");
    resetForm();
    onSaved();
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nome do cliente</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone (WhatsApp)</Label>
          <Input
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={11}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as Appointment["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="procedimento">Procedimento</SelectItem>
                <SelectItem value="avaliacao">Avaliação</SelectItem>
                <SelectItem value="retorno">Retorno</SelectItem>
                <SelectItem value="encaixe">Encaixe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Serviço</Label>
          <ServicoSelect services={services} value={serviceId} onChange={setServiceId} />
          {extraServices.map((esId, idx) => (
            <div key={idx} className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <ServicoSelect services={services} value={esId} onChange={(val) => updateExtraService(idx, val)} />
              </div>
              <button
                type="button"
                onClick={() => removeExtraService(idx)}
                className="text-destructive hover:text-destructive/80 text-lg font-bold px-2"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addExtraService}
            className="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium"
          >
            <span className="text-lg leading-none">+</span> Adicionar serviço
          </button>
        </div>
        <div className="space-y-1.5">
          <Label>
            Horário disponível
            {bhForDay && !bhForDay.is_open ? (
              <span className="ml-2 text-xs text-destructive font-normal">— dia fechado</span>
            ) : availableSlots.length === 0 ? (
              <span className="ml-2 text-xs text-destructive font-normal">— sem vagas neste dia</span>
            ) : null}
          </Label>
          {availableSlots.length > 0 ? (
            <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto rounded-xl border bg-muted/30 p-2">
              {availableSlots.map((slot) => {
                const past = isSlotPast(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      if (past) {
                        toast.error("Este horário já passou. Escolha um horário futuro para hoje ou selecione outra data.");
                        return;
                      }
                      setTime(slot);
                    }}
                    className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      past
                        ? "opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border border-gray-200"
                        : time === slot
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border hover:border-primary hover:text-primary"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              {bhForDay && !bhForDay.is_open
                ? "Este dia está fechado. Escolha outra data."
                : "Nenhum horário disponível para esta data e serviço. Escolha outra data."}
            </div>
          )}
          {time && (
            <p className="text-xs text-muted-foreground">
              Horário selecionado:{" "}
              <span className={`font-semibold ${isSlotPast(time) ? "text-destructive line-through" : "text-primary"}`}>
                {time}
              </span>
              {isSlotPast(time) && <span className="ml-1 text-destructive">— horário expirado</span>}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Aceita antecipar?</Label>
            <p className="text-xs text-muted-foreground">Será notificado se surgir vaga antes.</p>
          </div>
          <Switch checked={anticipate} onCheckedChange={setAnticipate} />
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !time} className="bg-[image:var(--gradient-hero)]">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function CalendarView({ appts, services, onEdit }: {
  appts: Appointment[];
  services: Service[];
  onEdit: (a: Appointment) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const arr: Date[] = [];
    let d = start;
    while (d <= end) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appts) {
      const k = format(new Date(a.scheduled_at), "yyyy-MM-dd");
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    return map;
  }, [appts]);

  const dayList = (byDay.get(format(selected, "yyyy-MM-dd")) ?? []).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold capitalize">
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {weekdays.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const inMonth = isSameMonth(d, cursor);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            return (
              <button key={key} type="button" onClick={() => setSelected(d)}
                className={`min-h-20 rounded-lg border p-1.5 text-left transition ${isSel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"} ${!inMonth ? "opacity-40" : ""}`}
              >
                <div className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{format(d, "d")}</div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((a) => {
                    const s = statusStyle[a.status];
                    return (
                      <div key={a.id} className={`truncate rounded px-1 py-0.5 text-[10px] ${s.cls}`}>
                        {format(new Date(a.scheduled_at), "HH:mm")} {a.client_name}
                      </div>
                    );
                  })}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} mais</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-base font-semibold capitalize">
          {format(selected, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </h3>
        <p className="text-xs text-muted-foreground">{dayList.length} {dayList.length === 1 ? "agendamento" : "agendamentos"}</p>
        <div className="mt-3 space-y-2">
          {dayList.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum agendamento neste dia.
            </div>
          ) : (
            dayList.map((a) => {
              const s = statusStyle[a.status];
              const SIcon = s.icon;
              const svc = services.find((sv) => sv.id === a.service_id);
              return (
                <button key={a.id} onClick={() => onEdit(a)} className="w-full rounded-lg border p-3 text-left hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{format(new Date(a.scheduled_at), "HH:mm")} · {a.client_name}</div>
                    <Badge variant="outline" className={s.cls}><SIcon className="mr-1 h-3 w-3" />{s.label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {a.service_name && (
                      <span className="inline-flex items-center gap-1">
                        {a.service_name}
                        {svc && <><Clock className="h-3 w-3" />{svc.duration_minutes}min</>}
                      </span>
                    )}
                    <span>{a.phone}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}