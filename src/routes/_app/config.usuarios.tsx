import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Pencil, Power, KeyRound, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { criarUsuario, editarUsuario, toggleAtivoUsuario, alterarSenhaUsuario } from "@/lib/usuarios.functions";
import { MODULOS_LABELS, ROLE_LABELS, type Modulo, type Role } from "@/lib/auth";

export const Route = createFileRoute("/_app/config/usuarios")({
  component: UsuariosPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  role: string;
  ativo: boolean;
  modulos: string[];
  created_at: string;
  updated_at: string;
};

const ROLE_COR: Record<string, string> = {
  OWNER:   "bg-purple-100 text-purple-700 border-purple-200",
  MANAGER: "bg-blue-100 text-blue-700 border-blue-200",
  USER:    "bg-gray-100 text-gray-600 border-gray-200",
};

const TODOS_MODULOS = Object.keys(MODULOS_LABELS) as Modulo[];

function ModalCriarUsuario({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", cargo: "", senha: "",
    role: "USER" as Role, modulos: [] as Modulo[],
  });

  const toggleModulo = (m: Modulo) =>
    setForm((p) => ({
      ...p,
      modulos: p.modulos.includes(m) ? p.modulos.filter((x) => x !== m) : [...p.modulos, m],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await criarUsuario({ data: form });
      toast.success("Usuário criado com sucesso!");
      setOpen(false);
      setForm({ full_name: "", email: "", cargo: "", senha: "", role: "USER", modulos: [] });
      onSuccess();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Novo usuário</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Criar usuário</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Cargo</Label>
            <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex: Recepcionista" />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
          </div>
          <div className="space-y-1">
            <Label>Perfil</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.role === "USER" && (
            <div className="space-y-2">
              <Label>Módulos com acesso</Label>
              <div className="grid grid-cols-2 gap-2">
                {TODOS_MODULOS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.modulos.includes(m)} onChange={() => toggleModulo(m)} className="rounded" />
                    {MODULOS_LABELS[m]}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Criando..." : "Criar usuário"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModalEditarUsuario({ usuario, onSuccess }: { usuario: Profile; onSuccess: (u: Profile) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: usuario.full_name ?? "",
    cargo: usuario.cargo ?? "",
    role: usuario.role as Role,
    modulos: (usuario.modulos ?? []) as Modulo[],
  });

  const toggleModulo = (m: Modulo) =>
    setForm((p) => ({
      ...p,
      modulos: p.modulos.includes(m) ? p.modulos.filter((x) => x !== m) : [...p.modulos, m],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await editarUsuario({ data: { id: usuario.id, ...form } });
      toast.success("Usuário atualizado!");
      setOpen(false);
      onSuccess({ ...usuario, ...form });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Editar">
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Cargo</Label>
            <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex: Recepcionista" />
          </div>
          <div className="space-y-1">
            <Label>Perfil</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.role === "USER" && (
            <div className="space-y-2">
              <Label>Módulos com acesso</Label>
              <div className="grid grid-cols-2 gap-2">
                {TODOS_MODULOS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.modulos.includes(m)} onChange={() => toggleModulo(m)} className="rounded" />
                    {MODULOS_LABELS[m]}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModalAlterarSenha({ usuarioId }: { usuarioId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [senha, setSenha] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await alterarSenhaUsuario({ data: { id: usuarioId, nova_senha: senha } });
      toast.success("Senha alterada com sucesso!");
      setOpen(false);
      setSenha("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Alterar senha">
          <KeyRound className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Alterar senha</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nova senha</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Salvando..." : "Alterar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsuariosPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) toast.error(error.message);
    else setUsuarios((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) carregar();
  }, [user]);

  const handleToggleAtivo = async (id: string) => {
    try {
      await toggleAtivoUsuario({ data: { id } });
      setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, ativo: !u.ativo } : u));
      toast.success("Status atualizado!");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários e permissões</h1>
          <p className="text-sm text-muted-foreground">
            {usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""} cadastrado{usuarios.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <ModalCriarUsuario onSuccess={carregar} />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Cargo</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Perfil</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Módulos</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map((u) => {
                const isExpanded = expandedId === u.id;
                const modulos = (u.modulos ?? []) as Modulo[];
                const isOwner = u.role === "OWNER";
                return (
                  <>
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <button onClick={() => setExpandedId(isExpanded ? null : u.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {(u.full_name ?? "?").substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{u.full_name ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{u.cargo ?? "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COR[u.role] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {ROLE_LABELS[u.role as Role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isOwner ? (
                          <span className="text-xs text-emerald-600 font-medium">Todos</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {modulos.length === 0 ? "Nenhum" : `${modulos.length} módulo${modulos.length !== 1 ? "s" : ""}`}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${u.ativo ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <ModalEditarUsuario usuario={u} onSuccess={(atualizado) => setUsuarios((prev) => prev.map((x) => x.id === atualizado.id ? atualizado : x))} />
                          <ModalAlterarSenha usuarioId={u.id} />
                          <button
                            onClick={() => handleToggleAtivo(u.id)}
                            className={`p-1.5 transition-colors ${u.ativo ? "text-muted-foreground hover:text-red-600" : "text-muted-foreground hover:text-emerald-600"}`}
                            title={u.ativo ? "Desativar" : "Ativar"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${u.id}-modulos`} className="bg-muted/20">
                        <td colSpan={7} className="px-10 py-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Módulos com acesso</p>
                          {isOwner ? (
                            <p className="text-xs text-emerald-600">Administrador tem acesso a todos os módulos.</p>
                          ) : modulos.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum módulo liberado.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {modulos.map((m) => (
                                <span key={m} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                  {MODULOS_LABELS[m] ?? m}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Nenhum usuário cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}