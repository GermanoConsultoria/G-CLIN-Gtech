--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: account_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_kind AS ENUM (
    'receita',
    'despesa'
);


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'agendado',
    'confirmado',
    'concluido',
    'cancelado',
    'falta',
    'pendente_pagamento'
);


--
-- Name: appointment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_type AS ENUM (
    'procedimento',
    'avaliacao',
    'retorno',
    'encaixe'
);


--
-- Name: finance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.finance_status AS ENUM (
    'pendente',
    'pago',
    'atrasado',
    'cancelado'
);


--
-- Name: buscar_sessoes_para_lembrete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_sessoes_para_lembrete() RETURNS TABLE(id uuid, phone text, etapa text, updated_at timestamp with time zone)
    LANGUAGE sql
    AS $$
  select s.id, s.phone, s.etapa, s.updated_at
  from whatsapp_sessao s
  left join whatsapp_lembrete_enviado l on l.phone = s.phone
  where s.etapa = 'aguardando_resposta'
    and s.updated_at < now() - interval '1 minute'
    and l.id is null;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER')
  );
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: anexo_financeiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anexo_financeiro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lancamento_id uuid NOT NULL,
    nome text NOT NULL,
    url text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_name text NOT NULL,
    phone text NOT NULL,
    service_id uuid,
    service_name text,
    type public.appointment_type DEFAULT 'procedimento'::public.appointment_type NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status public.appointment_status DEFAULT 'agendado'::public.appointment_status NOT NULL,
    notes text,
    wants_to_anticipate boolean DEFAULT false NOT NULL,
    category text,
    extra_charge boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arquivos_paciente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arquivos_paciente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    paciente_id uuid NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    tipo text,
    url text NOT NULL,
    tamanho bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: business_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    weekday smallint NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    open_time time without time zone DEFAULT '07:00:00'::time without time zone NOT NULL,
    close_time time without time zone DEFAULT '19:00:00'::time without time zone NOT NULL,
    break_start time without time zone,
    break_end time without time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_hours_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chart_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    kind public.account_kind NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    clinic_name text DEFAULT 'G-Tech'::text NOT NULL,
    whatsapp_number text,
    reminder_24h_enabled boolean DEFAULT true NOT NULL,
    reminder_10min_enabled boolean DEFAULT true NOT NULL,
    no_children_message boolean DEFAULT true NOT NULL,
    no_pets_message boolean DEFAULT true NOT NULL,
    late_cancellation_fee boolean DEFAULT true NOT NULL,
    evaluation_fee numeric(10,2) DEFAULT 150.00 NOT NULL,
    evaluation_free_campaign boolean DEFAULT false NOT NULL,
    opening_hour text DEFAULT '07:00'::text NOT NULL,
    closing_hour text DEFAULT '19:00'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fichas_anamnese; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fichas_anamnese (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    paciente_id uuid NOT NULL,
    user_id uuid NOT NULL,
    data_avaliacao date DEFAULT CURRENT_DATE NOT NULL,
    queixa text,
    duracao_queixa text,
    trat_estetico_anterior boolean,
    trat_estetico_qual text,
    usa_lente_contato boolean,
    usa_cosmeticos boolean,
    cosmeticos_qual text,
    exposicao_sol boolean,
    filtro_solar boolean,
    filtro_solar_frequencia text,
    tabagismo boolean,
    tabagismo_quantidade text,
    alcool boolean,
    alcool_frequencia text,
    funcionamento_intestinal text,
    qualidade_sono text,
    horas_sono text,
    muito_tempo_pe_sentada boolean,
    quanto_tempo_pe_sentada text,
    ingestao_agua_copos text,
    tipo_alimentacao text,
    alimentos_preferencia text,
    atividade_fisica boolean,
    atividade_fisica_tipo text,
    atividade_fisica_frequencia text,
    anticoncepcional boolean,
    anticoncepcional_qual text,
    dt_ultima_menstruacao date,
    gestante boolean,
    gestacoes boolean,
    gestacoes_quantas text,
    gestacoes_tempo text,
    tratamento_medico_atual boolean,
    medicamentos_uso text,
    uso_anticoagulantes boolean,
    anticoagulantes_quais text,
    antecedentes_alergicos boolean,
    alergias_quais text,
    alergia_anestesico boolean,
    marcapasso boolean,
    alteracoes_cardiacas boolean,
    alteracoes_cardiacas_quais text,
    hipo_hipertensao boolean,
    disturbio_circulatorio boolean,
    disturbio_circulatorio_qual text,
    disturbio_renal boolean,
    disturbio_renal_qual text,
    disturbio_hormonal boolean,
    disturbio_hormonal_qual text,
    disturbio_gastro boolean,
    disturbio_gastro_qual text,
    epilepsia boolean,
    epilepsia_frequencia text,
    alteracoes_psicologicas boolean,
    alteracoes_psicologicas_quais text,
    estresse boolean,
    estresse_obs text,
    antecedentes_oncologicos boolean,
    antecedentes_oncologicos_qual text,
    diabetes boolean,
    diabetes_tipo text,
    doenca_autoimune boolean,
    doenca_autoimune_qual text,
    soropositivo boolean,
    outra_condicao text,
    dt_ultimo_checkup date,
    proteses_metalicas boolean,
    proteses_metalicas_qual text,
    implante_dentario boolean,
    trat_dermatologico boolean,
    trat_dermatologico_qual text,
    cirurgia_plastica boolean,
    cirurgia_plastica_qual text,
    cirurgia_reparadora boolean,
    cirurgia_reparadora_qual text,
    autorizado boolean DEFAULT false,
    autoriza_imagem boolean DEFAULT false,
    data_assinatura date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telefone_residencial text,
    telefone_comercial text,
    telefone_celular text,
    idade text,
    cep text,
    nome_paciente text,
    idade_paciente text,
    endereco_paciente text,
    cep_paciente text,
    bairro_paciente text,
    cidade_paciente text,
    estado_paciente text,
    celular_paciente text,
    data_nasc_paciente text,
    cpf_paciente text,
    profissao_paciente text,
    estado_civil_paciente text,
    email_paciente text
);


