import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type MsgKind = "agendamento" | "confirmacao" | "reagendamento" | "antecipar";

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function buildMessage(opts: {
  kind: MsgKind;
  patientName: string;
  scheduledAt: Date;
  type: "consulta" | "retorno";
  planName?: string | null;
  newSlot?: Date;
}): string {
  const when = format(opts.scheduledAt, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  const tipo = opts.type === "retorno" ? "retorno" : "consulta";
  const plano = opts.planName ? ` (${opts.planName})` : "";

  switch (opts.kind) {
    case "agendamento":
      return `Olá, ${opts.patientName}! 👋\n\nSua ${tipo}${plano} foi agendada para *${when}*.\n\nQualquer dúvida, é só responder esta mensagem.`;
    case "confirmacao":
      return `Olá, ${opts.patientName}! Lembrete da sua ${tipo}${plano} amanhã, *${when}*.\n\nPor favor, confirme respondendo *SIM* ✅ ou *NÃO* ❌.`;
    case "reagendamento":
      return `Olá, ${opts.patientName}! Precisamos *reagendar* sua ${tipo}${plano} que estava marcada para ${when}.\n\nPor favor, entre em contato para escolher um novo horário.`;
    case "antecipar": {
      const novo = opts.newSlot
        ? format(opts.newSlot, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
        : when;
      return `Olá, ${opts.patientName}! 🎉 Surgiu uma *vaga antecipada* para *${novo}*.\n\nVocê manifestou interesse em antecipar. Se quiser ficar com este horário, responda *SIM* o quanto antes — vai para quem responder primeiro!`;
    }
  }
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
}
