import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getServiceClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !data || data.role !== "OWNER") {
    throw new Error("Apenas administradores podem gerenciar usuários.");
  }
}

const modulosValidos = z.array(
  z.enum([
    "agendamentos",
    "servicos",
    "pacientes",
    "financeiro",
    "usuarios",
    "configuracoes",
  ])
);

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      full_name: z.string().min(1).max(200),
      email: z.string().email(),
      cargo: z.string().max(100).optional(),
      role: z.enum(["USER", "MANAGER", "OWNER"]).default("USER"),
      senha: z.string().min(6),
      modulos: modulosValidos.default([]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);

    const admin = getServiceClient();

    const { data: user, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.role },
    });

    if (error) throw new Error(error.message);
    if (!user.user) throw new Error("Falha ao criar usuário.");

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: data.full_name,
        cargo: data.cargo ?? null,
        role: data.role,
        modulos: data.modulos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.user.id);

    if (profileError) throw new Error(profileError.message);

    return { ok: true, id: user.user.id };
  });

export const editarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      full_name: z.string().min(1).max(200),
      cargo: z.string().max(100).nullable().optional(),
      role: z.enum(["USER", "MANAGER", "OWNER"]),
      modulos: modulosValidos.default([]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        cargo: data.cargo ?? null,
        role: data.role,
        modulos: data.modulos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAtivoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);

    if (data.id === context.userId) {
      throw new Error("Você não pode desativar sua própria conta.");
    }

    const { data: profile, error: fetchError } = await context.supabase
      .from("profiles")
      .select("ativo")
      .eq("id", data.id)
      .single();
    if (fetchError || !profile) throw new Error("Usuário não encontrado.");

    const { error } = await context.supabase
      .from("profiles")
      .update({ ativo: !profile.ativo, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const alterarSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      nova_senha: z.string().min(6),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (data.id !== context.userId) {
      await requireOwner(context.supabase, context.userId);
    }

    const admin = getServiceClient();
    const { error } = await admin.auth.admin.updateUserById(data.id, {
      password: data.nova_senha,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
