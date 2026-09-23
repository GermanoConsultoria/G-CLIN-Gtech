import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LogOut, Calendar, Home, Search, Clock, Briefcase,
  TrendingUp, TrendingDown, Scale, BookOpen,
  Users, Menu, X, Tag, FolderHeart, AlertCircle,
  UserSquare2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { temAcesso, type Modulo } from "@/lib/auth";
import gtechLogo from "@/assets/g-tech-logo.png";
import logoGTech from "@/assets/g-tech-logo.png";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const mainNavItems = [
  { to: "/overview",  label: "Painel",          icon: Home,          modulo: null as Modulo | null },
  { to: "/dashboard", label: "Agendamentos",    icon: Calendar,      modulo: "agendamentos" as Modulo | null },
  { to: "/slots",     label: "Horários livres", icon: Search,        modulo: "agendamentos" as Modulo | null },
  { to: "/hours",     label: "Funcionamento",   icon: Clock,         modulo: "agendamentos" as Modulo | null },
  { to: "/services",  label: "Serviços",        icon: Briefcase,     modulo: "servicos" as Modulo | null },
  { to: "/pacientes", label: "Pacientes",       icon: UserSquare2,   modulo: "pacientes" as Modulo | null },
] as const;

const financeItems = [
  { to: "/receivables",      label: "A receber",        icon: TrendingUp,   modulo: "financeiro" as Modulo | null },
  { to: "/payables",         label: "A pagar",          icon: TrendingDown, modulo: "financeiro" as Modulo | null },
  { to: "/pending-payments", label: "Pend. Pagamentos", icon: AlertCircle,  modulo: "financeiro" as Modulo | null },
  { to: "/balance",          label: "Balancete",        icon: Scale,        modulo: "financeiro" as Modulo | null },
  { to: "/chart-accounts",   label: "Plano de contas",  icon: BookOpen,     modulo: "financeiro" as Modulo | null },
] as const;

const configItems = [
  { to: "/config/usuarios", label: "Usuários",   icon: Users,       modulo: "usuarios" as Modulo | null },
  { to: "/plans",           label: "Convênios",  icon: Tag,         modulo: "configuracoes" as Modulo | null },
  { to: "/categories",      label: "Categorias", icon: FolderHeart, modulo: "configuracoes" as Modulo | null },
] as const;

const ALL_NAV_ITEMS = [...mainNavItems, ...financeItems, ...configItems];

