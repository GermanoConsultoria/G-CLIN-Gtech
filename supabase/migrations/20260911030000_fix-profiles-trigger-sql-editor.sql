-- Corrige o trigger de proteção de profiles: uma sessão sem contexto de JWT
-- (SQL Editor do Supabase, psql direto, migrations) tem auth.uid() = NULL,
-- e o trigger original bloqueava essas alterações por engano — ele só devia
-- bloquear usuários comuns chamando pela API do app.

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
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
