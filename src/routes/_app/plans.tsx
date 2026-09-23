import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/plans")({ component: Plans });

type Plan = { id: string; name: string };

function Plans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("id, name").order("name");
    setPlans((data as Plan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("plans").insert({ user_id: user.id, name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Plano adicionado");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano removido");
    load();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Planos de saúde</h1>
        <p className="text-sm text-muted-foreground">Cadastre os convênios atendidos pela clínica.</p>
      </div>

      <form onSubmit={add} className="mb-6 flex gap-2">
        <Input placeholder="Ex: Unimed, Bradesco Saúde, Particular..." value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" className="bg-[image:var(--gradient-hero)]"><Plus className="h-4 w-4" /> Adicionar</Button>
      </form>

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <Tag className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum plano cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="h-4 w-4" />
                </div>
                <span className="font-medium">{p.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
