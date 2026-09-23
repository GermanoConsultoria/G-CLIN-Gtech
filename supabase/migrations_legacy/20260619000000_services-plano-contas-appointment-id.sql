-- MELHORIA 1: Vincular serviços ao plano de contas financeiro
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS plano_contas_id UUID
  REFERENCES public.plano_contas(id) ON DELETE SET NULL;

-- MELHORIA 2/3: Rastrear qual agendamento gerou cada lançamento (evitar duplicatas)
ALTER TABLE public.lancamento_financeiro
  ADD COLUMN IF NOT EXISTS appointment_id UUID
  REFERENCES public.appointments(id) ON DELETE SET NULL;