function NavItem({ 
  item, pathname, isCollapsed, setMobileOpen 
}: { 
  item: { to: string; label: string; icon: React.ElementType }; 
  pathname: string; 
  isCollapsed: boolean; 
  setMobileOpen: (v: boolean) => void;
}) {
  const active = pathname.startsWith(item.to);
  
  return (
    <Link
      to={item.to}
      title={isCollapsed ? item.label : undefined}
      onClick={() => setMobileOpen(false)}
      className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
        isCollapsed ? "justify-center" : "justify-start gap-3"
      } ${active ? "bg-[#A0B6D0]/10 text-[#A0B6D0]" : "text-gray-700 hover:bg-black/5"}`}
    >
      <item.icon className={`h-6 w-6 shrink-0 ${active ? "text-[#A0B6D0]" : "text-[#4A688C]"}`} />
      {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
    </Link>
  );
}

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  const visibleMain = mainNavItems.filter((item) => !item.modulo || temAcesso(profile, item.modulo));
  const visibleFinance = financeItems.filter((item) => !item.modulo || temAcesso(profile, item.modulo));
  const visibleConfig = configItems.filter((item) => !item.modulo || temAcesso(profile, item.modulo));

  useEffect(() => {
    if (loading || !user || !profile) return;
    const current = ALL_NAV_ITEMS.find((item) => pathname.startsWith(item.to));
    if (current?.modulo && !temAcesso(profile, current.modulo)) {
      nav({ to: "/overview" });
    }
  }, [loading, user, profile, pathname, nav]);

  if (loading || !user || !profile) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando...</div>;
  }

  if (!profile.ativo) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="font-display text-lg font-bold text-[#4A688C]">Conta desativada</p>
          <p className="mt-2 text-sm text-muted-foreground">Fale com o administrador da clínica para reativar seu acesso.</p>
          <button
            onClick={() => supabase.auth.signOut().then(() => nav({ to: "/" }))}
            className="mt-4 text-sm font-medium text-[#4A688C] hover:underline"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* Overlay Mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#F1F5FA] shadow-xl transition-all duration-300 ease-in-out lg:static
          ${mobileOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-20" : "lg:w-72"}
        `}
      >
        {/* Cabeçalho da Sidebar */}
        <div className="relative flex items-center justify-between px-4 py-4 border-b border-[#A0B6D0]/10">
          <div className={`flex flex-1 flex-col items-center gap-1 overflow-hidden text-center transition-opacity duration-300 ${isCollapsed ? "opacity-0 w-0 hidden lg:flex" : "opacity-100 w-auto"}`}>
            <img
              src={logoGTech}
              alt="G-Tech"
              className="h-14 w-auto max-w-[140px] shrink-0 object-contain"
            />
            <span className="font-display text-sm font-bold text-[#4A688C]">G-Tech</span>
          </div>

          {/* Botão Hamburger Desktop */}
          <button
            className="hidden lg:flex absolute right-4 top-4 p-2 rounded-md text-[#4A688C] hover:bg-black/5 transition-colors"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Botão Fechar Mobile */}
          <button
            className="lg:hidden absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-2"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-6 flex flex-col gap-2">
          
          {/* Menu Principal */}
          {visibleMain.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              pathname={pathname}
              isCollapsed={isCollapsed}
              setMobileOpen={setMobileOpen}
            />
          ))}

          {visibleFinance.length > 0 && (
            <>
              <div className="my-2 border-t border-[#A0B6D0]/20" />

              {/* Módulo Financeiro */}
              {!isCollapsed && <span className="px-4 text-xs font-bold text-[#4A688C]/60 uppercase tracking-wider mt-2 mb-1">Finanças</span>}
              {visibleFinance.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  pathname={pathname}
                  isCollapsed={isCollapsed}
                  setMobileOpen={setMobileOpen}
                />
              ))}
            </>
          )}

          {visibleConfig.length > 0 && (
            <>
              <div className="my-2 border-t border-[#A0B6D0]/20" />

              {/* Módulo Sistema */}
              {!isCollapsed && <span className="px-4 text-xs font-bold text-[#4A688C]/60 uppercase tracking-wider mt-2 mb-1">Sistema</span>}
            </>
          )}
          {visibleConfig.map((item) => (
            <NavItem 
              key={item.to} 
              item={item} 
              pathname={pathname} 
              isCollapsed={isCollapsed} 
              setMobileOpen={setMobileOpen} 
            />
          ))}

        </nav>

        {/* Rodapé da Sidebar */}
        <div className="border-t border-[#A0B6D0]/20 p-3">
          <button
            onClick={() => supabase.auth.signOut().then(() => nav({ to: "/" }))}
            title={isCollapsed ? "Sair" : undefined}
            className={`flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 ${
              isCollapsed ? "justify-center" : "justify-start gap-3"
            }`}
          >
            <LogOut className="h-6 w-6 shrink-0 text-red-500" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex flex-1 flex-col overflow-hidden h-screen">
        
        {/* Header Mobile */}
        <header className="flex h-20 items-center justify-between border-b bg-white px-4 lg:hidden shadow-sm">
          <div className="flex items-center gap-3 font-display font-bold text-[#4A688C]">
            <img src={logoGTech} alt="G-Tech" className="h-12 w-auto max-w-[120px] object-contain" />
            G-Tech
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-[#4A688C] hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Conteúdo Renderizado (Rotas) */}
        <main className="flex-1 overflow-auto bg-[#FAFAFB] p-6 lg:p-10 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}