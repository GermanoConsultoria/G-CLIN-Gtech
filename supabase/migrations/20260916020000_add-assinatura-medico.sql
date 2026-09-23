-- Assinatura digital da médica (separada da assinatura da paciente já existente
-- em assinatura_imagem/assinado_em). A médica assina direto no próprio
-- dispositivo (sem QR/token, já autenticada), então não precisa das mesmas
-- funções RPC públicas usadas no fluxo da paciente.
ALTER TABLE public.fichas_anamnese
  ADD COLUMN assinatura_medico_imagem text,
  ADD COLUMN assinado_medico_em timestamptz;