--
-- Name: lancamento_financeiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamento_financeiro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    descricao text NOT NULL,
    beneficiario text,
    valor numeric(12,2) NOT NULL,
    dt_vencimento timestamp with time zone NOT NULL,
    dt_pagamento date,
    numero_documento text,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    recorrencia text DEFAULT 'NAO'::text NOT NULL,
    numero_parcelas integer,
    parcela_atual integer,
    grupo_parcela_id uuid,
    lancamento_pai_id uuid,
    plano_contas_id uuid NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    forma_pagamento text DEFAULT 'DINHEIRO'::text,
    appointment_id uuid,
    CONSTRAINT lancamento_financeiro_forma_pagamento_check CHECK ((forma_pagamento = ANY (ARRAY['DINHEIRO'::text, 'PIX'::text, 'CARTAO_CREDITO'::text, 'CARTAO_DEBITO'::text, 'CONVENIO'::text, 'OUTRO'::text]))),
    CONSTRAINT lancamento_financeiro_recorrencia_check CHECK ((recorrencia = ANY (ARRAY['NAO'::text, 'DIARIAMENTE'::text, 'SEMANALMENTE'::text, 'MENSALMENTE'::text]))),
    CONSTRAINT lancamento_financeiro_status_check CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'PAGO'::text, 'CANCELADO'::text]))),
    CONSTRAINT lancamento_financeiro_tipo_check CHECK ((tipo = ANY (ARRAY['RECEITA'::text, 'DESPESA'::text])))
);


--
-- Name: pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pacientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    data_nasc date,
    cpf text,
    telefone text,
    email text,
    endereco text,
    bairro text,
    cidade text,
    estado text,
    cep text,
    profissao text,
    estado_civil text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parametros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plano_contas_padrao_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    description text NOT NULL,
    supplier text,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    paid_at date,
    status public.finance_status DEFAULT 'pendente'::public.finance_status NOT NULL,
    account_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plano_contas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plano_contas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plano_contas_tipo_check CHECK ((tipo = ANY (ARRAY['RECEITA'::text, 'DESPESA'::text])))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    cargo text,
    role text DEFAULT 'USER'::text NOT NULL,
    modulos text[] DEFAULT '{}'::text[] NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['OWNER'::text, 'MANAGER'::text, 'USER'::text])))
);


--
-- Name: receivables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    description text NOT NULL,
    client_name text,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    received_at date,
    status public.finance_status DEFAULT 'pendente'::public.finance_status NOT NULL,
    account_id uuid,
    service_id uuid,
    appointment_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    cost numeric(12,2) DEFAULT 0 NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    is_hof boolean DEFAULT false NOT NULL,
    category_group text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plano_contas_id uuid
);


--
-- Name: whatsapp_lembrete_enviado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_lembrete_enviado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_sessao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_sessao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    etapa text DEFAULT 'aguardando_resposta'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lembrete_enviado boolean DEFAULT false
);


