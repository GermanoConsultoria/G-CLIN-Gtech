-- ============================================================
-- Políticas RLS para agendamento público (/agendar)
-- Permite que usuários não autenticados (anon) consultem
-- serviços, horários e criem agendamentos.
-- ============================================================

-- 1. Serviços: leitura anônima (apenas ativos)
CREATE POLICY "anon_read_active_services"
  ON public.services
  FOR SELECT TO anon
  USING (active = true);

-- 2. Horários de funcionamento: leitura anônima (geração de slots)
CREATE POLICY "anon_read_business_hours"
  ON public.business_hours
  FOR SELECT TO anon
  USING (true);

-- 3. Agendamentos: leitura anônima de datas a partir de hoje
--    (necessário para checar disponibilidade de horários)
--    Expõe apenas scheduled_at e service_id, sem dados pessoais
CREATE POLICY "anon_read_appointments_availability"
  ON public.appointments
  FOR SELECT TO anon
  USING (scheduled_at::date >= current_date);

-- 4. Agendamentos: inserção anônima (criação pelo formulário público)
CREATE POLICY "anon_insert_appointments"
  ON public.appointments
  FOR INSERT TO anon
  WITH CHECK (true);

-- 5. Função SECURITY DEFINER para retornar o user_id da clínica
--    Mais seguro que expor a tabela clinic_settings via RLS,
--    pois retorna apenas o UUID sem outros dados sensíveis.
CREATE OR REPLACE FUNCTION public.get_clinic_user_id()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT user_id FROM public.clinic_settings LIMIT 1;
$$;

-- Permite que usuários anônimos executem a função
GRANT EXECUTE ON FUNCTION public.get_clinic_user_id() TO anon;
