import { supabase } from "@/integrations/supabase/client";

export async function listPlanoContas() {
  const { data, error } = await supabase
    .from("plano_contas")
    .select("*")
    .order("tipo")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listPlanoContasByTipo(tipo: "DESPESA" | "RECEITA") {
  const { data, error } = await supabase
    .from("plano_contas")
    .select("*")
    .eq("tipo", tipo)
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function criarPlanoContas(tipo: "DESPESA" | "RECEITA", nome: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("plano_contas")
    .insert({ tipo, nome: nome.trim(), created_by: user?.id });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function editarPlanoContas(id: string, tipo: "DESPESA" | "RECEITA", nome: string) {
  const { error } = await supabase
    .from("plano_contas")
    .update({ tipo, nome: nome.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function toggleAtivoPlanoContas(id: string) {
  const { data: conta, error: fetchError } = await supabase
    .from("plano_contas")
    .select("ativo")
    .eq("id", id)
    .single();
  if (fetchError || !conta) throw new Error("Conta não encontrada.");
  const { error } = await supabase
    .from("plano_contas")
    .update({ ativo: !conta.ativo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function excluirPlanoContas(id: string) {
  const { count, error: countError } = await supabase
    .from("lancamento_financeiro")
    .select("*", { count: "exact", head: true })
    .eq("plano_contas_id", id);
  if (countError) throw new Error(countError.message);
  if (count && count > 0)
    throw new Error("Esta conta possui lançamentos e não pode ser excluída.");
  const { error } = await supabase
    .from("plano_contas")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}