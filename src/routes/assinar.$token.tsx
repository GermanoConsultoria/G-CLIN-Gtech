import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Eraser, Loader2, PenLine, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import logoGTech from "@/assets/g-tech-logo.png";

export const Route = createFileRoute("/assinar/$token")({ component: AssinarPage });

const GOLD = "linear-gradient(135deg, #B4C6DC 0%, #A0B6D0 50%, #4A688C 100%)";

const TEXTO_TERMO_PACIENTE =
  "Me responsabilizo pelo questionário e autorizo a realização dos procedimentos descritos na ficha de avaliação, " +
  "afirmando serem verídicas todas as informações fornecidas. Fico ciente de que as sessões não desmarcadas serão " +
  "dadas como realizadas. Além disso, autorizo a utilização de uso de imagem.";

const TEXTO_TERMO_MEDICA =
  "Declaro que realizei a avaliação/atendimento descrito nesta ficha e confirmo a veracidade das informações " +
  "clínicas nela registradas.";

type Ficha = {
  nome_paciente: string | null;
  data_avaliacao: string | null;
  tipo: "paciente" | "medica" | null;
};
type Tela = "loading" | "invalido" | "intro" | "assinatura" | "sucesso";

function AssinarPage() {
  const { token } = Route.useParams() as { token: string };

  const [tela, setTela] = useState<Tela>("loading");
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [saving, setSaving] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("rpc_get_ficha_para_assinatura", {
        p_token: token,
      });
      if (error || !data) {
        setTela("invalido");
        return;
      }
      setFicha(data as Ficha);
      setTela("intro");
    })();
  }, [token]);

  async function handleConcluir() {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Assine no campo acima antes de concluir");
      return;
    }
    setSaving(true);
    const imagem = padRef.current.toDataURL();
    const { data, error } = await supabase.rpc("rpc_concluir_assinatura", {
      p_token: token,
      p_assinatura_imagem: imagem,
    });
    setSaving(false);
    if (error || !data) {
      setTela("invalido");
      return;
    }
    setTela("sucesso");
  }

  const dataFmt = ficha?.data_avaliacao
    ? format(parseISO(ficha.data_avaliacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "—";
  const ehMedica = ficha?.tipo === "medica";

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#F1F5FA] px-5 py-10">
      <img
        src={logoGTech}
        alt="G-Tech"
        className="mb-8 h-20 w-auto max-w-[220px] object-contain"
        style={{ filter: "drop-shadow(0 4px 20px rgba(160, 182, 208,0.35))" }}
      />

      <div className="w-full max-w-md">
        {tela === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#A0B6D0]" />
            <p className="text-sm text-[#45576E]">Carregando prontuário...</p>
          </div>
        )}

        {tela === "invalido" && (
          <div className="rounded-2xl border border-[#C7D5E7] bg-white p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <ShieldAlert className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="font-display text-lg font-bold text-[#2A394B]">
              Link inválido ou expirado
            </h1>
            <p className="mt-2 text-sm text-[#45576E]">
              Peça para a profissional gerar um novo QR code de assinatura.
            </p>
          </div>
        )}

        {tela === "intro" && (
          <div className="rounded-2xl border border-[#C7D5E7] bg-white p-6 text-center">
            <h1 className="font-display text-xl font-bold text-[#2A394B]">
              {ehMedica
                ? "Olá, G-Tech!"
                : `Olá, ${ficha?.nome_paciente ?? "paciente"}!`}
            </h1>
            <p className="mt-2 text-sm text-[#45576E]">
              Ficha de avaliação de {dataFmt}
              {!ehMedica && ` — paciente ${ficha?.nome_paciente ?? ""}`}. Toque em "Assinar" para
              ler o termo e confirmar sua assinatura digital.
            </p>
            <button
              onClick={() => setTela("assinatura")}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: GOLD }}
            >
              <PenLine className="h-4 w-4" /> Assinar
            </button>
          </div>
        )}

        {tela === "assinatura" && (
          <div className="rounded-2xl border border-[#C7D5E7] bg-white p-6">
            <h2 className="font-display text-lg font-bold text-[#2A394B]">
              {ehMedica ? "Declaração da profissional" : "Termo de responsabilidade"}
            </h2>
            <p className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-[#C7D5E7] bg-[#F1F5FA] p-3 text-xs leading-relaxed text-[#45576E]">
              {ehMedica ? TEXTO_TERMO_MEDICA : TEXTO_TERMO_PACIENTE}
            </p>

            <p className="mb-2 mt-5 text-sm font-medium text-[#2A394B]">
              Assine abaixo com o dedo:
            </p>
            <div className="overflow-hidden rounded-xl border-2 border-dashed border-[#A0B6D0]">
              <SignaturePad ref={padRef} className="h-40 w-full touch-none bg-white" />
            </div>
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#4A688C] hover:underline"
            >
              <Eraser className="h-3.5 w-3.5" /> Limpar assinatura
            </button>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setTela("intro")}
                className="flex-1 rounded-xl border border-[#C7D5E7] py-3 text-sm font-semibold text-[#45576E] hover:bg-[#F1F5FA]"
              >
                Voltar
              </button>
              <button
                onClick={handleConcluir}
                disabled={saving}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: GOLD }}
              >
                {saving ? "Enviando..." : "Concluir"}
              </button>
            </div>
          </div>
        )}

        {tela === "sucesso" && (
          <div className="rounded-2xl border border-[#C7D5E7] bg-white p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h1 className="font-display text-xl font-bold text-[#2A394B]">Assinatura concluída!</h1>
            <p className="mt-2 text-sm text-[#45576E]">
              {ehMedica
                ? "Assinatura da médica registrada com sucesso."
                : `Obrigada, ${ficha?.nome_paciente}. Pode devolver o celular para a profissional.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
