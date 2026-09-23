import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronDown, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSlotsForDay, type BusinessHoursRow } from "@/lib/business-hours";
import logoGTech from "@/assets/g-tech-logo.png";

export const Route = createFileRoute("/agendar")({ component: AgendarPage });

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_hof: boolean;
  category_group: string | null;
};

type DayAppt = {
  scheduled_at: string;
  service_id: string | null;
};

const CATEGORIAS = [
  { value: "sobrancelhas",     label: "Sobrancelhas" },
  { value: "micropigmentacao", label: "Micropigmentação" },
  { value: "depilacao",        label: "Depilação" },
  { value: "facial",           label: "Tratamento Facial" },
  { value: "hof",              label: "HOF (Alto Valor)" },
  { value: "outros",           label: "Outros" },
];

const GOLD = "linear-gradient(135deg, #B4C6DC 0%, #A0B6D0 50%, #4A688C 100%)";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Returns slots that are NOT taken by existing appointments.
// Past slots are NOT filtered here — they appear in UI as disabled.
function getSlotsForDisplay(
  date: string,
  duration: number,
  dayAppts: DayAppt[],
  services: Service[],
  bh: BusinessHoursRow | null,
  blockedSlots?: { date: string; start_time: string; end_time: string }[],
): string[] {
  if (!bh || !bh.is_open) return [];
  const allSlots = generateSlotsForDay(bh, duration);

  const busy = dayAppts.map((a) => {
    const start = new Date(a.scheduled_at).getTime();
    const svc = services.find((s) => s.id === a.service_id);
    const dur = svc?.duration_minutes ?? 30;
    return { start, end: start + dur * 60 * 1000 };
  });

  const dayBlocks = (blockedSlots ?? [])
    .filter(b => b.date === date)
    .map(b => ({
      start: new Date(`${date}T${b.start_time}`).getTime(),
      end: new Date(`${date}T${b.end_time}`).getTime(),
    }));

  return allSlots.filter((slot) => {
    const slotStart = new Date(`${date}T${slot}`).getTime();
    const slotEnd = slotStart + duration * 60 * 1000;
    const isBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start);
    const isBlocked = dayBlocks.some((b) => slotStart < b.end && slotEnd > b.start);
    return !isBusy && !isBlocked;
  });
}

function isSlotPast(slot: string, date: string, now: Date): boolean {
  if (date !== format(now, "yyyy-MM-dd")) return false;
  return new Date(`${date}T${slot}`).getTime() <= now.getTime();
}