--
-- Name: anexo_financeiro anexo_financeiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_financeiro
    ADD CONSTRAINT anexo_financeiro_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: arquivos_paciente arquivos_paciente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos_paciente
    ADD CONSTRAINT arquivos_paciente_pkey PRIMARY KEY (id);


--
-- Name: business_hours business_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_pkey PRIMARY KEY (id);


--
-- Name: business_hours business_hours_user_id_weekday_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_user_id_weekday_key UNIQUE (user_id, weekday);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: chart_accounts chart_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_accounts
    ADD CONSTRAINT chart_accounts_pkey PRIMARY KEY (id);


--
-- Name: clinic_settings clinic_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_settings
    ADD CONSTRAINT clinic_settings_pkey PRIMARY KEY (id);


--
-- Name: clinic_settings clinic_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_settings
    ADD CONSTRAINT clinic_settings_user_id_key UNIQUE (user_id);


--
-- Name: fichas_anamnese fichas_anamnese_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas_anamnese
    ADD CONSTRAINT fichas_anamnese_pkey PRIMARY KEY (id);


--
-- Name: lancamento_financeiro lancamento_financeiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamento_financeiro
    ADD CONSTRAINT lancamento_financeiro_pkey PRIMARY KEY (id);


--
-- Name: pacientes pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_pkey PRIMARY KEY (id);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- Name: parametros parametros_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros
    ADD CONSTRAINT parametros_user_id_key UNIQUE (user_id);


--
-- Name: payables payables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_pkey PRIMARY KEY (id);


--
-- Name: plano_contas plano_contas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plano_contas
    ADD CONSTRAINT plano_contas_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: receivables receivables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_lembrete_enviado whatsapp_lembrete_enviado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_lembrete_enviado
    ADD CONSTRAINT whatsapp_lembrete_enviado_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_sessao whatsapp_sessao_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessao
    ADD CONSTRAINT whatsapp_sessao_phone_key UNIQUE (phone);


--
-- Name: whatsapp_sessao whatsapp_sessao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessao
    ADD CONSTRAINT whatsapp_sessao_pkey PRIMARY KEY (id);


--
-- Name: idx_anexo_lancamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexo_lancamento ON public.anexo_financeiro USING btree (lancamento_id);


--
-- Name: idx_appointments_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_user_date ON public.appointments USING btree (user_id, scheduled_at);


--
-- Name: idx_lancamento_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamento_grupo ON public.lancamento_financeiro USING btree (grupo_parcela_id);


--
-- Name: idx_lancamento_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamento_status ON public.lancamento_financeiro USING btree (status);


--
-- Name: idx_lancamento_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamento_tipo ON public.lancamento_financeiro USING btree (tipo);


--
-- Name: idx_lancamento_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamento_vencimento ON public.lancamento_financeiro USING btree (dt_vencimento);


