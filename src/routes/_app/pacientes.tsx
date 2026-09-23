import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  UserPlus, Search, FolderOpen, Phone, Mail,
  ChevronRight, Users, Loader2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/pacientes")({ component: Pacientes });

type Paciente = {
  id: string;
  nome: string;
  data_nasc: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
};

function NovoPacienteDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    data_nasc: "",
    cpf: "",
    telefone: "",
    email: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    profissao: "",
    estado_civil: "",
  });

  const field = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("pacientes").insert({
      ...form,
      data_nasc: form.data_nasc || null,
      user_id: user!.id,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Paciente cadastrado com sucesso!");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#A0B6D0]/20 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-[#4A688C]">Novo Paciente</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 max-h-[70vh] overflow-y-auto">
          <div className="sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={form.nome} onChange={field("nome")} placeholder="Nome da paciente" />
          </div>
          <div>
            <Label>Data de Nascimento</Label>
            <Input type="date" value={form.data_nasc} onChange={field("data_nasc")} />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={form.cpf} onChange={field("cpf")} placeholder="000.000.000-00" />
          </div>
          <div>
            <Label>Telefone / Celular</Label>
            <Input value={form.telefone} onChange={field("telefone")} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={field("email")} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>Profissão</Label>
            <Input value={form.profissao} onChange={field("profissao")} />
          </div>
          <div>
            <Label>Estado Civil</Label>
            <select
              value={form.estado_civil}
              onChange={field("estado_civil")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none"
            >
              <option value="">Selecione</option>
              <option>Solteiro(a)</option>
              <option>Casado(a)</option>
              <option>Divorciado(a)</option>
              <option>Viúvo(a)</option>
              <option>União Estável</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={field("endereco")} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={field("bairro")} />
          </div>
          <div>
            <Label>CEP</Label>
            <Input value={form.cep} onChange={field("cep")} placeholder="00000-000" />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={field("cidade")} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.estado} onChange={field("estado")} placeholder="SP" maxLength={2} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#A0B6D0]/20 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#4A688C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3D5674] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Paciente
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#A0B6D0] focus:outline-none focus:ring-2 focus:ring-[#A0B6D0]/20"
    />
  );
}

function calcIdade(dataNasc: string | null): string {
  if (!dataNasc) return "—";
  const diff = Date.now() - new Date(dataNasc).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + " anos";
}

function Pacientes() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  async function fetchPacientes() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("pacientes")
      .select("id,nome,data_nasc,cpf,telefone,email,cidade,estado,created_at")
      .eq("user_id", user!.id)
      .order("nome");
    setLoading(false);
    if (error) { toast.error("Erro ao carregar pacientes"); return; }
    setPacientes(data ?? []);
  }

  useEffect(() => { if (pathname === "/pacientes") fetchPacientes(); }, [pathname]);

  if (pathname !== "/pacientes") return <Outlet />;

  const filtered = pacientes.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.telefone ?? "").includes(search) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#4A688C]">Pacientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pacientes.length} paciente{pacientes.length !== 1 ? "s" : ""} cadastrado{pacientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-2 rounded-xl bg-[#4A688C] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#3D5674] transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Nova Paciente
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-[#A0B6D0] focus:outline-none focus:ring-2 focus:ring-[#A0B6D0]/20"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#A0B6D0]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[#A0B6D0]/30 py-24 text-center">
          <div className="rounded-full bg-[#A0B6D0]/10 p-4">
            <Users className="h-8 w-8 text-[#A0B6D0]" />
          </div>
          <div>
            <p className="font-semibold text-gray-700">
              {search ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search ? "Tente outro termo de busca" : "Clique em 'Nova Paciente' para começar"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <Link
                key={p.id}
                to="/pacientes/$pacienteId"
                params={{ pacienteId: p.id }}
                className="group flex items-center gap-4 ..."
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A0B6D0]/15 text-[#4A688C] font-bold text-lg">
                {p.nome.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{p.nome}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {p.data_nasc && (
                    <span className="text-xs text-muted-foreground">{calcIdade(p.data_nasc)}</span>
                  )}
                  {p.telefone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />{p.telefone}
                    </span>
                  )}
                  {p.email && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />{p.email}
                    </span>
                  )}
                  {p.cidade && (
                    <span className="text-xs text-muted-foreground">{p.cidade}{p.estado ? ` / ${p.estado}` : ""}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[#4A688C]">
                <FolderOpen className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-[#A0B6D0] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showDialog && (
        <NovoPacienteDialog onClose={() => setShowDialog(false)} onSaved={fetchPacientes} />
      )}
    </div>
  );
}