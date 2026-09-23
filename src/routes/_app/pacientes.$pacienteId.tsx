import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import logoGTech from "@/assets/g-tech-logo.png";
import {
  ArrowLeft, FileText, Upload, Trash2, Download, Eye,
  Loader2, FilePlus, ClipboardList, FolderOpen, X,
  CheckCircle2, Phone, Mail, MapPin, Cake, Plus,
  PenLine, Copy, User, Stethoscope,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/pacientes/$pacienteId")({ component: PacienteDetalhe });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Paciente = {
  id: string; nome: string; data_nasc: string | null;
  cpf: string | null; telefone: string | null; email: string | null;
  endereco: string | null; bairro: string | null; cidade: string | null;
  estado: string | null; cep: string | null; profissao: string | null;
  estado_civil: string | null;
};

type Arquivo = {
  id: string; nome: string; tipo: string | null;
  url: string; tamanho: number | null; created_at: string;
};

type FichaResumo = {
  id: string; data_avaliacao: string; created_at: string;
  assinado_em: string | null; assinado_medico_em: string | null;
};
type FichaData = Record<string, string | boolean | null>;
type Aba = "anamnese" | "arquivos";

const fmt = (d: string | null) =>
  d ? format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }) : "—";
const fmtBytes = (b: number | null) =>
  !b ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const fileIcon = (tipo: string | null) =>
  tipo?.startsWith("image/") ? "🖼️" : tipo === "application/pdf" ? "📄" : "📎";

// ── Helper UI components (module-level — prevents remounting on re-render) ────

