import { supabase } from "@/integrations/supabase/client";
import type { FormaPagamento } from "@/lib/financeiro.types";

export async function criarLancamento(input: {
  tipo: "DESPESA" | "RECEITA";
  descricao: string;
  beneficiario?: string | null;
  valor: number;
  dt_vencimento: string;
  numero_documento?: string | null;
  plano_contas_id: string;
  recorrencia?: "NAO" | "DIARIAMENTE" | "SEMANALMENTE" | "MENSALMENTE";
  numero_parcelas?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  const { numero_parcelas = 1, recorrencia = "NAO", ...base } = input;

  if (numero_parcelas > 1) {
    const grupoParcela = crypto.randomUUID();
    const inserts = [];
    for (let i = 1; i <= numero_parcelas; i++) {
      const dt = new Date(base.dt_vencimento);
      dt.setMonth(dt.getMonth() + (i - 1));
      inserts.push({
        ...base,
        dt_vencimento: dt.toISOString(),
        recorrencia: "NAO" as const,
        numero_parcelas,
        parcela_atual: i,
        grupo_parcela_id: grupoParcela,
        created_by: user?.id,
      });
    }
    const { error } = await supabase.from("lancamento_financeiro").insert(inserts);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("lancamento_financeiro").insert({
      ...base,
      recorrencia,
      created_by: user?.id,
    });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function editarLancamento(input: {
  id: string;
  descricao: string;
  beneficiario?: string | null;
  valor: number;
  dt_vencimento: string;
  numero_documento?: string | null;
  plano_contas_id: string;
  aplicar_a_todos?: boolean;
}) {
  const { id, aplicar_a_todos = false, ...fields } = input;

  const { data: lancamento, error: fetchError } = await supabase
    .from("lancamento_financeiro")
    .select("grupo_parcela_id")
    .eq("id", id)
    .single();
  if (fetchError || !lancamento) throw new Error("Lançamento não encontrado.");

  const { error } = await supabase
    .from("lancamento_financeiro")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (aplicar_a_todos && lancamento.grupo_parcela_id) {
    const { error: groupError } = await supabase
      .from("lancamento_financeiro")
      .update({
        descricao: fields.descricao,
        beneficiario: fields.beneficiario,
        valor: fields.valor,
        numero_documento: fields.numero_documento,
        plano_contas_id: fields.plano_contas_id,
        updated_at: new Date().toISOString(),
      })
      .eq("grupo_parcela_id", lancamento.grupo_parcela_id)
      .neq("id", id);
    if (groupError) throw new Error(groupError.message);
  }
  return { ok: true };
}

export async function pagarLancamento(input: { id: string; dt_pagamento: string; forma_pagamento?: FormaPagamento }) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: lancamento, error: fetchError } = await supabase
    .from("lancamento_financeiro")
    .select("*")
    .eq("id", input.id)
    .single();
  if (fetchError || !lancamento) throw new Error("Lançamento não encontrado.");

  const { error } = await supabase
    .from("lancamento_financeiro")
    .update({ status: "PAGO", dt_pagamento: input.dt_pagamento, forma_pagamento: input.forma_pagamento ?? "DINHEIRO", updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  if (lancamento.recorrencia !== "NAO") {
    const base = new Date(lancamento.dt_vencimento);
    let proxData = new Date(base);
    if (lancamento.recorrencia === "DIARIAMENTE") proxData.setDate(proxData.getDate() + 1);
    else if (lancamento.recorrencia === "SEMANALMENTE") proxData.setDate(proxData.getDate() + 7);
    else proxData.setMonth(proxData.getMonth() + 1);

    const { error: createError } = await supabase.from("lancamento_financeiro").insert({
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      beneficiario: lancamento.beneficiario,
      valor: lancamento.valor,
      dt_vencimento: proxData.toISOString(),
      numero_documento: lancamento.numero_documento,
      plano_contas_id: lancamento.plano_contas_id,
      recorrencia: lancamento.recorrencia,
      status: "PENDENTE",
      lancamento_pai_id: input.id,
      created_by: user?.id,
    });
    if (createError) throw new Error(createError.message);
  }
  return { ok: true };
}

export async function cancelarLancamento(input: { id: string }) {
  const { error } = await supabase
    .from("lancamento_financeiro")
    .update({ status: "CANCELADO", updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function excluirLancamento(input: { id: string }) {
  await supabase.from("anexo_financeiro").delete().eq("lancamento_id", input.id);
  const { error } = await supabase.from("lancamento_financeiro").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function excluirGrupoParcelas(input: { grupo_parcela_id: string }) {
  const { data: ids, error: fetchError } = await supabase
    .from("lancamento_financeiro")
    .select("id")
    .eq("grupo_parcela_id", input.grupo_parcela_id);
  if (fetchError) throw new Error(fetchError.message);

  const idsArr = (ids ?? []).map((l) => l.id);
  if (idsArr.length > 0) {
    await supabase.from("anexo_financeiro").delete().in("lancamento_id", idsArr);
    const { error } = await supabase.from("lancamento_financeiro").delete().in("id", idsArr);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function excluirEAvancarRecorrencia(input: { id: string }) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: lancamento, error: fetchError } = await supabase
    .from("lancamento_financeiro")
    .select("*")
    .eq("id", input.id)
    .single();
  if (fetchError || !lancamento) throw new Error("Lançamento não encontrado.");

  const base = new Date(lancamento.dt_vencimento);
  let proxData = new Date(base);
  if (lancamento.recorrencia === "DIARIAMENTE") proxData.setDate(proxData.getDate() + 1);
  else if (lancamento.recorrencia === "SEMANALMENTE") proxData.setDate(proxData.getDate() + 7);
  else proxData.setMonth(proxData.getMonth() + 1);

  await supabase.from("anexo_financeiro").delete().eq("lancamento_id", input.id);
  await supabase.from("lancamento_financeiro").delete().eq("id", input.id);

  const { error } = await supabase.from("lancamento_financeiro").insert({
    tipo: lancamento.tipo,
    descricao: lancamento.descricao,
    beneficiario: lancamento.beneficiario,
    valor: lancamento.valor,
    dt_vencimento: proxData.toISOString(),
    numero_documento: lancamento.numero_documento,
    plano_contas_id: lancamento.plano_contas_id,
    recorrencia: lancamento.recorrencia,
    status: "PENDENTE",
    lancamento_pai_id: input.id,
    created_by: user?.id,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
