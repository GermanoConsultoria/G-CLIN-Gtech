import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Calendar, MessageCircle, Stethoscope, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoGTech from "@/assets/g-tech-logo.png";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <img
            src={logoGTech}
            alt="G-Clin"
            className="h-14 w-auto max-w-[160px] object-contain"
          />
          G-Clin
        </div>
        <Link to="/auth"><Button variant="ghost">Entrar</Button></Link>
      </header>

      <main className="container mx-auto px-6 pb-24 pt-12 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            Gestão clínica simplificada
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight md:text-6xl">
            Agendamentos da sua clínica, <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">conectados ao WhatsApp</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Organize consultas e retornos, gerencie planos e envie confirmações pelo WhatsApp em um clique.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth"><Button size="lg" className="bg-[image:var(--gradient-hero)] shadow-[var(--shadow-soft)]">Começar agora</Button></Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            { icon: Calendar, t: "Agendamentos rápidos", d: "Cadastre paciente, horário, plano e tipo (consulta ou retorno) em segundos." },
            { icon: MessageCircle, t: "WhatsApp em 1 clique", d: "Envie confirmação, lembrete 24h ou reagendamento direto pelo WhatsApp do paciente." },
            { icon: ShieldCheck, t: "Seus dados protegidos", d: "Cada clínica acessa apenas seus próprios pacientes e agendamentos." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border bg-[image:var(--gradient-card)] p-6 shadow-[var(--shadow-card)]">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
