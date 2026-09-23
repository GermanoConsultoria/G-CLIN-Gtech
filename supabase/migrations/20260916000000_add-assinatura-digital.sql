-- Assinatura digital presencial do prontuário (fichas_anamnese)
--
-- Fluxo: a profissional (autenticada) gera um token de curta duração na ficha.
-- O link/QR code público (/assinar/$token) é aberto pelo celular da paciente,
-- que desenha a assinatura na tela. Como a paciente NÃO está autenticada, o
-- acesso e a gravação passam por funções SECURITY DEFINER que expõem apenas
-- os campos necessários e validam o token (existência + expiração) — a tabela
-- fichas_anamnese continua protegida pela RLS "fichas_owner" para todo o resto.

ALTER TABLE public.fichas_anamnese
  ADD COLUMN assinatura_token uuid,
  ADD COLUMN assinatura_token_expira_em timestamptz,
  ADD COLUMN assinatura_imagem text,
  ADD COLUMN assinado_em timestamptz;

CREATE INDEX fichas_anamnese_assinatura_token_idx
  ON public.fichas_anamnese (assinatura_token)
  WHERE assinatura_token IS NOT NULL;

-- Retorna os dados mínimos para exibir a tela de assinatura (não expõe a
-- anamnese clínica completa). NULL se o token não existir ou tiver expirado.
CREATE OR REPLACE FUNCTION public.rpc_get_ficha_para_assinatura(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'nome_paciente', f.nome_paciente,
    'data_avaliacao', f.data_avaliacao,
    'assinado_em', f.assinado_em
  )
  FROM public.fichas_anamnese f
  WHERE f.assinatura_token = p_token
    AND f.assinatura_token_expira_em > now()
  LIMIT 1;
$$;

-- Grava a assinatura (imagem base64 do canvas), marca a ficha como assinada
-- e invalida o token (uso único). Retorna false se o token for inválido/expirado.
CREATE OR REPLACE FUNCTION public.rpc_concluir_assinatura(p_token uuid, p_assinatura_imagem text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.fichas_anamnese
  WHERE assinatura_token = p_token
    AND assinatura_token_expira_em > now()
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.fichas_anamnese
  SET assinatura_imagem = p_assinatura_imagem,
      assinado_em = now(),
      data_assinatura = current_date,
      autorizado = true,
      autoriza_imagem = true,
      assinatura_token = NULL,
      assinatura_token_expira_em = NULL
  WHERE id = v_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_ficha_para_assinatura(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_assinatura(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
