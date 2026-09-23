import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { pagarLancamento } from "@/lib/financeiro.functions";
import { formatBRL } from "@/lib/format";
import type { FormaPagamento } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_app/pending-payments")({
  component: PendingPaymentsPage,
});

type LancamentoPendente = {
  id: string;
  beneficiario: string | null;
  descricao: string;
  valor: number;
  dt_vencimento: string;
};

function diasEmAberto(dtVencimento: string): number {
  const venc = new Date(dtVencimento);
  venc.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

function PendingPaymentsPage() {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<LancamentoPendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalPagar, setModalPagar] = useState<string | null>(null);
  const [dtPagamento, setDtPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("DINHEIRO");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("lancamento_financeiro")
      .select("id, beneficiario, descricao, valor, dt_vencimento")
      .eq("tipo", "RECEITA")
      .eq("status", "PENDENTE")
      .order("dt_vencimento", { ascending: true });
    if (error) toast.error(error.message);
    setLancamentos((data ?? []) as LancamentoPendente[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (user) carregar();
  }, [user, carregar]);

  const totalPendente = useMemo(
    () => lancamentos.reduce((s, l) => s + Number(l.valor), 0),
    [lancamentos],
  );

  const clientesUnicos = useMemo(
    () => new Set(lancamentos.map((l) => l.beneficiario ?? l.descricao)).size,
    [lancamentos],
  );

  const handleRegistrar = async () => {
    if (!modalPagar) return;
    setSalvando(true);
    try {
      await pagarLancamento({ id: modalPagar, dt_pagamento: dtPagamento, forma_pagamento: formaPagamento });
      toast.success("Recebimento registrado com sucesso!");
      setModalPagar(null);
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pagamentos Pendentes</h1>
        <p className="text-sm text-muted-foreground">Clientes com pagamentos em aberto.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-orange-100">
            <AlertCircle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pendente</p>
            <p className="text-2xl font-bold text-orange-600">{formatBRL(totalPendente)}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-yellow-100">
            <Users className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Clientes com Pendência</p>
            <p className="text-2xl font-bold text-yellow-600">{clientesUnicos}</p>
          </div>
        </Card>
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : lancamentos.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">Nenhum pagamento pendente</h3>
          <p className="mt-1 text-sm text-muted-foreground">Todos os lançamentos de receita estão em dia.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Procedimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Vencimento</th>
                  <th className="px-4 py-3 text-center">Dias em aberto</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lancamentos.map((l) => {
                  const dias = diasEmAberto(l.dt_vencimento);
                  const dtFmt = new Date(l.dt_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" });
                  const corDias = dias > 30 ? "text-red-600 font-semibold" : dias > 7 ? "text-orange-600 font-medium" : "text-yellow-600";
                  return (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{l.beneficiario ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.descricao}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-600">{formatBRL(Number(l.valor))}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{dtFmt}</td>
                      <td className={`px-4 py-3 text-center ${corDias}`}>
                        {dias <= 0 ? "Hoje" : `${dias} dia${dias !== 1 ? "s" : ""}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                          onClick={() => {
                            setModalPagar(l.id);
                            setDtPagamento(new Date().toISOString().split("T")[0]);
                            setFormaPagamento("DINHEIRO");
                          }}
                        >
                          Registrar Recebimento
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modalPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h2 className="text-lg font-bold">Registrar Recebimento</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data do Recebimento</label>
                <Input
                  type="date"
                  value={dtPagamento}
                  onChange={(e) => setDtPagamento(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Forma de Pagamento</label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="CONVENIO">Convênio</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setModalPagar(null)}>Cancelar</Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleRegistrar}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