function AgendarPage() {
  const clinicUserId = import.meta.env.VITE_CLINIC_USER_ID ?? 'c906ad02-7efe-4ea5-a2bc-978d5cd2c0df';

  const [services, setServices] = useState<Service[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [blockedSlots, setBlockedSlots] = useState<{ date: string; start_time: string; end_time: string }[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string>("none");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [anticipate, setAnticipate] = useState(false);
  const [notes, setNotes] = useState("");

  const [dayAppts, setDayAppts] = useState<DayAppt[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  const [confirmed, setConfirmed] = useState<{
    name: string; service: string; date: string; time: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [
        { data: svcs, error: svcsErr },
        { data: bh,   error: bhErr },
      ] = await Promise.all([
        supabase.from("services").select("id,name,duration_minutes,price,is_hof,category_group").eq("active", true).order("category_group").order("name"),
        supabase.from("business_hours").select("weekday,is_open,open_time,close_time,break_start,break_end").eq("user_id", clinicUserId),
      ]);

      if (svcsErr) console.error("[agendar] services:", svcsErr.message);
      if (bhErr)   console.error("[agendar] business_hours:", bhErr.message);

      setServices((svcs as Service[]) ?? []);
      setBusinessHours((bh as BusinessHoursRow[]) ?? []);
      setInitialLoading(false);
    })();
  }, []);

  // Keep `now` in sync for past-slot detection
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Fetch existing appointments for the selected day (to check slot availability)
  useEffect(() => {
    if (!date) { setDayAppts([]); setTime(""); return; }
    setLoadingSlots(true);
    Promise.all([
      supabase
        .from("appointments")
        .select("scheduled_at,service_id")
        .eq("user_id", clinicUserId)
        .gte("scheduled_at", `${date}T00:00:00`)
        .lte("scheduled_at", `${date}T23:59:59`)
        .in("status", ["agendado", "confirmado", "concluido", "pendente_pagamento"]),
      supabase
        .from("blocked_slots")
        .select("date,start_time,end_time")
        .eq("user_id", clinicUserId)
        .eq("date", date),
    ]).then(([{ data: appts, error }, { data: blocks }]) => {
      if (error) console.error("[agendar] appointments:", error.message);
      setDayAppts((appts as DayAppt[]) ?? []);
      setBlockedSlots((blocks as any[]) ?? []);
      setTime("");
      setLoadingSlots(false);
    });
  }, [date]);

  const selectedService = serviceId !== "none" ? services.find((s) => s.id === serviceId) : null;

  const bhForDay = useMemo(() => {
    if (!date) return null;
    const dow = new Date(`${date}T00:00:00`).getDay();
    return businessHours.find((r) => r.weekday === dow) ?? null;
  }, [date, businessHours]);

  const slots = useMemo(() => {
    if (!date) return [];
    const duration = selectedService?.duration_minutes ?? 30;
    return getSlotsForDisplay(date, duration, dayAppts, services, bhForDay, blockedSlots);
  }, [date, bhForDay, selectedService, dayAppts, services, blockedSlots]);

  // When service changes and the previously selected slot is now past, clear it
  useEffect(() => {
    if (time && isSlotPast(time, date, now)) setTime("");
  }, [serviceId]);

  const today = format(new Date(), "yyyy-MM-dd");

  const grupos = CATEGORIAS.map((cat) => ({
    ...cat,
    items: services.filter((s) => (s.category_group ?? "outros") === cat.value),
  })).filter((g) => g.items.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim())                           return setFormError("Preencha seu nome completo.");
    if (phone.replace(/\D/g, "").length < 10)  return setFormError("Preencha um telefone válido.");
    if (serviceId === "none")                   return setFormError("Selecione um serviço.");
    if (!date)                                  return setFormError("Selecione uma data.");
    if (!time)                                  return setFormError("Selecione um horário.");
    if (isSlotPast(time, date, now))            return setFormError("Este horário já passou. Escolha outro.");
    if (!clinicUserId)                          return setFormError("Configuração da clínica não encontrada.");

    setSaving(true);
    const svc = services.find((s) => s.id === serviceId);
    const { error } = await supabase.from("appointments").insert({
      user_id: clinicUserId,
      client_name: name.trim(),
      phone: phone.replace(/\D/g, ""),
      service_id: serviceId,
      service_name: svc?.name ?? null,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      status: "agendado",
      type: "procedimento",
      wants_to_anticipate: anticipate,
      extra_charge: false,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (error) return setFormError("Erro ao confirmar agendamento: " + error.message);

    setConfirmed({
      name: name.trim(),
      service: svc?.name ?? "Procedimento",
      date: format(new Date(`${date}T00:00:00`), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      time,
    });
  };

  const resetForm = () => {
    setName(""); setPhone(""); setServiceId("none"); setDate(""); setTime("");
    setAnticipate(false); setNotes(""); setFormError(null); setConfirmed(null); setDayAppts([]);
  };

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F1F5FA] px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[#2A394B]">Agendamento confirmado!</h2>
          <p className="mt-2 text-sm text-[#45576E]">Obrigada pela preferência 🎉</p>

          <div className="mt-6 rounded-2xl border border-[#C7D5E7] bg-white p-5 text-left space-y-4">
            {(
              [
                { label: "Nome",    value: confirmed.name },
                { label: "Serviço", value: confirmed.service },
                { label: "Data",    value: <span className="capitalize">{confirmed.date}</span> },
                { label: "Horário", value: confirmed.time },
              ] as const
            ).map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs font-medium uppercase tracking-wider text-[#75869B]">{label}</div>
                <div className="mt-0.5 text-sm font-semibold text-[#2A394B]">{value}</div>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm text-[#45576E]">
            Em breve entraremos em contato pelo WhatsApp para confirmar seu agendamento.
          </p>

          <button
            onClick={resetForm}
            className="mt-6 w-full rounded-xl py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: GOLD }}
          >
            Fazer outro agendamento
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────
  const isDayClosed = !!bhForDay && !bhForDay.is_open;

  return (
    <div className="min-h-screen bg-[#F1F5FA]">
      <header className="flex flex-col items-center gap-4 px-6 pt-10 pb-8">
        <img
          src={logoGTech}
          alt="G-Tech"
          className="h-32 w-auto max-w-[300px] object-contain"
          style={{ filter: "drop-shadow(0 4px 20px rgba(160, 182, 208,0.35))" }}
        />
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-[#2A394B]">Agende seu procedimento</h1>
          <p className="mt-1 text-sm text-[#45576E]">Preencha os dados abaixo para realizar seu agendamento</p>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 pb-16">
        <div className="rounded-2xl border border-[#C7D5E7] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Nome */}
            <Field label="Nome completo *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="fi"
              />
            </Field>

            {/* Telefone */}
            <Field label="Telefone WhatsApp *">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
                className="fi"
              />
            </Field>

            {/* Serviço */}
            <Field label="Serviço *">
              {initialLoading ? (
                <div className="h-11 animate-pulse rounded-lg bg-[#DDE7F3]" />
              ) : (
                <div ref={dropRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-md border border-[#C7D5E7] bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[#A0B6D0] focus:ring-offset-2 transition"
                  >
                    <span className={selectedService ? "text-[#2A394B]" : "text-[#75869B]"}>
                      {selectedService ? selectedService.name : "Selecione um serviço..."}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-[#75869B] transition-transform duration-150 ${dropOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {dropOpen && (
                    <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#C7D5E7] bg-white shadow-2xl">
                      {grupos.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-[#75869B]">
                          Nenhum serviço disponível
                        </div>
                      ) : (
                        grupos.map((grupo) => (
                          <div key={grupo.value}>
                            <button
                              type="button"
                              className="flex w-full cursor-default items-center px-3 py-2"
                            >
                              <span className="text-sm font-semibold" style={{ color: "#4A688C" }}>
                                {grupo.label}
                              </span>
                            </button>
                            {grupo.items.map((svc) => (
                              <button
                                key={svc.id}
                                type="button"
                                onClick={() => { setServiceId(svc.id); setDropOpen(false); setTime(""); }}
                                className={`flex w-full items-center justify-between px-5 py-2.5 text-left text-sm transition-colors hover:bg-[#F1F5FA] ${
                                  serviceId === svc.id ? "bg-[#F0F5FB] text-[#4A688C]" : "text-[#2A394B]"
                                }`}
                              >
                                <span>{svc.name}</span>
                                <div className="ml-2 flex shrink-0 items-center gap-2 text-xs text-[#75869B]">
                                  <span className="flex items-center gap-0.5">
                                    <Clock size={11} />{svc.duration_minutes}min
                                  </span>
                                  <span>
                                    {svc.is_hof && Number(svc.price) === 0
                                      ? "Sob avaliação"
                                      : `R$ ${Number(svc.price).toFixed(2)}`}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </Field>

            {/* Data */}
            <Field label="Data *">
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="fi"
              />
            </Field>

            {/* Horários — aparece assim que data for selecionada */}
            {date && (
              <Field
                label={
                  <span>
                    Horário disponível *
                    {isDayClosed && (
                      <span className="ml-2 text-xs font-normal text-red-500">— dia fechado</span>
                    )}
                    {!isDayClosed && slots.length === 0 && !loadingSlots && (
                      <span className="ml-2 text-xs font-normal text-red-500">— sem vagas</span>
                    )}
                  </span>
                }
              >
                {loadingSlots ? (
                  <div className="grid grid-cols-5 gap-1.5 rounded-xl border bg-[#F1F5FA] p-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="h-8 animate-pulse rounded-lg bg-[#DDE7F3]" />
                    ))}
                  </div>
                ) : isDayClosed || slots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#C7D5E7] bg-[#F1F5FA] p-4 text-center text-xs text-[#75869B]">
                    {isDayClosed
                      ? "Este dia está fechado. Escolha outra data."
                      : "Nenhum horário disponível para esta data. Escolha outra data."}
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto rounded-xl border border-[#C7D5E7] bg-[#F1F5FA] p-2">
                    {slots.map((slot) => {
                      const past = isSlotPast(slot, date, now);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            if (past) return;
                            setTime(slot);
                          }}
                          className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            past
                              ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400 opacity-40"
                              : time === slot
                                ? "text-white"
                                : "border border-[#C7D5E7] bg-white text-[#2A394B] hover:border-[#A0B6D0] hover:text-[#4A688C]"
                          }`}
                          style={!past && time === slot ? { background: GOLD } : undefined}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
                {time && !isSlotPast(time, date, now) && (
                  <p className="mt-1 text-xs text-[#75869B]">
                    Selecionado: <span className="font-semibold text-[#4A688C]">{time}</span>
                  </p>
                )}
              </Field>
            )}

            {/* Aceita antecipar */}
            <div className="flex items-center justify-between rounded-xl border border-[#C7D5E7] bg-[#F1F5FA] p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-[#2A394B]">
                  <Zap size={14} className="text-[#4A688C]" /> Aceita antecipar?
                </div>
                <p className="text-xs text-[#75869B]">Será avisado se surgir uma vaga antes.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={anticipate}
                onClick={() => setAnticipate((v) => !v)}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#A0B6D0] focus:ring-offset-2"
                style={{ background: anticipate ? "#4A688C" : "#B5C2D1" }}
              >
                <span
                  className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform"
                  style={{ transform: anticipate ? "translateX(1.25rem)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Observações */}
            <Field label={<span>Observações <span className="text-xs font-normal text-[#75869B]">(opcional)</span></span>}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Alguma informação adicional para a G-Tech?"
                className="fi resize-none"
              />
            </Field>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || initialLoading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: GOLD }}
            >
              {saving ? "Confirmando..." : "Confirmar agendamento"}
            </button>
          </form>
        </div>
      </main>

      <style>{`
        .fi {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #C7D5E7;
          background: white;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.5;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          color: #2A394B;
        }
        .fi::placeholder { color: #75869B; }
        .fi:focus {
          border-color: #A0B6D0;
          box-shadow: 0 0 0 2px rgba(160, 182, 208,0.2);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#2A394B]">{label}</label>
      {children}
    </div>
  );
}
