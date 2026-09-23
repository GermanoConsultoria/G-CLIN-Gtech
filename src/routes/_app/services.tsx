import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Briefcase, Pencil, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { PlanoContas } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_app/services")({ component: Services });

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  duration_minutes: number;
  active: boolean;
  is_hof: boolean;
  category_group: string | null;
  plano_contas_id: string | null;
};

const CATEGORIAS = [
  { value: "sobrancelhas",     label: "Sobrancelhas" },
  { value: "micropigmentacao", label: "Micropigmentação" },
  { value: "depilacao",        label: "Depilação" },
  { value: "facial",           label: "Tratamento Facial" },
  { value: "hof",              label: "HOF (Alto Valor)" },
  { value: "outros",           label: "Outros" },
];

const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

// Mapeamento category_group → nome no plano_contas (igual ao da migration)
const CATEGORIA_PLANO_NOME: Record<string, string> = {
  sobrancelhas:     "Sobrancelhas",
  micropigmentacao: "Micropigmentação",
  depilacao:        "Depilação",
  facial:           "Tratamento Facial",
  hof:              "HOF",
};

const CATEGORIA_COR: Record<string, string> = {
  sobrancelhas:     "bg-pink-100 text-pink-700 border-pink-200",
  micropigmentacao: "bg-purple-100 text-purple-700 border-purple-200",
  depilacao:        "bg-blue-100 text-blue-700 border-blue-200",
  facial:           "bg-emerald-100 text-emerald-700 border-emerald-200",
  hof:              "bg-amber-100 text-amber-700 border-amber-200",
  outros:           "bg-muted text-muted-foreground",
};

const empty = {
  name: "", description: "", price: "0", cost: "0",
  duration_minutes: "30", active: true, is_hof: false,
  category_group: "outros", plano_contas_id: "",
};

function Services() {
  const { user } = useAuth();
  const [items, setItems] = useState<Service[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [filtro, setFiltro] = useState<"todos" | "fixo" | "hof">("todos");

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: pc }] = await Promise.all([
      supabase.from("services").select("*").order("category_group").order("name"),
      supabase.from("plano_contas").select("*").eq("tipo", "RECEITA").eq("ativo", true).order("nome"),
    ]);
    setItems((s as Service[]) ?? []);
    setPlanoContas(pc ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      cost: Number(form.cost),
      duration_minutes: Number(form.duration_minutes),
      active: form.active,
      is_hof: form.is_hof,
      category_group: form.category_group || null,
      plano_contas_id: form.plano_contas_id || null,
    };
    const { error } = editingId
      ? await supabase.from("services").update(payload).eq("id", editingId)
      : await supabase.from("services").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Serviço atualizado" : "Serviço cadastrado");
    setOpen(false); setForm(empty); setEditingId(null); load();
  };

  const edit = (s: Service) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: String(s.price),
      cost: String(s.cost),
      duration_minutes: String(s.duration_minutes),
      active: s.active,
      is_hof: s.is_hof,
      category_group: s.category_group ?? "outros",
      plano_contas_id: s.plano_contas_id ?? "",
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este serviço?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Serviço removido"); load();
  };

  const toggleAtivo = async (s: Service) => {
    await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    load();
  };

  const margin = (s: Service) =>
    s.price > 0 ? (((s.price - s.cost) / s.price) * 100).toFixed(1) : "—";

  const filtered = items.filter((s) => {
    if (filtro === "fixo") return !s.is_hof;
    if (filtro === "hof")  return s.is_hof;
    return true;
  });

  // Agrupar por categoria
  const grupos = CATEGORIAS.map((cat) => ({
    ...cat,
    services: filtered.filter((s) => (s.category_group ?? "outros") === cat.value),
  })).filter((g) => g.services.length > 0);

  const totalFixo = items.filter((s) => !s.is_hof && s.active).length;
  const totalHof  = items.filter((s) =>  s.is_hof && s.active).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {totalFixo} serviços com valor fixo · {totalHof} procedimentos HOF
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(empty); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button className="bg-[image:var(--gradient-hero)]">
              <Plus className="h-4 w-4" /> Novo serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} serviço</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Nome</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category_group} onValueChange={(v) => {
                  const nomePlano = CATEGORIA_PLANO_NOME[v];
                  const pcId = nomePlano
                    ? (planoContas.find((pc) => pc.nome === nomePlano)?.id ?? form.plano_contas_id)
                    : form.plano_contas_id;
                  setForm({ ...form, category_group: v, is_hof: v === "hof", plano_contas_id: pcId || "" });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  {form.is_hof && <p className="mt-1 text-xs text-amber-600">HOF: deixe 0 se sob avaliação</p>}
                </div>
                <div><Label>Custo (R$)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
                <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
              </div>
              <div>
                <Label>Categoria financeira (Plano de contas)</Label>
                <Select
                  value={form.plano_contas_id || "none"}
                  onValueChange={(v) => setForm({ ...form, plano_contas_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (usar padrão)</SelectItem>
                    {planoContas.map((pc) => (
                      <SelectItem key={pc.id} value={pc.id}>{pc.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Usada ao lançar automaticamente no financeiro ao concluir atendimentos.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_hof} onCheckedChange={(v) => setForm({ ...form, is_hof: v, category_group: v ? "hof" : form.category_group })} />
                  <Label className="text-amber-700">HOF</Label>
                </div>
              </div>
              <Button type="submit" className="w-full bg-[image:var(--gradient-hero)]">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2">
        {[
          { key: "todos", label: `Todos (${items.length})` },
          { key: "fixo",  label: `Valor fixo (${items.filter((s) => !s.is_hof).length})` },
          { key: "hof",   label: `HOF (${items.filter((s) => s.is_hof).length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key as typeof filtro)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filtro === f.key
                ? "bg-primary text-primary-foreground"
                : "border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum serviço encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.value}>
              <div className="mb-3 flex items-center gap-2">
                {grupo.value === "hof" && <Sparkles className="h-4 w-4 text-amber-500" />}
                <h2 className="font-display text-lg font-semibold">{grupo.label}</h2>
                <span className="text-xs text-muted-foreground">({grupo.services.length})</span>
                {grupo.value === "hof" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
                    Sob avaliação · R$ 150,00
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {grupo.services.map((s) => (
                  <div key={s.id} className={`rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] ${!s.active ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{s.name}</span>
                          {s.is_hof && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
                              <Sparkles className="h-3 w-3" /> HOF
                            </span>
                          )}
                          {s.category_group && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${CATEGORIA_COR[s.category_group] ?? "bg-muted text-muted-foreground"}`}>
                              {CATEGORIA_LABEL[s.category_group] ?? s.category_group}
                            </span>
                          )}
                          {!s.active && (
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inativo</span>
                          )}
                        </div>
                        {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {s.duration_minutes} min
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => toggleAtivo(s)} title={s.active ? "Desativar" : "Ativar"}>
                          <div className={`h-2 w-2 rounded-full ${s.active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => edit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-muted-foreground">Preço</div>
                        <div className="font-semibold text-foreground">
                          {s.is_hof && Number(s.price) === 0 ? "Avaliação" : `R$ ${Number(s.price).toFixed(2)}`}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-muted-foreground">Custo</div>
                        <div className="font-semibold">R$ {Number(s.cost).toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-muted-foreground">Margem</div>
                        <div className={`font-semibold ${Number(s.price) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {margin(s)}{Number(s.price) > 0 ? "%" : ""}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <div className="text-muted-foreground">Duração</div>
                        <div className="font-semibold">{s.duration_minutes}min</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}