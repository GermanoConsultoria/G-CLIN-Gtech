import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import LancamentosView from "@/components/financeiro/lancamentos-view";
import type { LancamentoComRelacoes, PlanoContas } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_app/payables")({
  component: ContasAPagarPage,
});

function ContasAPagarPage() {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<LancamentoComRelacoes[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!user) return;
    const hoje = new Date();
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;

    Promise.all([
      supabase
        .from("lancamento_financeiro")
        .select("*, plano_contas(*), anexos:anexo_financeiro(*)")
        .eq("tipo", "DESPESA")
        .gte("dt_vencimento", `${inicio}T00:00:00.000Z`)
        .lte("dt_vencimento", `${fim}T23:59:59.999Z`)
        .order("dt_vencimento", { ascending: true }),
      supabase
        .from("plano_contas")
        .select("*")
        .eq("tipo", "DESPESA")
        .eq("ativo", true)
        .order("nome"),
    ]).then(([{ data: l }, { data: p }]) => {
      setLancamentos((l ?? []) as LancamentoComRelacoes[]);
      setPlanoContas(p ?? []);
      setCarregando(false);
    });
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Contas a Pagar</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas despesas e obrigações financeiras.
        </p>
      </div>
      {carregando ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <LancamentosView
          lancamentos={lancamentos}
          planoContas={planoContas}
          tipo="DESPESA"
        />
      )}
    </div>
  );
}