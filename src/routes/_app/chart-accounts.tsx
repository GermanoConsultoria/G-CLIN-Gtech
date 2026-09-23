import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import PlanoContasView from "@/components/financeiro/plano-contas-view";
import type { PlanoContas } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_app/chart-accounts")({
  component: PlanoContasPage,
});

function PlanoContasPage() {
  const { user } = useAuth();
  const [contas, setContas] = useState<PlanoContas[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("plano_contas")
      .select("*")
      .order("tipo")
      .order("nome")
      .then(({ data }) => {
        setContas(data ?? []);
        setCarregando(false);
      });
  }, [user]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Plano de Contas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Categorias para classificar receitas e despesas.
        </p>
      </div>
      {carregando ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <PlanoContasView contas={contas} />
      )}
    </div>
  );
}