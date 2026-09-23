-- Generaliza o fluxo de assinatura via QR/link (antes só da paciente) para
-- também atender a médica: em vez de desenhar a assinatura com mouse dentro
-- do sistema logado, ela escaneia um QR e assina no próprio celular, fora do
-- sistema — igual à paciente. `assinatura_tipo` guarda qual fluxo o token
-- ativo representa ('paciente' ou 'medica'), para as funções saberem em quais
-- colunas gravar.

ALTER TABLE public.fichas_anamnese
  ADD COLUMN assinatura_tipo text CHECK (assinatura_tipo IN ('paciente', 'medica'));

CREATE OR REPLACE FUNCTION public.rpc_get_ficha_para_assinatura(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'nome_paciente', f.nome_paciente,
    'data_avaliacao', f.data_avaliacao,
    'tipo', f.assinatura_tipo
  )
  FROM public.fichas_anamnese f
  WHERE f.assinatura_token = p_token
    AND f.assinatura_token_expira_em > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.rpc_concluir_assinatura(p_token uuid, p_assinatura_imagem text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_tipo text;
BEGIN
  SELECT id, assinatura_tipo INTO v_id, v_tipo
  FROM public.fichas_anamnese
  WHERE assinatura_token = p_token
    AND assinatura_token_expira_em > now()
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_tipo = 'medica' THEN
    UPDATE public.fichas_anamnese
    SET assinatura_medico_imagem = p_assinatura_imagem,
        assinado_medico_em = now(),
        assinatura_token = NULL,
        assinatura_token_expira_em = NULL,
        assinatura_tipo = NULL
    WHERE id = v_id;
  ELSE
    UPDATE public.fichas_anamnese
    SET assinatura_imagem = p_assinatura_imagem,
        assinado_em = now(),
        data_assinatura = current_date,
        autorizado = true,
        autoriza_imagem = true,
        assinatura_token = NULL,
        assinatura_token_expira_em = NULL,
        assinatura_tipo = NULL
    WHERE id = v_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_ficha_para_assinatura(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_assinatura(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
