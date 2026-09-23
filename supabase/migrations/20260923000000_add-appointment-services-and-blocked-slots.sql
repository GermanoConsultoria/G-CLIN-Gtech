-- Duas tabelas usadas pelo front-end (src/routes/_app/dashboard.tsx,
-- src/routes/_app/hours.tsx, src/routes/agendar.tsx) que nunca tinham
-- migration — mesmo problema descrito na baseline (schema real criado
-- direto no Studio). Sem elas: agendamento com múltiplos serviços e
-- bloqueio manual de horário na agenda quebram com erro 404 do PostgREST.

-- appointment_services: itens de serviço de um agendamento (permite
-- selecionar mais de um serviço por atendimento; snapshot de
-- nome/preço/custo no momento do agendamento, igual a service_name em
-- appointments).
CREATE TABLE public.appointment_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    service_id uuid,
    service_name text NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    cost numeric(12,2) DEFAULT 0 NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    is_hof boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.appointment_services
    ADD CONSTRAINT appointment_services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.appointment_services
    ADD CONSTRAINT appointment_services_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.appointment_services
    ADD CONSTRAINT appointment_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

CREATE INDEX idx_appointment_services_appointment ON public.appointment_services USING btree (appointment_id);

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own appointment services" ON public.appointment_services
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.user_id = auth.uid()));

GRANT ALL ON TABLE public.appointment_services TO anon;
GRANT ALL ON TABLE public.appointment_services TO authenticated;
GRANT ALL ON TABLE public.appointment_services TO service_role;

-- blocked_slots: bloqueios manuais de horário (ex.: folga, feriado,
-- compromisso pessoal) que somem da agenda pública (/agendar) e da agenda
-- interna. Leitura pública igual a business_hours/services, pois a rota
-- de agendamento do paciente é anônima.
CREATE TABLE public.blocked_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.blocked_slots
    ADD CONSTRAINT blocked_slots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.blocked_slots
    ADD CONSTRAINT blocked_slots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_blocked_slots_user_date ON public.blocked_slots USING btree (user_id, date);

ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_public_read_blocked_slots ON public.blocked_slots FOR SELECT TO anon USING (true);

CREATE POLICY "users manage own blocked slots" ON public.blocked_slots
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.blocked_slots TO anon;
GRANT ALL ON TABLE public.blocked_slots TO authenticated;
GRANT ALL ON TABLE public.blocked_slots TO service_role;

NOTIFY pgrst, 'reload schema';
