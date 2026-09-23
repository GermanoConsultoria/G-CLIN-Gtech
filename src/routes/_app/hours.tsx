import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Save, Ban, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/hours")({ component: HoursPage });

const WEEKDAYS = [
  "Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado",
];

type Row = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
};

type BlockedSlot = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

const defaultRow = (weekday: number): Row => ({
  weekday,
  is_open: weekday !== 0,
  open_time: "08:00",
  close_time: "18:00",
  break_start: "12:00",
  break_end: "13:00",
});

function HoursPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>(WEEKDAYS.map((_, i) => defaultRow(i)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bloqueios
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [blockDate, setBlockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [blockSlots, setBlockSlots] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [blockReason, setBlockReason] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: hours }, { data: blocks }] = await Promise.all([
        supabase.from("business_hours").select("weekday,is_open,open_time,close_time,break_start,break_end").eq("user_id", user.id),
        supabase.from("blocked_slots").select("*").eq("user_id", user.id).gte("date", format(new Date(), "yyyy-MM-dd")).order("date").order("start_time"),
      ]);
      if (hours && hours.length) {
        setRows(WEEKDAYS.map((_, i) => {
          const r = hours.find((d: any) => d.weekday === i);
          return r ? {
            weekday: i, is_open: r.is_open,
            open_time: (r.open_time as string).slice(0, 5),
            close_time: (r.close_time as string).slice(0, 5),
            break_start: r.break_start ? (r.break_start as string).slice(0, 5) : null,
            break_end: r.break_end ? (r.break_end as string).slice(0, 5) : null,
          } : defaultRow(i);
        }));
      }
      if (blocks) setBlockedSlots(blocks as BlockedSlot[]);
      setLoading(false);
    })();
  }, [user]);

  const update = (i: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = rows.map((r) => ({
      user_id: user.id, weekday: r.weekday, is_open: r.is_open,
      open_time: r.open_time, close_time: r.close_time,
      break_start: r.break_start || null, break_end: r.break_end || null,
    }));
    const { error } = await supabase.from("business_hours").upsert(payload, { onConflict: "user_id,weekday" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Horários salvos!");
  };

  const addBlockSlot = () => setBlockSlots((prev) => [...prev, { start: "", end: "" }]);
  const removeBlockSlot = (idx: number) => setBlockSlots((prev) => prev.filter((_, i) => i !== idx));
  const updateBlockSlot = (idx: number, field: "start" | "end", val: string) => {
    setBlockSlots((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const saveBlock = async () => {
    if (!user) return;
    const valid = blockSlots.filter(s => s.start && s.end);
    if (!valid.length) return toast.error("Defina pelo menos um horário para bloquear.");
    setSavingBlock(true);
    const payload = valid.map(s => ({
      user_id: user.id,
      date: blockDate,
      start_time: s.start,
      end_time: s.end,
      reason: blockReason || null,
    }));
    const { error } = await supabase.from("blocked_slots").insert(payload);
    setSavingBlock(false);
    if (error) return toast.error(error.message);
    toast.success("Horários bloqueados com sucesso!");
    setBlockSlots([{ start: "", end: "" }]);
    setBlockReason("");
    const { data } = await supabase.from("blocked_slots").select("*").eq("user_id", user.id).gte("date", format(new Date(), "yyyy-MM-dd")).order("date").order("start_time");
    if (data) setBlockedSlots(data as BlockedSlot[]);
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setBlockedSlots((prev) => prev.filter((b) => b.id !== id));
    toast.success("Bloqueio removido!");
  };

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Horários de funcionamento */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Horário de funcionamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configure os horários da clínica em cada dia da semana.</p>
          </div>
          <Button onClick={save} disabled={saving} className="bg-[image:var(--gradient-hero)]">
            <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-medium">{WEEKDAYS[i]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`open-${i}`} className="text-xs text-muted-foreground">
                    {row.is_open ? "Aberto" : "Fechado"}
                  </Label>
                  <Switch id={`open-${i}`} checked={row.is_open} onCheckedChange={(v) => update(i, { is_open: v })} />
                </div>
              </div>
              {row.is_open && (
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div><Label className="text-xs">Abertura</Label><Input type="time" value={row.open_time} onChange={(e) => update(i, { open_time: e.target.value })} /></div>
                  <div><Label className="text-xs">Fechamento</Label><Input type="time" value={row.close_time} onChange={(e) => update(i, { close_time: e.target.value })} /></div>
                  <div><Label className="text-xs">Início do intervalo</Label><Input type="time" value={row.break_start ?? ""} onChange={(e) => update(i, { break_start: e.target.value || null })} /></div>
                  <div><Label className="text-xs">Fim do intervalo</Label><Input type="time" value={row.break_end ?? ""} onChange={(e) => update(i, { break_end: e.target.value || null })} /></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bloqueio de horários */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Bloqueio de horários</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bloqueie horários específicos de um dia para que não apareçam como disponíveis para agendamento.</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={blockDate} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setBlockDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Input placeholder="Ex: Reunião, consulta externa..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Horários a bloquear</Label>
            {blockSlots.map((slot, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input type="time" value={slot.start} onChange={(e) => updateBlockSlot(idx, "start", e.target.value)} className="flex-1" />
                <span className="text-muted-foreground text-sm">até</span>
                <Input type="time" value={slot.end} onChange={(e) => updateBlockSlot(idx, "end", e.target.value)} className="flex-1" />
                {blockSlots.length > 1 && (
                  <button type="button" onClick={() => removeBlockSlot(idx)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addBlockSlot} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium mt-1">
              <Plus className="h-4 w-4" /> Adicionar outro horário
            </button>
          </div>

          <Button onClick={saveBlock} disabled={savingBlock} className="w-full bg-[image:var(--gradient-hero)]">
            <Ban className="mr-2 h-4 w-4" /> {savingBlock ? "Bloqueando..." : "Bloquear horários"}
          </Button>
        </div>

        {/* Lista de bloqueios ativos */}
        {blockedSlots.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Bloqueios ativos</h3>
            {blockedSlots.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {format(new Date(b.date + "T00:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })} — {b.start_time.slice(0,5)} às {b.end_time.slice(0,5)}
                  </p>
                  {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
                </div>
                <button type="button" onClick={() => deleteBlock(b.id)} className="text-destructive hover:text-destructive/80 ml-4">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
