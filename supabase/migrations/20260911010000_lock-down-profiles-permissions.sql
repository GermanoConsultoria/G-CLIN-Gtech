-- Trava o controle de acesso por cargo/módulo também no banco de dados.
--
-- Problema encontrado: a política "own profile update" permitia que QUALQUER
-- usuário autenticado alterasse a própria linha em profiles sem restrição de
-- coluna — inclusive role/modulos/ativo — ou seja, qualquer USER conseguia se
-- auto-promover a OWNER. Além disso não existia nenhuma política que permitisse
-- a um OWNER enxergar ou editar o perfil de outros usuários (só a própria linha),
-- então a tela de "Usuários e permissões" nunca funcionou de fato para gerenciar
-- outras contas via RLS.

-- Função auxiliar (SECURITY DEFINER) para checar o cargo do usuário atual sem
-- cair em recursão de RLS ao consultar a própria tabela profiles.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- OWNER pode ver e editar o perfil de qualquer usuário.
CREATE POLICY "owners can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'OWNER');

CREATE POLICY "owners can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'OWNER')
  WITH CHECK (public.current_user_role() = 'OWNER');

-- Trigger: mesmo dentro da própria linha, ninguém além de OWNER (ou o backend
-- usando a service role) pode alterar role, modulos ou ativo.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.modulos IS DISTINCT FROM OLD.modulos
      OR NEW.ativo IS DISTINCT FROM OLD.ativo)
     AND public.current_user_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar cargo, módulos ou status de usuários.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_fields ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_profile_changes();
