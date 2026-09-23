import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import BalanceteView from "@/components/financeiro/balancete-view";
import type { Balancete } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_app/balance")({
  component: BalancetePage,
});

function BalancetePage() {
  const { user } = useAuth();
  const [balancete, setBalancete] = useState<Balancete | null>(null);
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;

  async function carregarBalancete(dataInicio: string, dataFim: string) {
    setCarregando(true);

    const [{ data: noPeriodo }, { data: todosPagos }] = await Promise.all([
      supabase
        .from("lancamento_financeiro")
        .select("*, plano_contas(id, nome)")
        .neq("status", "CANCELADO")
        .gte("dt_vencimento", `${dataInicio}T00:00:00.000Z`)
        .lte("dt_vencimento", `${dataFim}T23:59:59.999Z`),
      supabase
        .from("lancamento_financeiro")
        .select("tipo, valor")
        .eq("status", "PAGO"),
    ]);

    const lancamentos = noPeriodo ?? [];
    const pagos = todosPagos ?? [];

    // Apenas lançamentos PAGOS no período
    const receitas_pagas = lancamentos.filter((l) => l.tipo === "RECEITA" && l.status === "PAGO").reduce((s, l) => s + Number(l.valor), 0);
    const despesas_pagas = lancamentos.filter((l) => l.tipo === "DESPESA" && l.status === "PAGO").reduce((s, l) => s + Number(l.valor), 0);
    const resultado_periodo = receitas_pagas - despesas_pagas;

    // Caixa = saldo acumulado de todos os pagamentos (todos os tempos)
    const caixaReceitas = pagos.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + Number(l.valor), 0);
    const caixaDespesas = pagos.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + Number(l.valor), 0);
    const caixa = caixaReceitas - caixaDespesas;

    // Pendentes no período
    const a_receber = lancamentos.filter((l) => l.tipo === "RECEITA" && l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);
    const a_pagar = lancamentos.filter((l) => l.tipo === "DESPESA" && l.status === "PENDENTE").reduce((s, l) => s + Number(l.valor), 0);

    const receitasPorConta = new Map<string, { nome: string; total: number }>();
    const despesasPorConta = new Map<string, { nome: string; total: number }>();
    const lancamentosPorConta: Record<string, { descricao: string; beneficiario: string | null; valor: number; status: string; dt_vencimento: string }[]> = {};

    for (const l of lancamentos) {
      const pc = l.plano_contas as { id: string; nome: string } | null;
      if (!pc) continue;

      // Detalhe: todos os lançamentos do período (PAGO e PENDENTE)
      if (!lancamentosPorConta[l.plano_contas_id]) lancamentosPorConta[l.plano_contas_id] = [];
      lancamentosPorConta[l.plano_contas_id].push({
        descricao: l.descricao,
        beneficiario: l.beneficiario ?? null,
        valor: Number(l.valor),
        status: l.status,
        dt_vencimento: l.dt_vencimento,
      });

      // Totais por conta: apenas PAGOS
      if (l.status !== "PAGO") continue;
      const mapa = l.tipo === "RECEITA" ? receitasPorConta : despesasPorConta;
      const atual = mapa.get(l.plano_contas_id) ?? { nome: pc.nome, total: 0 };
      mapa.set(l.plano_contas_id, { nome: pc.nome, total: atual.total + Number(l.valor) });
    }

    const mesesPtBR: Record<string, string> = {
      "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
      "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
      "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    };
    const mesesMap = new Map<string, { receitas: number; despesas: number }>();
    for (const l of lancamentos) {
      // Gráfico: apenas lançamentos PAGOS
      if (l.status !== "PAGO") continue;
      const dt = new Date(l.dt_vencimento);
      const chave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      const atual = mesesMap.get(chave) ?? { receitas: 0, despesas: 0 };
      if (l.tipo === "RECEITA") atual.receitas += Number(l.valor);
      else atual.despesas += Number(l.valor);
      mesesMap.set(chave, atual);
    }
    const dados_mensais = Array.from(mesesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, v]) => {
        const [ano, mes] = chave.split("-");
        return { mes: `${mesesPtBR[mes]}/${ano.slice(2)}`, receitas: v.receitas, despesas: v.despesas, resultado: v.receitas - v.despesas };
      });

    const hojeD = new Date();
    hojeD.setHours(0, 0, 0, 0);

    const { data: parcelasReceita } = await supabase
      .from("lancamento_financeiro")
      .select("id, descricao, valor, dt_vencimento, numero_parcelas, parcela_atual, grupo_parcela_id, status")
      .eq("tipo", "RECEITA")
      .not("grupo_parcela_id", "is", null)
      .in("status", ["PENDENTE", "PAGO"]);

    const gruposMap = new Map<string, typeof parcelasReceita>();
    for (const p of parcelasReceita ?? []) {
      if (!p.grupo_parcela_id) continue;
      const arr = gruposMap.get(p.grupo_parcela_id) ?? [];
      arr.push(p);
      gruposMap.set(p.grupo_parcela_id, arr);
    }

    const contratos_encerrando = [];
    for (const [, parcelas] of gruposMap) {
      if (!parcelas || parcelas.length === 0) continue;
      const pendentes = parcelas.filter((p) => p.status === "PENDENTE");
      if (pendentes.length === 0) continue;
      const ultima = pendentes.sort((a, b) => new Date(b.dt_vencimento).getTime() - new Date(a.dt_vencimento).getTime())[0];
      const dtUltima = new Date(ultima.dt_vencimento);
      const diasRestantes = Math.ceil((dtUltima.getTime() - hojeD.getTime()) / (1000 * 60 * 60 * 24));
      if (diasRestantes >= 0 && diasRestantes <= 90) {
        contratos_encerrando.push({
          id: ultima.id,
          descricao: ultima.descricao,
          valor: Number(ultima.valor),
          dt_ultima_parcela: ultima.dt_vencimento,
          dias_restantes: diasRestantes,
          parcelas_restantes: pendentes.length,
          total_parcelas: ultima.numero_parcelas ?? parcelas.length,
        });
      }
    }

    setBalancete({
      receitas_pagas, despesas_pagas, resultado_periodo, caixa, a_receber, a_pagar,
      receitas_por_conta: Array.from(receitasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, ...v })),
      despesas_por_conta: Array.from(despesasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, ...v })),
      lancamentos_por_conta: lancamentosPorConta,
      dados_mensais,
      contratos_encerrando,
    });
    setCarregando(false);
  }

  useEffect(() => {
    if (!user) return;
    carregarBalancete(inicio, fim);
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Balancete</h1>
        <p className="text-sm text-muted-foreground">
          Resumo financeiro do período selecionado.
        </p>
      </div>
      {carregando ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <BalanceteView
          balancete={balancete}
          dataInicio={inicio}
          dataFim={fim}
          onNavegar={carregarBalancete}
        />
      )}
    </div>
  );
}