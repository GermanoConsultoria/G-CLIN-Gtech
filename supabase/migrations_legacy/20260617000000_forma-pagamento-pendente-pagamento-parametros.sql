-- ITEM 1: forma_pagamento em lancamento_financeiro
ALTER TABLE public.lancamento_financeiro
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'DINHEIRO';

-- ITEM 2: status pendente_pagamento nos agendamentos
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'pendente_pagamento';

-- ITEM 4: tabela parametros
CREATE TABLE IF NOT EXISTS public.parametros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_contas_padrao_id UUID REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own parametros" ON public.parametros
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametros TO authenticated;
GRANT ALL ON public.parametros TO service_role;

CREATE TRIGGER parametros_updated_at
  BEFORE UPDATE ON public.parametros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