function Secao({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 mb-3 text-xs font-bold uppercase tracking-widest text-[#4A688C] border-b border-[#A0B6D0]/20 pb-1">
      {children}
    </p>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 mb-1">{children}</label>;
}

function FInput({
  value = "",
  onChange,
  placeholder = "",
  type = "text",
  disabled = false,
}: {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none disabled:opacity-60"
    />
  );
}

function FTextarea({
  value = "",
  onChange,
  placeholder = "",
}: {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={2}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none resize-none"
    />
  );
}

function YN({
  name,
  value,
  label,
  onChange,
}: {
  name: string;
  value: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-1.5 border-b border-gray-50">
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
        <input type="radio" name={name} checked={value} onChange={() => onChange(true)} className="accent-[#4A688C]" /> Sim
      </label>
      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
        <input type="radio" name={name} checked={!value} onChange={() => onChange(false)} className="accent-[#4A688C]" /> Não
      </label>
    </div>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Row3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>;
}

function calcIdade(dataNasc: string | null): string {
  if (!dataNasc) return "—";
  const diff = Date.now() - new Date(dataNasc).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + " anos";
}

function fmtTelFixo(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

function fmtCelular(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function fmtCPF(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Geração de PDF (módulo — pode ser chamada de fora do modal) ──────────────
async function gerarPDF(formData: FichaData, paciente: Paciente): Promise<void> {
  const str  = (k: string) => (formData[k] as string) ?? "";
  const bool = (k: string) => !!formData[k];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Carrega logo como base64 via canvas ──────────────────────────────
  const img = new Image();
  img.src = logoGTech;
  await new Promise<void>(resolve => { img.onload = () => resolve(); });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx!.fillStyle = "#FFFFFF";
  ctx!.fillRect(0, 0, canvas.width, canvas.height);
  ctx!.drawImage(img, 0, 0);
  const logoBase64 = canvas.toDataURL("image/jpeg", 1.0);

  // ── Layout constants ──────────────────────────────────────────────────
  const PW = 210, PH = 297;
  const ML = 15, MR = 15, MT = 15;
  const CW = PW - ML - MR;
  const BODY_MAX = PH - 18;
  const FOOTER_LINE = PH - 12; // eslint-disable-line @typescript-eslint/no-unused-vars
  const FOOTER_TXT  = PH - 8;  // eslint-disable-line @typescript-eslint/no-unused-vars
  const CB = 3.2;

  // ── Color palette (RGB) ──────────────────────────────────────────────
  const GOLD   = [140, 79, 74]   as const;
  const GOLD_S = [251, 241, 240] as const;
  const TEXT   = [51,  51,  51]  as const;
  const LABEL  = [102, 102, 102] as const;
  const BLACK  = [0,   0,   0]   as const;
  const LGRAY  = [200, 200, 200] as const;

  let y = MT;

  const tc = (c: readonly [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const fc = (c: readonly [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const dc = (c: readonly [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const dataAvStr = str("data_avaliacao");
  const dataAvFmt = dataAvStr
    ? format(parseISO(dataAvStr), "dd/MM/yyyy", { locale: ptBR })
    : "—";

  function guard(h: number) {
    if (y + h > BODY_MAX) {
      doc.addPage();
      y = MT;
      miniHeader();
    }
  }

  function miniHeader() {
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); tc(GOLD);
    doc.text("Ficha de Avaliação Geral — G-Tech", ML, y);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); tc(LABEL);
    doc.text(`Data: ${dataAvFmt}`, PW - MR, y, { align: "right" });
    y += 3;
    dc(GOLD); doc.setLineWidth(0.3);
    doc.line(ML, y, PW - MR, y);
    y += 6;
  }

  function drawFooters() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total   = (doc as any).internal?.getNumberOfPages?.() ?? 1;
    const gerado  = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageH   = (doc as any).internal.pageSize.getHeight() as number;
    const footerY = pageH - 15;
    const infoY   = footerY - 8;
    const GRAY88  = [136, 136, 136] as const;
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      if (i === total) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); tc(GRAY88);
        doc.text(
          "R. Faustino Custódio dos Santos, 160 - Parque Cidade Nova, Mogi Guaçu - SP, 13845-425",
          PW / 2, infoY, { align: "center" }
        );
        doc.text("Instagram: @gtech", PW / 2, infoY + 4, { align: "center" });
      }
      dc(LGRAY); doc.setLineWidth(0.2);
      doc.line(ML, footerY, PW - MR, footerY);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); tc(LABEL);
      doc.text(`Gerado em: ${gerado}`, ML, footerY + 4);
      doc.text(`Página ${i} de ${total}`, PW - MR, footerY + 4, { align: "right" });
    }
  }

  function secao(titulo: string) {
    guard(14);
    y += 3;
    fc(GOLD_S); dc(GOLD_S);
    doc.rect(ML, y - 5.5, CW, 7.5, "F");
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); tc(GOLD);
    doc.text(titulo.toUpperCase(), ML + 2, y);
    y += 6;
    tc(TEXT);
  }

  function f(label: string, valor: string | boolean | null | undefined, indent = 0) {
    let v: string;
    if (typeof valor === "boolean") v = valor ? "Sim" : "Não";
    else v = (valor as string | null | undefined) || "—";
    const x = ML + indent;
    const w = CW - indent;
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); tc(LABEL);
    const lbl = `${label}: `;
    const lw = doc.getTextWidth(lbl);
    const lines = doc.splitTextToSize(v, w - lw) as string[];
    guard(lines.length * 4.5 + 1.5);
    doc.text(lbl, x, y);
    doc.setFont("helvetica", "normal"); tc(BLACK);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) { y += 4.5; guard(5); }
      doc.text(lines[i], x + lw, y);
    }
    y += 5;
  }

  function f2(
    l1: string, v1: string | null | undefined,
    l2: string, v2: string | null | undefined,
  ) {
    guard(6);
    const col = CW / 2 - 2;
    doc.setFontSize(8.5);
    ([{ l: l1, v: v1, x: ML }, { l: l2, v: v2, x: ML + CW / 2 }] as const).forEach(({ l, v, x }) => {
      const lbl = `${l}: `;
      doc.setFont("helvetica", "bold"); tc(LABEL);
      const lw = doc.getTextWidth(lbl);
      doc.text(lbl, x, y);
      doc.setFont("helvetica", "normal"); tc(BLACK);
      doc.text((doc.splitTextToSize(v || "—", col - lw) as string[])[0], x + lw, y);
    });
    y += 5;
  }

  function f3(
    l1: string, v1: string | null | undefined,
    l2: string, v2: string | null | undefined,
    l3: string, v3: string | null | undefined,
  ) {
    guard(6);
    const col = CW / 3 - 2;
    doc.setFontSize(8.5);
    ([
      { l: l1, v: v1, x: ML },
      { l: l2, v: v2, x: ML + CW / 3 },
      { l: l3, v: v3, x: ML + (CW * 2) / 3 },
    ] as const).forEach(({ l, v, x }) => {
      const lbl = `${l}: `;
      doc.setFont("helvetica", "bold"); tc(LABEL);
      const lw = doc.getTextWidth(lbl);
      doc.text(lbl, x, y);
      doc.setFont("helvetica", "normal"); tc(BLACK);
      doc.text((doc.splitTextToSize(v || "—", col - lw) as string[])[0], x + lw, y);
    });
    y += 5;
  }

  function yn(label: string, key: string, subKey?: string, subLabel = "Qual") {
    const v = bool(key);
    const CBX = PW - MR - 26;
    doc.setFontSize(8.5);
    const lblLines = doc.splitTextToSize(label, CBX - ML - 2) as string[];
    guard(lblLines.length * 4.5 + (v && subKey ? 5.5 : 1));
    doc.setFont("helvetica", "normal"); tc(TEXT);
    doc.text(lblLines[0], ML, y);
    dc([130, 130, 130]); doc.setLineWidth(0.25);
    doc.rect(CBX, y - CB + 0.4, CB, CB);
    if (v) {
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); tc([0, 130, 0]);
      doc.text("X", CBX + 0.55, y - 0.15);
    }
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); tc(TEXT);
    doc.text("Sim", CBX + CB + 1, y);
    const CBX2 = CBX + 13;
    dc([130, 130, 130]);
    doc.rect(CBX2, y - CB + 0.4, CB, CB);
    if (!v) {
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); tc([190, 0, 0]);
      doc.text("X", CBX2 + 0.55, y - 0.15);
    }
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); tc(TEXT);
    doc.text("Não", CBX2 + CB + 1, y);
    for (let i = 1; i < lblLines.length; i++) {
      y += 4.5; guard(5);
      doc.text(lblLines[i], ML, y);
    }
    y += 5;
    if (v && subKey) {
      const sv = str(subKey) || "—";
      guard(5);
      doc.setFontSize(8);
      const sublbl = `${subLabel}: `;
      doc.setFont("helvetica", "bold"); tc(LABEL);
      const slw = doc.getTextWidth(sublbl);
      doc.text(sublbl, ML + 6, y);
      doc.setFont("helvetica", "normal"); tc(BLACK);
      doc.text((doc.splitTextToSize(sv, CW - 6 - slw) as string[])[0], ML + 6 + slw, y);
      y += 5;
      doc.setFontSize(8.5);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // CABEÇALHO — PÁGINA 1
  // ════════════════════════════════════════════════════════════════════════

  doc.addImage(logoBase64, "JPEG", 10, 15, 25, (25 * img.height) / img.width);
  const TITLE_LEFT = 38;
  const TITLE_CX   = TITLE_LEFT + (PW - MR - TITLE_LEFT) / 2;
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); tc(GOLD);
  doc.text("Ficha de Avaliação Geral", TITLE_CX, 20, { align: "center" });
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); tc(LABEL);
  doc.text("G-Tech", TITLE_CX, 28, { align: "center" });
  doc.setFontSize(9); tc(TEXT);
  doc.text(`Data: ${dataAvFmt}`, PW - MR, 34, { align: "right" });
  y = 36;
  dc(GOLD); doc.setLineWidth(0.6);
  doc.line(ML, y, PW - MR, y);
  y += 8;

  // ════════════════════════════════════════════════════════════════════════
  // DADOS PESSOAIS
  // ════════════════════════════════════════════════════════════════════════
  secao("Dados Pessoais");
  f2("Nome", paciente.nome, "Idade", calcIdade(paciente.data_nasc));
  f("Endereço", paciente.endereco);
  f3("CEP", paciente.cep, "Bairro", paciente.bairro,
    "Cidade / Estado", [paciente.cidade, paciente.estado].filter(Boolean).join(" / ") || null);
  f3("Tel. Residencial", str("telefone_residencial") || null,
    "Tel. Comercial",  str("telefone_comercial")    || null,
    "Celular",         fmtCelular(paciente.telefone ?? "") || null);
  f3("Data de Nasc.", paciente.data_nasc ? fmt(paciente.data_nasc) : null,
    "CPF",       fmtCPF(paciente.cpf ?? "") || null,
    "Profissão", paciente.profissao);
  f2("Estado Civil", paciente.estado_civil, "E-mail", paciente.email);
  y += 2;

  // ════════════════════════════════════════════════════════════════════════
  // QUEIXA PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════
  secao("Queixa Principal");
  f2("Queixa", str("queixa") || null, "Duração", str("duracao_queixa") || null);
  y += 2;

  // ════════════════════════════════════════════════════════════════════════
  // HÁBITOS DIÁRIOS
  // ════════════════════════════════════════════════════════════════════════
  secao("Hábitos Diários");
  yn("Tratamento estético anterior?",  "trat_estetico_anterior", "trat_estetico_qual");
  yn("Usa lentes de contato?",          "usa_lente_contato");
  yn("Utilização de cosméticos?",       "usa_cosmeticos",   "cosmeticos_qual");
  yn("Exposição ao sol?",               "exposicao_sol");
  yn("Filtro solar?",                   "filtro_solar",     "filtro_solar_frequencia", "Frequência");
  yn("Tabagismo?",                      "tabagismo",        "tabagismo_quantidade",    "Cigarros/dia");
  yn("Ingere bebida alcoólica?",        "alcool",           "alcool_frequencia",       "Frequência");
  f("Funcionamento intestinal",          str("funcionamento_intestinal"));
  f2("Qualidade do sono",               str("qualidade_sono")  || null,
     "Horas de sono/noite",             str("horas_sono")      || null);
  yn("Passa muito tempo em pé e/ou sentada?", "muito_tempo_pe_sentada", "quanto_tempo_pe_sentada", "Quanto tempo");
  f("Ingestão de água (copos/dia)",      str("ingestao_agua_copos"));
  f2("Tipo de alimentação",             str("tipo_alimentacao")      || null,
     "Alimentos de preferência",        str("alimentos_preferencia") || null);
  yn("Pratica atividade física?",        "atividade_fisica");
  if (bool("atividade_fisica")) {
    f2("Tipo de atividade", str("atividade_fisica_tipo") || null,
       "Frequência",        str("atividade_fisica_frequencia") || null);
  }
  yn("Uso de anticoncepcional?",         "anticoncepcional", "anticoncepcional_qual");
  f("Data do 1º dia da última menstruação",
    str("dt_ultima_menstruacao") ? fmt(str("dt_ultima_menstruacao")) : null);
  yn("Gestante?",                        "gestante");
  yn("Gestações anteriores?",            "gestacoes");
  if (bool("gestacoes")) {
    f2("Quantas",         str("gestacoes_quantas") || null,
       "Há quanto tempo", str("gestacoes_tempo")   || null);
  }
  y += 2;

  // ════════════════════════════════════════════════════════════════════════
  // HISTÓRICO CLÍNICO
  // ════════════════════════════════════════════════════════════════════════
  secao("Histórico Clínico");
  yn("Tratamento médico atual?",                      "tratamento_medico_atual",    "medicamentos_uso",               "Medicamentos em uso");
  yn("Uso de anticoagulantes?",                       "uso_anticoagulantes",        "anticoagulantes_quais",          "Quais");
  yn("Antecedentes alérgicos?",                       "antecedentes_alergicos",     "alergias_quais",                 "Quais");
  yn("Reação alérgica a anestésicos? (ex.: lidocaína)","alergia_anestesico");
  yn("Portador de marcapasso?",                       "marcapasso");
  yn("Alterações cardíacas?",                         "alteracoes_cardiacas",       "alteracoes_cardiacas_quais",     "Quais");
  yn("Hipo/hipertensão arterial?",                    "hipo_hipertensao");
  yn("Distúrbio circulatório?",                       "disturbio_circulatorio",     "disturbio_circulatorio_qual",   "Qual");
  yn("Distúrbio renal?",                              "disturbio_renal",            "disturbio_renal_qual",          "Qual");
  yn("Distúrbio hormonal?",                           "disturbio_hormonal",         "disturbio_hormonal_qual",       "Qual");
  yn("Distúrbio gastro-intestinal?",                  "disturbio_gastro",           "disturbio_gastro_qual",         "Qual");
  yn("Epilepsia / convulsões?",                       "epilepsia",                  "epilepsia_frequencia",          "Frequência");
  yn("Alterações psicológicas / psiquiátricas?",      "alteracoes_psicologicas",    "alteracoes_psicologicas_quais", "Quais");
  yn("Estresse?",                                     "estresse",                   "estresse_obs",                  "Observações");
  yn("Antecedentes oncológicos?",                     "antecedentes_oncologicos",   "antecedentes_oncologicos_qual", "Qual");
  yn("Diabetes?",                                     "diabetes",                   "diabetes_tipo",                 "Tipo");
  yn("Doença autoimune?",                             "doenca_autoimune",           "doenca_autoimune_qual",         "Qual");
  yn("Soropositivo?",                                 "soropositivo");
  f("Outra condição / doença pré-existente",           str("outra_condicao"));
  f("Data do último Check-Up",
    str("dt_ultimo_checkup") ? fmt(str("dt_ultimo_checkup")) : null);
  y += 2;

  // ════════════════════════════════════════════════════════════════════════
  // TRATAMENTO ESTÉTICO / CIRÚRGICO
  // ════════════════════════════════════════════════════════════════════════
  secao("Tratamento da Medicina Estética e Cirúrgica");
  yn("Próteses metálicas?",               "proteses_metalicas",   "proteses_metalicas_qual",  "Qual");
  yn("Implante dentário?",                "implante_dentario");
  yn("Tratamento dermatológico / estético?","trat_dermatologico",  "trat_dermatologico_qual",  "Qual");
  yn("Cirurgia plástica estética?",        "cirurgia_plastica",    "cirurgia_plastica_qual",   "Qual");
  yn("Cirurgia reparadora?",               "cirurgia_reparadora",  "cirurgia_reparadora_qual", "Qual");
  y += 2;

  // ════════════════════════════════════════════════════════════════════════
  // AUTORIZAÇÃO
  // ════════════════════════════════════════════════════════════════════════
  secao("Autorização");
  const textoAuth = "Me responsabilizo pelo questionário e autorizo a realização dos procedimentos descritos anteriormente, afirmando serem verídicas todas as informações fornecidas. Fico ciente de que as sessões não desmarcadas serão dadas como realizadas. Além disso, autorizo a utilização de uso de imagem.";
  const authLines = doc.splitTextToSize(textoAuth, CW - 4) as string[];
  const authH = authLines.length * 4.2 + 6;
  guard(authH + 4);
  fc(GOLD_S); dc(GOLD_S);
  doc.roundedRect(ML, y - 4.5, CW, authH, 1.5, 1.5, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "italic"); tc([80, 80, 80]);
  doc.text(authLines, ML + 2, y);
  y += authH;
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
  ([
    { label: "A paciente confirma e autoriza os procedimentos", key: "autorizado" },
    { label: "Autoriza uso de imagem",                          key: "autoriza_imagem" },
  ] as const).forEach(({ label, key }) => {
    guard(6);
    const v = bool(key);
    dc([130, 130, 130]); doc.setLineWidth(0.25);
    doc.rect(ML, y - CB + 0.4, CB, CB);
    if (v) {
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); tc([0, 130, 0]);
      doc.text("X", ML + 0.55, y - 0.15);
      doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    }
    tc(TEXT);
    doc.text(label, ML + CB + 2, y);
    y += 5;
  });
  f("Data da assinatura",
    str("data_assinatura") ? fmt(str("data_assinatura")) : null);
  guard(34);
  y += 10;
  const SIG_W = 70;
  const SIG_L = 25;
  const SIG_R = 115;
  const GRAY66 = [120, 120, 120] as const;
  const GRAY44 = [136, 136, 136] as const;
  const SIG_H = 9;
  const assinaturaImg = str("assinatura_imagem");
  const assinaturaMedicoImg = str("assinatura_medico_imagem");
  if (assinaturaImg) doc.addImage(assinaturaImg, "PNG", SIG_L, y - SIG_H - 0.5, SIG_W, SIG_H);
  if (assinaturaMedicoImg) doc.addImage(assinaturaMedicoImg, "PNG", SIG_R, y - SIG_H - 0.5, SIG_W, SIG_H);
  dc(GRAY66); doc.setLineWidth(0.4);
  doc.line(SIG_L, y, SIG_L + SIG_W, y);
  doc.line(SIG_R, y, SIG_R + SIG_W, y);
  y += 5;
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); tc(LABEL);
  doc.text("Assinatura do Cliente",  SIG_L + SIG_W / 2, y, { align: "center" });
  doc.text("G-Tech", SIG_R + SIG_W / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); tc(GRAY44);
  const assinadoEmStr = str("assinado_em");
  const clienteSubLabel = assinaturaImg
    ? `Assinado digitalmente${assinadoEmStr ? " em " + format(parseISO(assinadoEmStr), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}`
    : "(Assinatura via Gov)";
  const assinadoMedicoEmStr = str("assinado_medico_em");
  const medicoSubLabel = assinaturaMedicoImg
    ? `Assinado digitalmente${assinadoMedicoEmStr ? " em " + format(parseISO(assinadoMedicoEmStr), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}`
    : "(Assinatura via Gov)";
  doc.text(clienteSubLabel, SIG_L + SIG_W / 2, y, { align: "center" });
  doc.text(medicoSubLabel, SIG_R + SIG_W / 2, y, { align: "center" });

  drawFooters();

  const nomeArq = paciente.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_");
  const dataArq = dataAvStr || format(new Date(), "yyyy-MM-dd");
  doc.save(`Prontuario_${nomeArq}_${dataArq}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA — DETALHE DO PACIENTE
// ═══════════════════════════════════════════════════════════════════════════════

function PacienteDetalhe() {
  const { pacienteId } = Route.useParams() as { pacienteId: string };
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [fichas, setFichas] = useState<FichaResumo[]>([]);
  const [aba, setAba] = useState<Aba>("anamnese");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAnamnese, setShowAnamnese] = useState(false);
  const [fichaEditId, setFichaEditId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [assinar, setAssinar] = useState<{ fichaId: string; modo: "escolha" | "paciente" | "medica" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchAll(silent = false) {
    // `silent` evita o spinner de tela cheia (que desmontaria modais abertos,
    // como o de assinatura digital) em refetches de fundo — ex.: quando a
    // paciente assina e o AssinarModal só quer atualizar o status sem se
    // desmontar/remontar (o que geraria um token novo e voltaria pra "aguardando").
    if (!silent) setLoading(true);
    const [pRes, aRes, fRes] = await Promise.all([
      db.from("pacientes").select("*").eq("id", pacienteId).single(),
      db.from("arquivos_paciente").select("*").eq("paciente_id", pacienteId).order("created_at", { ascending: false }),
      db.from("fichas_anamnese").select("id,data_avaliacao,created_at,assinado_em,assinado_medico_em").eq("paciente_id", pacienteId).order("created_at", { ascending: false }),
    ]);
    if (!silent) setLoading(false);
    if (pRes.error) { toast.error("Paciente não encontrado"); navigate({ to: "/pacientes" as never }); return; }
    setPaciente(pRes.data as Paciente);
    setArquivos((aRes.data ?? []) as Arquivo[]);
    setFichas((fRes.data ?? []) as FichaResumo[]);
  }

  useEffect(() => { fetchAll(); }, [pacienteId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const path = `${user!.id}/${pacienteId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("arquivos-pacientes").upload(path, file);
      if (upErr) { toast.error(`Erro ao enviar ${file.name}: ${upErr.message}`); continue; }
      const { data: urlData } = supabase.storage.from("arquivos-pacientes").getPublicUrl(path);
      await db.from("arquivos_paciente").insert({
        paciente_id: pacienteId, user_id: user!.id,
        nome: file.name, tipo: file.type, url: urlData.publicUrl, tamanho: file.size,
      });
    }
    setUploading(false);
    toast.success("Arquivo(s) enviado(s)!");
    fetchAll();
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDeleteArquivo(id: string) {
    if (!confirm("Remover este arquivo?")) return;
    const { error } = await db.from("arquivos_paciente").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Arquivo removido");
    setArquivos((p) => p.filter((a) => a.id !== id));
  }

  async function handleCancelarAssinatura(fichaId: string) {
    if (!confirm("Cancelar a(s) assinatura(s)? Será preciso assinar novamente.")) return;
    const { data, error } = await db.from("fichas_anamnese").update({
      assinatura_imagem: null, assinado_em: null, data_assinatura: null,
      autorizado: false, autoriza_imagem: false,
      assinatura_medico_imagem: null, assinado_medico_em: null,
    }).eq("id", fichaId).select("id");
    if (error || !data || data.length === 0) { toast.error("Erro ao cancelar assinatura"); return; }
    toast.success("Assinatura(s) cancelada(s)");
    fetchAll();
  }

  async function handleVisualizar(url: string) {
    const path = url.split("/arquivos-pacientes/")[1];
    const { data, error } = await supabase.storage
      .from("arquivos-pacientes")
      .createSignedUrl(path, 3600);
    if (error || !data) { toast.error("Erro ao abrir arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#A0B6D0]" />
    </div>
  );
  if (!paciente) return null;

  return (
    <div className="mx-auto max-w-4xl">

      {/* Voltar */}
      <button
        onClick={() => navigate({ to: "/pacientes" as never })}
        className="mb-6 flex items-center gap-2 text-sm text-[#4A688C] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Pacientes
      </button>

      {/* Card do Paciente */}
      <div className="mb-6 rounded-2xl border border-[#A0B6D0]/20 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#A0B6D0]/15 text-[#4A688C] font-bold text-2xl">
              {paciente.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-[#4A688C]">{paciente.nome}</h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {paciente.data_nasc && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Cake className="h-3.5 w-3.5" />{fmt(paciente.data_nasc)}
                  </span>
                )}
                {paciente.telefone && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />{paciente.telefone}
                  </span>
                )}
                {paciente.email && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />{paciente.email}
                  </span>
                )}
                {(paciente.cidade || paciente.estado) && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {[paciente.cidade, paciente.estado].filter(Boolean).join(" / ")}
                  </span>
                )}
                {paciente.profissao && (
                  <span className="text-sm text-muted-foreground">{paciente.profissao}</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => { setFichaEditId(null); setShowAnamnese(true); setAba("anamnese"); }}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#4A688C] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#3D5674] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Prontuário
          </button>
        </div>
      </div>

      {/* Seletor de Abas */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {(["anamnese", "arquivos"] as const).map((key) => {
          const cfg = {
            anamnese: { label: "Prontuários", Icon: ClipboardList, count: fichas.length },
            arquivos:  { label: "Arquivos",   Icon: FolderOpen,   count: arquivos.length },
          }[key];
          return (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                aba === key
                  ? "bg-white text-[#4A688C] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <cfg.Icon className="h-4 w-4" />
              {cfg.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                aba === key ? "bg-[#A0B6D0]/15 text-[#4A688C]" : "bg-gray-200 text-gray-500"
              }`}>
                {cfg.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── ABA PRONTUÁRIOS ── */}
      {aba === "anamnese" && (
        <div>
          {fichas.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[#A0B6D0]/30 py-24 text-center">
              <div className="rounded-full bg-[#A0B6D0]/10 p-4">
                <ClipboardList className="h-8 w-8 text-[#A0B6D0]" />
              </div>
              <div>
                <p className="font-semibold text-gray-700">Nenhum prontuário cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">Clique em "Adicionar Prontuário" para começar</p>
              </div>
              <button
                onClick={() => { setFichaEditId(null); setShowAnamnese(true); }}
                className="flex items-center gap-2 rounded-xl bg-[#4A688C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3D5674] transition-colors"
              >
                <FilePlus className="h-4 w-4" /> Adicionar Prontuário
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {fichas.map((f, i) => (
                <div
                  key={f.id}
                  onClick={() => { setFichaEditId(f.id); setShowAnamnese(true); }}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm text-left hover:border-[#A0B6D0]/40 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 font-bold text-lg">
                    {fichas.length - i}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Ficha de Avaliação Geral — {fmt(f.data_avaliacao)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Preenchida em {fmt(f.created_at)} · G-Tech
                    </p>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const qtdAssinaturas = (f.assinado_em ? 1 : 0) + (f.assinado_medico_em ? 1 : 0);
                      if (qtdAssinaturas === 0) return null;
                      const completo = qtdAssinaturas === 2;
                      return (
                        <button
                          onClick={() => handleCancelarAssinatura(f.id)}
                          className={`group flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-red-50 hover:text-red-600 ${
                            completo ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}
                          title="Cancelar assinatura(s) (permite refazer)"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 group-hover:hidden" />
                          <X className="hidden h-3.5 w-3.5 group-hover:block" />
                          <span className="group-hover:hidden">{completo ? "Assinado" : "1 assinatura"}</span>
                          <span className="hidden group-hover:inline">Cancelar</span>
                        </button>
                      );
                    })()}
                    <button
                      onClick={async () => {
                        setDownloadingPdf(f.id);
                        const { data } = await db.from("fichas_anamnese").select("*").eq("id", f.id).single();
                        if (data) await gerarPDF(data as FichaData, paciente!);
                        setDownloadingPdf(null);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-[#A0B6D0] px-3 py-1.5 text-xs font-medium text-[#4A688C] hover:bg-[#A0B6D0]/10 transition-colors"
                      title="Baixar PDF"
                    >
                      {downloadingPdf === f.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      <span>PDF</span>
                    </button>
                    {!(f.assinado_em && f.assinado_medico_em) && (
                      <button
                        onClick={() => setAssinar({ fichaId: f.id, modo: "escolha" })}
                        className="flex items-center gap-1.5 rounded-lg border border-[#A0B6D0] px-3 py-1.5 text-xs font-medium text-[#4A688C] hover:bg-[#A0B6D0]/10 transition-colors"
                        title="Assinatura digital"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        <span>Assinar</span>
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span className="text-xs font-medium text-[#4A688C]">Ver / Editar →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA ARQUIVOS ── */}
      {aba === "arquivos" && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="mb-5 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#A0B6D0]/40 bg-[#F0F5FB] py-10 text-center transition-colors hover:border-[#A0B6D0] hover:bg-[#ECF3FB]"
          >
            {uploading
              ? <Loader2 className="h-8 w-8 animate-spin text-[#A0B6D0]" />
              : <Upload className="h-8 w-8 text-[#A0B6D0]" />
            }
            <div>
              <p className="font-semibold text-[#4A688C]">{uploading ? "Enviando..." : "Clique para enviar arquivos"}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, imagens, documentos — qualquer formato</p>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />

          {arquivos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-center">
              <FileText className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-muted-foreground">Nenhum arquivo enviado ainda</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {arquivos.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <span className="text-2xl">{fileIcon(a.tipo)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{fmt(a.created_at)} · {fmtBytes(a.tamanho)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVisualizar(a.url)}
                      className="rounded-lg p-1.5 text-[#4A688C] hover:bg-[#A0B6D0]/10"
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-[#4A688C] hover:bg-[#A0B6D0]/10"
                      title="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteArquivo(a.id)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAnamnese && (
        <AnamneseModal
          paciente={paciente}
          fichaId={fichaEditId}
          userId={user!.id}
          onClose={() => setShowAnamnese(false)}
          onSaved={() => { fetchAll(); setShowAnamnese(false); }}
        />
      )}

      {assinar?.modo === "escolha" && (
        <AssinarEscolhaModal
          jaAssinouPaciente={!!fichas.find((f) => f.id === assinar.fichaId)?.assinado_em}
          jaAssinouMedica={!!fichas.find((f) => f.id === assinar.fichaId)?.assinado_medico_em}
          onClose={() => setAssinar(null)}
          onEscolher={(modo) => setAssinar({ fichaId: assinar.fichaId, modo })}
        />
      )}

      {(assinar?.modo === "paciente" || assinar?.modo === "medica") && (
        <AssinarModal
          fichaId={assinar.fichaId}
          tipo={assinar.modo}
          onClose={() => setAssinar(null)}
          onSigned={() => fetchAll(true)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL — ESCOLHA DE QUEM VAI ASSINAR
// ═══════════════════════════════════════════════════════════════════════════════

function AssinarEscolhaModal({ jaAssinouPaciente, jaAssinouMedica, onClose, onEscolher }: {
  jaAssinouPaciente: boolean;
  jaAssinouMedica: boolean;
  onClose: () => void;
  onEscolher: (modo: "paciente" | "medica") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
        <p className="text-center font-display text-lg font-bold text-[#4A688C]">Quem vai assinar?</p>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Escolha de quem é a assinatura digital deste prontuário.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          {!jaAssinouPaciente && (
            <button
              onClick={() => onEscolher("paciente")}
              className="flex items-center gap-3 rounded-xl border border-[#A0B6D0] p-4 text-left hover:bg-[#A0B6D0]/10 transition-colors"
            >
              <User className="h-6 w-6 shrink-0 text-[#4A688C]" />
              <div>
                <p className="text-sm font-semibold text-[#4A688C]">Paciente</p>
                <p className="text-xs text-muted-foreground">Gera QR code / link para assinar no celular</p>
              </div>
            </button>
          )}
          {!jaAssinouMedica && (
            <button
              onClick={() => onEscolher("medica")}
              className="flex items-center gap-3 rounded-xl border border-[#A0B6D0] p-4 text-left hover:bg-[#A0B6D0]/10 transition-colors"
            >
              <Stethoscope className="h-6 w-6 shrink-0 text-[#4A688C]" />
              <div>
                <p className="text-sm font-semibold text-[#4A688C]">Médica</p>
                <p className="text-xs text-muted-foreground">Assine agora mesmo, direto neste dispositivo</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL — ASSINATURA DIGITAL (QR CODE, PARA PACIENTE OU MÉDICA ASSINAREM NO CELULAR)
// ═══════════════════════════════════════════════════════════════════════════════

function AssinarModal({ fichaId, tipo, onClose, onSigned }: {
  fichaId: string;
  tipo: "paciente" | "medica";
  onClose: () => void;
  onSigned: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [signed, setSigned] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const campoAssinadoEm = tipo === "medica" ? "assinado_medico_em" : "assinado_em";
  const quemAssina = tipo === "medica" ? "a médica" : "a paciente";

  useEffect(() => {
    // React StrictMode (usado pelo TanStack Start em dev) monta > desmonta > monta
    // este efeito de novo. Sem AbortController, isso geraria DOIS tokens e DUAS
    // escritas no banco — se a escrita "fantasma" do 1º mount terminasse depois da
    // do 2º, o banco ficava com um token diferente do que estava na tela (QR/link
    // sempre "inválido"). O AbortController cancela de verdade a requisição do
    // mount descartado, então só a escrita do mount que sobrevive é concluída.
    const controller = new AbortController();
    let pollId: ReturnType<typeof setInterval> | undefined;

    function markSigned() {
      if (controller.signal.aborted) return;
      setSigned(true);
      onSigned();
      if (pollId) clearInterval(pollId);
    }

    async function checkSigned() {
      const { data } = await db.from("fichas_anamnese").select(campoAssinadoEm).eq("id", fichaId).single();
      if (data?.[campoAssinadoEm]) markSigned();
    }

    // Abas em segundo plano têm o setInterval "throttled" pelo navegador (pode
    // levar dezenas de segundos pra disparar de novo) — checar também ao voltar
    // o foco garante que o status atualiza na hora quando a profissional troca
    // de aba pra acompanhar a assinatura.
    function handleVisibility() {
      if (document.visibilityState === "visible") checkSigned();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    (async () => {
      const token = crypto.randomUUID();
      const expiraEm = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: updData, error: updErr } = await db
        .from("fichas_anamnese")
        .update({ assinatura_token: token, assinatura_token_expira_em: expiraEm, assinatura_tipo: tipo })
        .eq("id", fichaId)
        .select("id")
        .abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      // Um update bloqueado pela RLS (ficha de outro usuário) retorna 200 sem erro,
      // mas com 0 linhas afetadas — sem essa checagem o QR seria gerado para um
      // token que nunca foi salvo, e a tela pública sempre veria "link inválido".
      if (updErr || !updData || updData.length === 0) { setError(true); return; }

      const url = `${window.location.origin}/assinar/${token}`;
      setLink(url);
      setQrDataUrl(await QRCode.toDataURL(url, { width: 260, margin: 1, color: { dark: "#4A688C", light: "#FFFFFF" } }));

      checkSigned();
      pollId = setInterval(checkSigned, 2000);
    })();

    return () => {
      controller.abort();
      if (pollId) clearInterval(pollId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fichaId, tipo]);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>

        {error ? (
          <p className="py-8 text-sm text-red-500">
            Não foi possível gerar o link de assinatura. Verifique se você está logada com a conta
            que cadastrou este prontuário e tente novamente.
          </p>
        ) : signed ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <p className="font-display text-lg font-bold text-[#4A688C]">Assinatura concluída!</p>
            <p className="text-sm text-muted-foreground">O prontuário já foi atualizado com a assinatura de {quemAssina}.</p>
            <button onClick={onClose} className="mt-2 rounded-lg bg-[#4A688C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3D5674]">
              Fechar
            </button>
          </div>
        ) : (
          <>
            <p className="font-display text-lg font-bold text-[#4A688C]">
              Assinatura digital — {tipo === "medica" ? "Médica" : "Paciente"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Leia o QR code no celular ou envie o link para {quemAssina} assinar.
            </p>
            <div className="mx-auto mt-5 flex h-64 w-64 items-center justify-center rounded-xl border border-[#A0B6D0]/20 bg-white">
              {qrDataUrl
                ? <img src={qrDataUrl} alt="QR code de assinatura" className="h-60 w-60" />
                : <Loader2 className="h-8 w-8 animate-spin text-[#A0B6D0]" />}
            </div>
            {link && (
              <button
                onClick={handleCopy}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#A0B6D0] px-4 py-2 text-xs font-medium text-[#4A688C] hover:bg-[#A0B6D0]/10"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Link copiado!" : "Copiar link"}
              </button>
            )}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Aguardando assinatura de {quemAssina}...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL — FICHA DE AVALIAÇÃO GERAL (G-Tech)
// ═══════════════════════════════════════════════════════════════════════════════

function AnamneseModal({ paciente, fichaId, userId, onClose, onSaved }: {
  paciente: Paciente;
  fichaId: string | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!fichaId);

  const [form, setForm] = useState<FichaData>({
    data_avaliacao: format(new Date(), "yyyy-MM-dd"),
    // Dados Pessoais (snapshot editável da ficha)
    nome_paciente: paciente.nome,
    endereco_paciente: paciente.endereco ?? "",
    bairro_paciente: paciente.bairro ?? "",
    cidade_paciente: paciente.cidade ?? "",
    estado_paciente: paciente.estado ?? "",
    cep_paciente: paciente.cep ?? "",
    celular_paciente: fmtCelular(paciente.telefone ?? ""),
    email_paciente: paciente.email ?? "",
    profissao_paciente: paciente.profissao ?? "",
    estado_civil_paciente: paciente.estado_civil ?? "",
    data_nasc_paciente: paciente.data_nasc ?? "",
    cpf_paciente: fmtCPF(paciente.cpf ?? ""),
    idade_paciente: paciente.data_nasc ? calcIdade(paciente.data_nasc) : "",
    // Queixa Principal
    queixa: "", duracao_queixa: "",
    // Telefones adicionais
    telefone_residencial: "", telefone_comercial: "",
    // Hábitos Diários
    trat_estetico_anterior: false, trat_estetico_qual: "",
    usa_lente_contato: false,
    usa_cosmeticos: false, cosmeticos_qual: "",
    exposicao_sol: false,
    filtro_solar: false, filtro_solar_frequencia: "",
    tabagismo: false, tabagismo_quantidade: "",
    alcool: false, alcool_frequencia: "",
    funcionamento_intestinal: "",
    qualidade_sono: "", horas_sono: "",
    muito_tempo_pe_sentada: false, quanto_tempo_pe_sentada: "",
    ingestao_agua_copos: "",
    tipo_alimentacao: "", alimentos_preferencia: "",
    atividade_fisica: false, atividade_fisica_tipo: "", atividade_fisica_frequencia: "",
    anticoncepcional: false, anticoncepcional_qual: "",
    dt_ultima_menstruacao: "", gestante: false,
    gestacoes: false, gestacoes_quantas: "", gestacoes_tempo: "",
    // Histórico Clínico
    tratamento_medico_atual: false, medicamentos_uso: "",
    uso_anticoagulantes: false, anticoagulantes_quais: "",
    antecedentes_alergicos: false, alergias_quais: "",
    alergia_anestesico: false,
    marcapasso: false,
    alteracoes_cardiacas: false, alteracoes_cardiacas_quais: "",
    hipo_hipertensao: false,
    disturbio_circulatorio: false, disturbio_circulatorio_qual: "",
    disturbio_renal: false, disturbio_renal_qual: "",
    disturbio_hormonal: false, disturbio_hormonal_qual: "",
    disturbio_gastro: false, disturbio_gastro_qual: "",
    epilepsia: false, epilepsia_frequencia: "",
    alteracoes_psicologicas: false, alteracoes_psicologicas_quais: "",
    estresse: false, estresse_obs: "",
    antecedentes_oncologicos: false, antecedentes_oncologicos_qual: "",
    diabetes: false, diabetes_tipo: "",
    doenca_autoimune: false, doenca_autoimune_qual: "",
    soropositivo: false,
    outra_condicao: "", dt_ultimo_checkup: "",
    // Tratamento Estético / Cirúrgico
    proteses_metalicas: false, proteses_metalicas_qual: "",
    implante_dentario: false,
    trat_dermatologico: false, trat_dermatologico_qual: "",
    cirurgia_plastica: false, cirurgia_plastica_qual: "",
    cirurgia_reparadora: false, cirurgia_reparadora_qual: "",
    // Autorização
    autorizado: false, autoriza_imagem: false, data_assinatura: "",
  });

  useEffect(() => {
    if (!fichaId) return;
    (async () => {
      const { data } = await db.from("fichas_anamnese").select("*").eq("id", fichaId).single();
      if (data) setForm(data as FichaData);
      setLoading(false);
    })();
  }, [fichaId]);

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const txt = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value);
  const sel = (k: string) => (e: React.ChangeEvent<HTMLSelectElement>) => set(k, e.target.value);
  const chk = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.checked);
  const yn  = (k: string) => (v: boolean) => set(k, v);
  const str = (k: string) => (form[k] as string) ?? "";
  const bool = (k: string) => !!form[k];
  const tel = (k: string, cel = false) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, cel ? fmtCelular(e.target.value) : fmtTelFixo(e.target.value));

  async function handleDownloadPDF() {
    await gerarPDF(form, paciente);
  }

  async function handleSave() {
    setSaving(true);
    const obrigatorios: [string, string][] = [
      ["nome_paciente",         "Nome"],
      ["data_nasc_paciente",    "Data de Nascimento"],
      ["cpf_paciente",          "CPF"],
      ["celular_paciente",      "Celular"],
      ["endereco_paciente",     "Endereço"],
      ["cep_paciente",          "CEP"],
      ["bairro_paciente",       "Bairro"],
      ["cidade_paciente",       "Cidade"],
      ["estado_paciente",       "Estado"],
      ["profissao_paciente",    "Profissão"],
      ["estado_civil_paciente", "Estado Civil"],
      ["email_paciente",        "E-mail"],
    ];
    for (const [key, label] of obrigatorios) {
      if (!str(key)) { toast.error(`${label} é obrigatório`); setSaving(false); return; }
    }
    const payload = { ...form, paciente_id: paciente.id, user_id: userId };
    const sanitized = Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [
        k,
        typeof v === "string" && v === "" &&
        (k.startsWith("dt_") || k.includes("data") || k.includes("nasc") || k.includes("checkup"))
          ? null
          : v,
      ])
    );
    const op = fichaId
      ? db.from("fichas_anamnese").update(sanitized).eq("id", fichaId)
      : db.from("fichas_anamnese").insert(sanitized);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Ficha salva com sucesso!");
    onSaved();
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Loader2 className="h-10 w-10 animate-spin text-white" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="rounded-t-2xl border-b border-[#A0B6D0]/20 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#4A688C]">Ficha de Avaliação Geral</h2>
              <p className="text-xs text-muted-foreground">G-Tech · {paciente.nome}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6">

          {/* Data */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-48">
              <FL>Data da Avaliação</FL>
              <FInput value={str("data_avaliacao")} onChange={txt("data_avaliacao")} type="date" />
            </div>
          </div>

          {/* ── DADOS PESSOAIS ── */}
          <Secao>Dados Pessoais</Secao>

          {/* Nome + Idade */}
          <Row3>
            <div className="sm:col-span-2">
              <FL>Nome *</FL>
              <FInput value={str("nome_paciente")} onChange={txt("nome_paciente")} />
            </div>
            <div>
              <FL>Idade</FL>
              <FInput value={str("idade_paciente")} onChange={txt("idade_paciente")} placeholder="Ex: 30 anos" />
            </div>
          </Row3>

          {/* Endereço */}
          <div className="mt-3">
            <FL>Endereço *</FL>
            <FInput value={str("endereco_paciente")} onChange={txt("endereco_paciente")} />
          </div>

          {/* CEP + Bairro + Cidade + Estado */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><FL>CEP *</FL><FInput value={str("cep_paciente")} onChange={txt("cep_paciente")} /></div>
            <div><FL>Bairro *</FL><FInput value={str("bairro_paciente")} onChange={txt("bairro_paciente")} /></div>
            <div><FL>Cidade *</FL><FInput value={str("cidade_paciente")} onChange={txt("cidade_paciente")} /></div>
            <div><FL>Estado *</FL><FInput value={str("estado_paciente")} onChange={txt("estado_paciente")} /></div>
          </div>

          {/* Telefones */}
          <Row3>
            <div className="mt-3">
              <FL>Tel. Residencial</FL>
              <FInput
                value={str("telefone_residencial")}
                onChange={tel("telefone_residencial")}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div className="mt-3">
              <FL>Tel. Comercial</FL>
              <FInput
                value={str("telefone_comercial")}
                onChange={tel("telefone_comercial")}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div className="mt-3">
              <FL>Celular *</FL>
              <FInput
                value={str("celular_paciente")}
                onChange={tel("celular_paciente", true)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </Row3>

          {/* Data de nasc. + CPF + Profissão + Estado Civil */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <FL>Data de Nasc. *</FL>
              <FInput value={str("data_nasc_paciente")} onChange={txt("data_nasc_paciente")} type="date" />
            </div>
            <div>
              <FL>CPF *</FL>
              <FInput
                value={str("cpf_paciente")}
                onChange={(e) => set("cpf_paciente", fmtCPF(e.target.value))}
              />
            </div>
            <div><FL>Profissão *</FL><FInput value={str("profissao_paciente")} onChange={txt("profissao_paciente")} /></div>
            <div><FL>Estado Civil *</FL><FInput value={str("estado_civil_paciente")} onChange={txt("estado_civil_paciente")} /></div>
          </div>

          {/* E-mail */}
          <div className="mt-3">
            <FL>E-mail *</FL>
            <FInput value={str("email_paciente")} onChange={txt("email_paciente")} type="email" />
          </div>

          {/* ── QUEIXA PRINCIPAL ── */}
          <Secao>Queixa Principal</Secao>
          <Row2>
            <div><FL>Queixa</FL><FInput value={str("queixa")} onChange={txt("queixa")} /></div>
            <div><FL>Duração</FL><FInput value={str("duracao_queixa")} onChange={txt("duracao_queixa")} /></div>
          </Row2>

          {/* ── HÁBITOS DIÁRIOS ── */}
          <Secao>Hábitos Diários</Secao>

          <YN name="trat_estetico_anterior" value={bool("trat_estetico_anterior")} label="Tratamento estético anterior?" onChange={yn("trat_estetico_anterior")} />
          {bool("trat_estetico_anterior") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("trat_estetico_qual")} onChange={txt("trat_estetico_qual")} /></div>
          )}

          <YN name="usa_lente_contato" value={bool("usa_lente_contato")} label="Usa lentes de contato?" onChange={yn("usa_lente_contato")} />

          <YN name="usa_cosmeticos" value={bool("usa_cosmeticos")} label="Utilização de cosméticos?" onChange={yn("usa_cosmeticos")} />
          {bool("usa_cosmeticos") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("cosmeticos_qual")} onChange={txt("cosmeticos_qual")} /></div>
          )}

          <YN name="exposicao_sol" value={bool("exposicao_sol")} label="Exposição ao sol?" onChange={yn("exposicao_sol")} />

          <YN name="filtro_solar" value={bool("filtro_solar")} label="Filtro Solar?" onChange={yn("filtro_solar")} />
          {bool("filtro_solar") && (
            <div className="ml-4 mt-1 mb-2"><FL>Frequência</FL><FInput value={str("filtro_solar_frequencia")} onChange={txt("filtro_solar_frequencia")} /></div>
          )}

          <YN name="tabagismo" value={bool("tabagismo")} label="Tabagismo?" onChange={yn("tabagismo")} />
          {bool("tabagismo") && (
            <div className="ml-4 mt-1 mb-2"><FL>Quantidade de cigarros / dia</FL><FInput value={str("tabagismo_quantidade")} onChange={txt("tabagismo_quantidade")} /></div>
          )}

          <YN name="alcool" value={bool("alcool")} label="Ingere bebida alcoólica?" onChange={yn("alcool")} />
          {bool("alcool") && (
            <div className="ml-4 mt-1 mb-2"><FL>Frequência</FL><FInput value={str("alcool_frequencia")} onChange={txt("alcool_frequencia")} /></div>
          )}

          <div className="mt-3">
            <FL>Funcionamento intestinal</FL>
            <select value={str("funcionamento_intestinal")} onChange={sel("funcionamento_intestinal")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none">
              <option value="">Selecione</option>
              <option>1-2 vezes / semana</option>
              <option>3-4 vezes / semana</option>
              <option>1-2 vezes / dia</option>
              <option>Mais de 3 vezes / dia</option>
            </select>
          </div>

          <Row2>
            <div className="mt-3">
              <FL>Qualidade do sono</FL>
              <select value={str("qualidade_sono")} onChange={sel("qualidade_sono")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none">
                <option value="">Selecione</option>
                <option>Boa</option><option>Regular</option><option>Péssima</option>
              </select>
            </div>
            <div className="mt-3"><FL>Quantas horas / noite</FL><FInput value={str("horas_sono")} onChange={txt("horas_sono")} /></div>
          </Row2>

          <div className="mt-2">
            <YN name="muito_tempo_pe_sentada" value={bool("muito_tempo_pe_sentada")} label="Passa muito tempo em pé e/ou sentada?" onChange={yn("muito_tempo_pe_sentada")} />
            {bool("muito_tempo_pe_sentada") && (
              <div className="ml-4 mt-1 mb-2"><FL>Quanto tempo?</FL><FInput value={str("quanto_tempo_pe_sentada")} onChange={txt("quanto_tempo_pe_sentada")} /></div>
            )}
          </div>

          <div className="mt-3"><FL>Ingestão de água (copos / dia)</FL><FInput value={str("ingestao_agua_copos")} onChange={txt("ingestao_agua_copos")} /></div>

          <div className="mt-3">
            <FL>Tipo de alimentação</FL>
            <select value={str("tipo_alimentacao")} onChange={sel("tipo_alimentacao")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none">
              <option value="">Selecione</option>
              <option>Vegano</option><option>Vegetariano</option><option>Convencional</option>
              <option>Low Carb</option><option>Outro</option>
            </select>
          </div>
          <div className="mt-3"><FL>Alimentos de preferência</FL><FInput value={str("alimentos_preferencia")} onChange={txt("alimentos_preferencia")} /></div>

          <div className="mt-2">
            <YN name="atividade_fisica" value={bool("atividade_fisica")} label="Pratica atividade física?" onChange={yn("atividade_fisica")} />
            {bool("atividade_fisica") && (
              <Row2>
                <div className="ml-4 mt-1"><FL>Que tipo</FL><FInput value={str("atividade_fisica_tipo")} onChange={txt("atividade_fisica_tipo")} /></div>
                <div className="ml-4 mt-1"><FL>Qual frequência</FL><FInput value={str("atividade_fisica_frequencia")} onChange={txt("atividade_fisica_frequencia")} /></div>
              </Row2>
            )}
          </div>

          <div className="mt-2">
            <YN name="anticoncepcional" value={bool("anticoncepcional")} label="Uso de anticoncepcional?" onChange={yn("anticoncepcional")} />
            {bool("anticoncepcional") && (
              <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("anticoncepcional_qual")} onChange={txt("anticoncepcional_qual")} /></div>
            )}
          </div>

          <Row2>
            <div className="mt-3"><FL>Data do 1º dia da última menstruação</FL><FInput value={str("dt_ultima_menstruacao")} onChange={txt("dt_ultima_menstruacao")} type="date" /></div>
            <div className="mt-3 flex items-end pb-0.5">
              <div className="w-full">
                <YN name="gestante" value={bool("gestante")} label="Gestante?" onChange={yn("gestante")} />
              </div>
            </div>
          </Row2>

          <div className="mt-2">
            <YN name="gestacoes" value={bool("gestacoes")} label="Gestações anteriores?" onChange={yn("gestacoes")} />
            {bool("gestacoes") && (
              <Row2>
                <div className="ml-4 mt-1"><FL>Quantas?</FL><FInput value={str("gestacoes_quantas")} onChange={txt("gestacoes_quantas")} /></div>
                <div className="ml-4 mt-1"><FL>Há quanto tempo?</FL><FInput value={str("gestacoes_tempo")} onChange={txt("gestacoes_tempo")} /></div>
              </Row2>
            )}
          </div>

          {/* ── HISTÓRICO CLÍNICO ── */}
          <Secao>Histórico Clínico</Secao>

          <YN name="tratamento_medico_atual" value={bool("tratamento_medico_atual")} label="Tratamento médico atual?" onChange={yn("tratamento_medico_atual")} />
          {bool("tratamento_medico_atual") && (
            <div className="ml-4 mt-1 mb-2"><FL>Medicamentos em uso</FL><FTextarea value={str("medicamentos_uso")} onChange={txt("medicamentos_uso")} /></div>
          )}

          <YN name="uso_anticoagulantes" value={bool("uso_anticoagulantes")} label="Uso de anticoagulantes?" onChange={yn("uso_anticoagulantes")} />
          {bool("uso_anticoagulantes") && (
            <div className="ml-4 mt-1 mb-2"><FL>Quais?</FL><FInput value={str("anticoagulantes_quais")} onChange={txt("anticoagulantes_quais")} /></div>
          )}

          <YN name="antecedentes_alergicos" value={bool("antecedentes_alergicos")} label="Antecedentes alérgicos?" onChange={yn("antecedentes_alergicos")} />
          {bool("antecedentes_alergicos") && (
            <div className="ml-4 mt-1 mb-2"><FL>Quais?</FL><FInput value={str("alergias_quais")} onChange={txt("alergias_quais")} /></div>
          )}

          <YN name="alergia_anestesico" value={bool("alergia_anestesico")} label="Reação alérgica a anestésicos? (ex.: lidocaína)" onChange={yn("alergia_anestesico")} />
          <YN name="marcapasso" value={bool("marcapasso")} label="Portador de marcapasso?" onChange={yn("marcapasso")} />

          <YN name="alteracoes_cardiacas" value={bool("alteracoes_cardiacas")} label="Alterações cardíacas?" onChange={yn("alteracoes_cardiacas")} />
          {bool("alteracoes_cardiacas") && (
            <div className="ml-4 mt-1 mb-2"><FL>Quais?</FL><FInput value={str("alteracoes_cardiacas_quais")} onChange={txt("alteracoes_cardiacas_quais")} /></div>
          )}

          <YN name="hipo_hipertensao" value={bool("hipo_hipertensao")} label="Hipo/hipertensão arterial?" onChange={yn("hipo_hipertensao")} />

          {([
            { k: "disturbio_circulatorio", label: "Distúrbio circulatório?",      qk: "disturbio_circulatorio_qual" },
            { k: "disturbio_renal",        label: "Distúrbio renal?",             qk: "disturbio_renal_qual" },
            { k: "disturbio_hormonal",     label: "Distúrbio hormonal?",          qk: "disturbio_hormonal_qual" },
            { k: "disturbio_gastro",       label: "Distúrbio gastro-intestinal?", qk: "disturbio_gastro_qual" },
          ]).map(({ k, label, qk }) => (
            <div key={k}>
              <YN name={k} value={bool(k)} label={label} onChange={yn(k)} />
              {bool(k) && <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str(qk)} onChange={txt(qk)} /></div>}
            </div>
          ))}

          <YN name="epilepsia" value={bool("epilepsia")} label="Epilepsia / convulsões?" onChange={yn("epilepsia")} />
          {bool("epilepsia") && (
            <div className="ml-4 mt-1 mb-2"><FL>Frequência</FL><FInput value={str("epilepsia_frequencia")} onChange={txt("epilepsia_frequencia")} /></div>
          )}

          <YN name="alteracoes_psicologicas" value={bool("alteracoes_psicologicas")} label="Alterações psicológicas / psiquiátricas?" onChange={yn("alteracoes_psicologicas")} />
          {bool("alteracoes_psicologicas") && (
            <div className="ml-4 mt-1 mb-2"><FL>Quais?</FL><FInput value={str("alteracoes_psicologicas_quais")} onChange={txt("alteracoes_psicologicas_quais")} /></div>
          )}

          <YN name="estresse" value={bool("estresse")} label="Estresse?" onChange={yn("estresse")} />
          {bool("estresse") && (
            <div className="ml-4 mt-1 mb-2"><FL>Observações</FL><FInput value={str("estresse_obs")} onChange={txt("estresse_obs")} /></div>
          )}

          <YN name="antecedentes_oncologicos" value={bool("antecedentes_oncologicos")} label="Antecedentes oncológicos?" onChange={yn("antecedentes_oncologicos")} />
          {bool("antecedentes_oncologicos") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("antecedentes_oncologicos_qual")} onChange={txt("antecedentes_oncologicos_qual")} /></div>
          )}

          <YN name="diabetes" value={bool("diabetes")} label="Diabetes?" onChange={yn("diabetes")} />
          {bool("diabetes") && (
            <div className="ml-4 mt-1 mb-2"><FL>Tipo</FL><FInput value={str("diabetes_tipo")} onChange={txt("diabetes_tipo")} /></div>
          )}

          <YN name="doenca_autoimune" value={bool("doenca_autoimune")} label="Doença autoimune?" onChange={yn("doenca_autoimune")} />
          {bool("doenca_autoimune") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("doenca_autoimune_qual")} onChange={txt("doenca_autoimune_qual")} /></div>
          )}

          <YN name="soropositivo" value={bool("soropositivo")} label="Soropositivo?" onChange={yn("soropositivo")} />

          <div className="mt-3"><FL>Outra condição não abordada / doença pré-existente</FL><FTextarea value={str("outra_condicao")} onChange={txt("outra_condicao")} /></div>
          <div className="mt-3 w-56"><FL>Data do último Check-Up</FL><FInput value={str("dt_ultimo_checkup")} onChange={txt("dt_ultimo_checkup")} type="date" /></div>

          {/* ── TRATAMENTO ESTÉTICO / CIRÚRGICO ── */}
          <Secao>Tratamento da Medicina Estética e Cirúrgica</Secao>

          <YN name="proteses_metalicas" value={bool("proteses_metalicas")} label="Próteses metálicas?" onChange={yn("proteses_metalicas")} />
          {bool("proteses_metalicas") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("proteses_metalicas_qual")} onChange={txt("proteses_metalicas_qual")} /></div>
          )}

          <YN name="implante_dentario" value={bool("implante_dentario")} label="Implante dentário?" onChange={yn("implante_dentario")} />

          <YN name="trat_dermatologico" value={bool("trat_dermatologico")} label="Tratamento dermatológico / estético?" onChange={yn("trat_dermatologico")} />
          {bool("trat_dermatologico") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("trat_dermatologico_qual")} onChange={txt("trat_dermatologico_qual")} /></div>
          )}

          <YN name="cirurgia_plastica" value={bool("cirurgia_plastica")} label="Cirurgia plástica estética?" onChange={yn("cirurgia_plastica")} />
          {bool("cirurgia_plastica") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("cirurgia_plastica_qual")} onChange={txt("cirurgia_plastica_qual")} /></div>
          )}

          <YN name="cirurgia_reparadora" value={bool("cirurgia_reparadora")} label="Cirurgia reparadora?" onChange={yn("cirurgia_reparadora")} />
          {bool("cirurgia_reparadora") && (
            <div className="ml-4 mt-1 mb-2"><FL>Qual?</FL><FInput value={str("cirurgia_reparadora_qual")} onChange={txt("cirurgia_reparadora_qual")} /></div>
          )}

          {/* ── AUTORIZAÇÃO ── */}
          <Secao>Autorização</Secao>
          <p className="mb-4 text-xs text-gray-500 leading-relaxed rounded-lg bg-gray-50 border border-gray-100 p-3">
            Me responsabilizo pelo questionário e autorizo a realização dos procedimentos descritos anteriormente,
            afirmando serem verídicas todas as informações fornecidas. Fico ciente de que as sessões não desmarcadas
            serão dadas como realizadas. Além disso, autorizo a utilização de uso de imagem.
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={bool("autorizado")} onChange={chk("autorizado")} className="mt-0.5 accent-[#4A688C] h-4 w-4" />
            <span className="text-sm text-gray-700">A paciente confirma e autoriza os procedimentos</span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={bool("autoriza_imagem")} onChange={chk("autoriza_imagem")} className="mt-0.5 accent-[#4A688C] h-4 w-4" />
            <span className="text-sm text-gray-700">Autoriza uso de imagem</span>
          </label>
          <Row2>
            <div className="mt-3"><FL>Data da assinatura</FL><FInput value={str("data_assinatura")} onChange={txt("data_assinatura")} type="date" /></div>
            <div className="mt-3">
              <FL>Assinatura do cliente</FL>
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                G-Tech
              </div>
            </div>
          </Row2>

        </div>{/* end body */}

        {/* Footer */}
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-[#A0B6D0]/20 bg-white px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
          {fichaId && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 rounded-lg border border-[#A0B6D0] px-5 py-2 text-sm font-semibold text-[#4A688C] hover:bg-[#A0B6D0]/10 transition-colors"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#4A688C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3D5674] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Ficha
          </button>
        </div>

      </div>
    </div>
  );
}
