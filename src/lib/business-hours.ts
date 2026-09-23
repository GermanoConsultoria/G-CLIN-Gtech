export type BusinessHoursRow = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Gera os slots de início de atendimento válidos para um dia.
 * Slots em que o atendimento ultrapassaria o fechamento são excluídos.
 * Slots com sobreposição no intervalo (almoço) são excluídos.
 * Retorna [] se o dia estiver fechado.
 */
export function generateSlotsForDay(bh: BusinessHoursRow, durationMinutes: number): string[] {
  if (!bh.is_open) return [];

  const open  = toMin(bh.open_time);
  const close = toMin(bh.close_time);
  const bkStart = bh.break_start ? toMin(bh.break_start) : null;
  const bkEnd   = bh.break_end   ? toMin(bh.break_end)   : null;

  const slots: string[] = [];
  for (let t = open; t + durationMinutes <= close; t += 30) {
    if (bkStart !== null && bkEnd !== null) {
      const slotEnd = t + durationMinutes;
      if (t < bkEnd && slotEnd > bkStart) continue;
    }
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}
