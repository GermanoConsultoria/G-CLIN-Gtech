export type Modulo =
  | "agendamentos"
  | "servicos"
  | "pacientes"
  | "financeiro"
  | "usuarios"
  | "configuracoes";

export const MODULOS_LABELS: Record<Modulo, string> = {
  agendamentos: "Agendamentos",
  servicos: "Serviços",
  pacientes: "Pacientes",
  financeiro: "Financeiro",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

export type Role = "OWNER" | "MANAGER" | "USER";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Administrador",
  MANAGER: "Gerente",
  USER: "Usuário",
};

export type Profile = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  role: Role;
  modulos: Modulo[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export function temAcesso(profile: Profile | null, modulo: Modulo): boolean {
  if (!profile) return false;
  if (!profile.ativo) return false;
  if (profile.role === "OWNER") return true;
  if (profile.role === "MANAGER") return true;
  return profile.modulos.includes(modulo);
}