--
-- Name: appointments appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clinic_settings clinic_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clinic_settings_updated_at BEFORE UPDATE ON public.clinic_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fichas_anamnese fichas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fichas_updated_at BEFORE UPDATE ON public.fichas_anamnese FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lancamento_financeiro lancamento_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lancamento_updated_at BEFORE UPDATE ON public.lancamento_financeiro FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pacientes pacientes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payables payables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payables_updated_at BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plano_contas plano_contas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER plano_contas_updated_at BEFORE UPDATE ON public.plano_contas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: receivables receivables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER receivables_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: services services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_sessao trg_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.whatsapp_sessao FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: business_hours update_business_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_hours_updated_at BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: anexo_financeiro anexo_financeiro_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_financeiro
    ADD CONSTRAINT anexo_financeiro_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: anexo_financeiro anexo_financeiro_lancamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_financeiro
    ADD CONSTRAINT anexo_financeiro_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES public.lancamento_financeiro(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: arquivos_paciente arquivos_paciente_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos_paciente
    ADD CONSTRAINT arquivos_paciente_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;


--
-- Name: arquivos_paciente arquivos_paciente_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos_paciente
    ADD CONSTRAINT arquivos_paciente_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chart_accounts chart_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_accounts
    ADD CONSTRAINT chart_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chart_accounts(id) ON DELETE SET NULL;


--
-- Name: clinic_settings clinic_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_settings
    ADD CONSTRAINT clinic_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fichas_anamnese fichas_anamnese_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas_anamnese
    ADD CONSTRAINT fichas_anamnese_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;


--
-- Name: fichas_anamnese fichas_anamnese_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas_anamnese
    ADD CONSTRAINT fichas_anamnese_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lancamento_financeiro lancamento_financeiro_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamento_financeiro
    ADD CONSTRAINT lancamento_financeiro_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: lancamento_financeiro lancamento_financeiro_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamento_financeiro
    ADD CONSTRAINT lancamento_financeiro_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: lancamento_financeiro lancamento_financeiro_lancamento_pai_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamento_financeiro
    ADD CONSTRAINT lancamento_financeiro_lancamento_pai_id_fkey FOREIGN KEY (lancamento_pai_id) REFERENCES public.lancamento_financeiro(id) ON DELETE SET NULL;


--
-- Name: lancamento_financeiro lancamento_financeiro_plano_contas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamento_financeiro
    ADD CONSTRAINT lancamento_financeiro_plano_contas_id_fkey FOREIGN KEY (plano_contas_id) REFERENCES public.plano_contas(id) ON DELETE RESTRICT;


--
-- Name: pacientes pacientes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: parametros parametros_plano_contas_padrao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros
    ADD CONSTRAINT parametros_plano_contas_padrao_id_fkey FOREIGN KEY (plano_contas_padrao_id) REFERENCES public.plano_contas(id) ON DELETE SET NULL;


--
-- Name: parametros parametros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros
    ADD CONSTRAINT parametros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payables payables_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_accounts(id) ON DELETE SET NULL;


--
-- Name: plano_contas plano_contas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plano_contas
    ADD CONSTRAINT plano_contas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: plans plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: receivables receivables_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_accounts(id) ON DELETE SET NULL;


--
-- Name: receivables receivables_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: receivables receivables_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: services services_plano_contas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_plano_contas_id_fkey FOREIGN KEY (plano_contas_id) REFERENCES public.plano_contas(id) ON DELETE SET NULL;


--
-- Name: appointments allow_public_insert_appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_insert_appointments ON public.appointments FOR INSERT TO anon WITH CHECK (true);


--
-- Name: appointments allow_public_read_appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_read_appointments ON public.appointments FOR SELECT TO anon USING (true);


--
-- Name: business_hours allow_public_read_hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_read_hours ON public.business_hours FOR SELECT TO anon USING (true);


--
-- Name: services allow_public_read_services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_public_read_services ON public.services FOR SELECT TO anon USING ((active = true));


--
-- Name: anexo_financeiro anexo delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anexo delete" ON public.anexo_financeiro FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: anexo_financeiro anexo insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anexo insert" ON public.anexo_financeiro FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: anexo_financeiro anexo read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anexo read" ON public.anexo_financeiro FOR SELECT TO authenticated USING (true);


--
-- Name: anexo_financeiro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anexo_financeiro ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: arquivos_paciente arquivos_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY arquivos_owner ON public.arquivos_paciente USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: arquivos_paciente; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.arquivos_paciente ENABLE ROW LEVEL SECURITY;

--
-- Name: business_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: chart_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chart_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: fichas_anamnese; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fichas_anamnese ENABLE ROW LEVEL SECURITY;

--
-- Name: fichas_anamnese fichas_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fichas_owner ON public.fichas_anamnese USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: lancamento_financeiro lancamento delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lancamento delete" ON public.lancamento_financeiro FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: lancamento_financeiro lancamento insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lancamento insert" ON public.lancamento_financeiro FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: lancamento_financeiro lancamento read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lancamento read" ON public.lancamento_financeiro FOR SELECT TO authenticated USING (true);


--
-- Name: lancamento_financeiro lancamento update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lancamento update" ON public.lancamento_financeiro FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: lancamento_financeiro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamento_financeiro ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles own profile insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles own profile select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles own profile update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: pacientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

--
-- Name: pacientes pacientes_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pacientes_owner ON public.pacientes USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: parametros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: payables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_contas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_contas plano_contas delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plano_contas delete" ON public.plano_contas FOR DELETE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: plano_contas plano_contas insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plano_contas insert" ON public.plano_contas FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: plano_contas plano_contas read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plano_contas read" ON public.plano_contas FOR SELECT TO authenticated USING (true);


--
-- Name: plano_contas plano_contas update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plano_contas update" ON public.plano_contas FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: receivables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.profiles TO service_role USING (true) WITH CHECK (true);


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: business_hours users delete own business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own business hours" ON public.business_hours FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: business_hours users insert own business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own business hours" ON public.business_hours FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: appointments users manage own appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own appointments" ON public.appointments TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: categories users manage own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own categories" ON public.categories TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chart_accounts users manage own chart accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own chart accounts" ON public.chart_accounts TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: clinic_settings users manage own clinic settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own clinic settings" ON public.clinic_settings TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: parametros users manage own parametros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own parametros" ON public.parametros TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: payables users manage own payables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own payables" ON public.payables TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: plans users manage own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own plans" ON public.plans TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: receivables users manage own receivables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own receivables" ON public.receivables TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: services users manage own services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users manage own services" ON public.services TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: business_hours users update own business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own business hours" ON public.business_hours FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: business_hours users view own business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own business hours" ON public.business_hours FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: whatsapp_lembrete_enviado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_lembrete_enviado ENABLE ROW LEVEL SECURITY;

--
-- Name: FUNCTION buscar_sessoes_para_lembrete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.buscar_sessoes_para_lembrete() TO anon;
GRANT ALL ON FUNCTION public.buscar_sessoes_para_lembrete() TO authenticated;
GRANT ALL ON FUNCTION public.buscar_sessoes_para_lembrete() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE anexo_financeiro; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anexo_financeiro TO anon;
GRANT ALL ON TABLE public.anexo_financeiro TO authenticated;
GRANT ALL ON TABLE public.anexo_financeiro TO service_role;


--
-- Name: TABLE appointments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.appointments TO anon;
GRANT ALL ON TABLE public.appointments TO authenticated;
GRANT ALL ON TABLE public.appointments TO service_role;


--
-- Name: TABLE arquivos_paciente; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.arquivos_paciente TO anon;
GRANT ALL ON TABLE public.arquivos_paciente TO authenticated;
GRANT ALL ON TABLE public.arquivos_paciente TO service_role;


--
-- Name: TABLE business_hours; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.business_hours TO anon;
GRANT ALL ON TABLE public.business_hours TO authenticated;
GRANT ALL ON TABLE public.business_hours TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE chart_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chart_accounts TO anon;
GRANT ALL ON TABLE public.chart_accounts TO authenticated;
GRANT ALL ON TABLE public.chart_accounts TO service_role;


--
-- Name: TABLE clinic_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clinic_settings TO anon;
GRANT ALL ON TABLE public.clinic_settings TO authenticated;
GRANT ALL ON TABLE public.clinic_settings TO service_role;


--
-- Name: TABLE fichas_anamnese; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fichas_anamnese TO anon;
GRANT ALL ON TABLE public.fichas_anamnese TO authenticated;
GRANT ALL ON TABLE public.fichas_anamnese TO service_role;


--
-- Name: TABLE lancamento_financeiro; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lancamento_financeiro TO anon;
GRANT ALL ON TABLE public.lancamento_financeiro TO authenticated;
GRANT ALL ON TABLE public.lancamento_financeiro TO service_role;


--
-- Name: TABLE pacientes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pacientes TO anon;
GRANT ALL ON TABLE public.pacientes TO authenticated;
GRANT ALL ON TABLE public.pacientes TO service_role;


--
-- Name: TABLE parametros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parametros TO anon;
GRANT ALL ON TABLE public.parametros TO authenticated;
GRANT ALL ON TABLE public.parametros TO service_role;


--
-- Name: TABLE payables; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payables TO anon;
GRANT ALL ON TABLE public.payables TO authenticated;
GRANT ALL ON TABLE public.payables TO service_role;


--
-- Name: TABLE plano_contas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plano_contas TO anon;
GRANT ALL ON TABLE public.plano_contas TO authenticated;
GRANT ALL ON TABLE public.plano_contas TO service_role;


--
-- Name: TABLE plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plans TO anon;
GRANT ALL ON TABLE public.plans TO authenticated;
GRANT ALL ON TABLE public.plans TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE receivables; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.receivables TO anon;
GRANT ALL ON TABLE public.receivables TO authenticated;
GRANT ALL ON TABLE public.receivables TO service_role;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;


--
-- Name: TABLE whatsapp_lembrete_enviado; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_lembrete_enviado TO anon;
GRANT ALL ON TABLE public.whatsapp_lembrete_enviado TO authenticated;
GRANT ALL ON TABLE public.whatsapp_lembrete_enviado TO service_role;


--
-- Name: TABLE whatsapp_sessao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_sessao TO anon;
GRANT ALL ON TABLE public.whatsapp_sessao TO authenticated;
GRANT ALL ON TABLE public.whatsapp_sessao TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--



--
-- Trigger em auth.users (fora do schema public, precisa ser recriado manualmente
-- pois "pg_restore -n public" nao inclui objetos de outros schemas).
-- Cria automaticamente uma linha em public.profiles para cada novo usuario.
--

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
