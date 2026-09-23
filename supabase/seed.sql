-- =====================================================================
-- SEED DE DEMONSTRAÇÃO — G-Tech
-- =====================================================================
-- Popula o banco com uma clínica fictícia completa (usuários, agenda,
-- pacientes, prontuários, financeiro) para você testar o sistema com
-- dados realistas antes de entrar com os dados reais da clínica.
--
-- Local:  roda automaticamente em `supabase db reset`.
-- Remoto: `supabase db push --include-seed` (ou `supabase db execute
--         --linked -f supabase/seed.sql` para rodar só o seed).
--
-- Login:
--   admin@germano.com           -> OWNER  (Dra. Camila Ferraz, acesso total), senha Admin@123
--   recepcao@gtech-demo.com.br  -> MANAGER (Fernanda Souza, recepção), senha Demo@12345
--
-- Depois de rodar, copie o id do OWNER para VITE_CLINIC_USER_ID no .env:
--   a1111111-1111-4111-8111-111111111111
-- (Já vem preenchido se você usou o valor sugerido na resposta do chat.)
--
-- ATENÇÃO: idempotente apenas via `db reset` (que já limpa o banco antes).
-- Rodar este arquivo duas vezes num banco que já tem esses dados vai
-- falhar por violação de chave primária/única — não é destinado a rodar
-- repetidamente sobre uma base com dados reais.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- 1. Usuários (auth.users + auth.identities)
-- O trigger on_auth_user_created cria a linha em public.profiles
-- automaticamente a partir de raw_user_meta_data (full_name / role).
-- ---------------------------------------------------------------------

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'admin@germano.com',
   extensions.crypt('Admin@123', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Dra. Camila Ferraz","role":"OWNER"}',
   false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'recepcao@gtech-demo.com.br',
   extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Fernanda Souza","role":"MANAGER"}',
   false, now(), now());

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111',
   jsonb_build_object('sub', 'a1111111-1111-4111-8111-111111111111', 'email', 'admin@germano.com', 'email_verified', true),
   'email', now(), now(), now()),
  (gen_random_uuid(), 'a2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222',
   jsonb_build_object('sub', 'a2222222-2222-4222-8222-222222222222', 'email', 'recepcao@gtech-demo.com.br', 'email_verified', true),
   'email', now(), now(), now());

-- cargo/modulos não vêm do trigger — completa os perfis já criados.
UPDATE public.profiles SET
  cargo = 'Diretora Clínica',
  modulos = ARRAY['agendamentos','servicos','pacientes','financeiro','usuarios','configuracoes']
WHERE id = 'a1111111-1111-4111-8111-111111111111';

UPDATE public.profiles SET
  cargo = 'Recepcionista',
  modulos = ARRAY['agendamentos','pacientes','financeiro']
WHERE id = 'a2222222-2222-4222-8222-222222222222';

-- ---------------------------------------------------------------------
-- 2. Configurações da clínica e agenda
-- ---------------------------------------------------------------------

INSERT INTO public.clinic_settings (user_id, clinic_name, whatsapp_number, cnpj, contact_email, evaluation_fee, opening_hour, closing_hour)
VALUES ('a1111111-1111-4111-8111-111111111111', 'G-Tech Estética Avançada', '5511998765432', '12.345.678/0001-90', 'contato@gtech-demo.com.br', 150.00, '08:00', '18:00');

INSERT INTO public.business_hours (user_id, weekday, is_open, open_time, close_time, break_start, break_end) VALUES
  ('a1111111-1111-4111-8111-111111111111', 0, false, '08:00', '18:00', NULL, NULL),
  ('a1111111-1111-4111-8111-111111111111', 1, true,  '08:00', '18:00', '12:00', '13:00'),
  ('a1111111-1111-4111-8111-111111111111', 2, true,  '08:00', '18:00', '12:00', '13:00'),
  ('a1111111-1111-4111-8111-111111111111', 3, true,  '08:00', '18:00', '12:00', '13:00'),
  ('a1111111-1111-4111-8111-111111111111', 4, true,  '08:00', '18:00', '12:00', '13:00'),
  ('a1111111-1111-4111-8111-111111111111', 5, true,  '08:00', '18:00', '12:00', '13:00'),
  ('a1111111-1111-4111-8111-111111111111', 6, true,  '08:00', '12:00', NULL, NULL);

INSERT INTO public.blocked_slots (id, user_id, date, start_time, end_time, reason) VALUES
  ('60000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', (current_date + interval '1 day')::date, '12:00', '13:30', 'Reunião de equipe'),
  ('60000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', (current_date + interval '6 days')::date, '08:00', '18:00', 'Feriado / folga');

-- ---------------------------------------------------------------------
-- 3. Categorias e planos (listas livres usadas em pacientes/convênios)
-- ---------------------------------------------------------------------

INSERT INTO public.categories (id, user_id, name) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Facial'),
  ('d0000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Corporal'),
  ('d0000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111', 'Capilar'),
  ('d0000000-0000-4000-8000-000000000004', 'a1111111-1111-4111-8111-111111111111', 'Pós-operatório');

INSERT INTO public.plans (id, user_id, name) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Particular'),
  ('e0000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Convênio Bradesco Saúde'),
  ('e0000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111', 'Convênio Amil');

-- ---------------------------------------------------------------------
-- 4. Plano de contas + parâmetro padrão
-- ---------------------------------------------------------------------

INSERT INTO public.plano_contas (id, tipo, nome, ativo, created_by) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'RECEITA', 'Receita de Serviços Estéticos', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f1000000-0000-4000-8000-000000000002', 'RECEITA', 'Receita de Vendas de Produtos', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f2000000-0000-4000-8000-000000000001', 'DESPESA', 'Aluguel e Condomínio', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f2000000-0000-4000-8000-000000000002', 'DESPESA', 'Folha de Pagamento', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f2000000-0000-4000-8000-000000000003', 'DESPESA', 'Produtos e Insumos', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f2000000-0000-4000-8000-000000000004', 'DESPESA', 'Marketing e Publicidade', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f2000000-0000-4000-8000-000000000005', 'DESPESA', 'Água, Luz e Internet', true, 'a1111111-1111-4111-8111-111111111111'),
  ('f2000000-0000-4000-8000-000000000006', 'DESPESA', 'Equipamentos', true, 'a1111111-1111-4111-8111-111111111111');

INSERT INTO public.parametros (user_id, plano_contas_padrao_id)
VALUES ('a1111111-1111-4111-8111-111111111111', 'f1000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- 5. Serviços
-- ---------------------------------------------------------------------

-- category_group precisa ser um destes valores exatos (é o que a tela de
-- Serviços usa para agrupar): sobrancelhas | micropigmentacao | depilacao |
-- facial | hof | outros.
INSERT INTO public.services (id, user_id, name, description, price, cost, duration_minutes, active, is_hof, category_group, plano_contas_id) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Limpeza de Pele Profunda', 'Higienização, extração e máscara calmante', 180.00, 60.00, 60, true, false, 'facial', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Peeling Químico', 'Renovação celular com ácidos', 250.00, 80.00, 45, true, false, 'facial', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111', 'Botox - Terço Superior', 'Toxina botulínica - testa, glabela e pés de galinha', 900.00, 300.00, 40, true, true, 'hof', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000004', 'a1111111-1111-4111-8111-111111111111', 'Preenchimento Labial', 'Ácido hialurônico - 1ml', 1200.00, 450.00, 50, true, true, 'hof', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000005', 'a1111111-1111-4111-8111-111111111111', 'Drenagem Linfática Corporal', 'Sessão de 50 minutos, corpo inteiro', 150.00, 40.00, 50, true, false, 'outros', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000006', 'a1111111-1111-4111-8111-111111111111', 'Massagem Modeladora', 'Sessão de 60 minutos', 160.00, 40.00, 60, true, false, 'outros', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000007', 'a1111111-1111-4111-8111-111111111111', 'Depilação a Laser - Axilas', 'Sessão avulsa', 120.00, 30.00, 20, true, false, 'depilacao', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000008', 'a1111111-1111-4111-8111-111111111111', 'Depilação a Laser - Pernas Completas', 'Sessão avulsa', 350.00, 90.00, 60, true, false, 'depilacao', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000009', 'a1111111-1111-4111-8111-111111111111', 'Microagulhamento Facial', 'Estímulo de colágeno com dermaroller', 300.00, 90.00, 60, true, false, 'facial', 'f1000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-111111111111', 'Avaliação Estética Inicial', 'Consulta de avaliação para novas pacientes', 150.00, 0.00, 30, true, false, 'outros', 'f1000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- 6. Pacientes
-- ---------------------------------------------------------------------

INSERT INTO public.pacientes (id, user_id, nome, data_nasc, cpf, telefone, email, endereco, bairro, cidade, estado, cep, profissao, estado_civil) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Juliana Alves Ribeiro', '1990-04-12', '123.456.789-01', '(11) 91234-5678', 'juliana.ribeiro@example.com', 'Rua das Acácias, 245', 'Vila Mariana', 'São Paulo', 'SP', '04101-000', 'Advogada', 'Casada'),
  ('b0000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Mariana Costa Lima', '1985-11-03', '234.567.890-12', '(11) 98765-4321', 'mariana.lima@example.com', 'Rua Girassol, 88', 'Pinheiros', 'São Paulo', 'SP', '05433-000', 'Designer', 'Solteira'),
  ('b0000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111', 'Beatriz Fernandes Souza', '1998-02-27', '345.678.901-23', '(11) 97654-3210', 'bia.souza@example.com', 'Av. Paulista, 1500 - apto 92', 'Bela Vista', 'São Paulo', 'SP', '01310-200', 'Estudante', 'Solteira'),
  ('b0000000-0000-4000-8000-000000000004', 'a1111111-1111-4111-8111-111111111111', 'Patrícia Gomes Silva', '1979-07-19', '456.789.012-34', '(11) 96543-2109', 'patricia.silva@example.com', 'Rua dos Lírios, 12', 'Moema', 'São Paulo', 'SP', '04077-020', 'Empresária', 'Casada'),
  ('b0000000-0000-4000-8000-000000000005', 'a1111111-1111-4111-8111-111111111111', 'Camila Rodrigues Martins', '1993-09-30', '567.890.123-45', '(11) 95432-1098', 'camila.martins@example.com', 'Rua Tabapuã, 300', 'Itaim Bibi', 'São Paulo', 'SP', '04533-000', 'Fisioterapeuta', 'Solteira'),
  ('b0000000-0000-4000-8000-000000000006', 'a1111111-1111-4111-8111-111111111111', 'Fernanda Oliveira Santos', '1988-01-15', '678.901.234-56', '(11) 94321-0987', 'fernanda.santos@example.com', 'Rua Harmonia, 77', 'Vila Madalena', 'São Paulo', 'SP', '05435-000', 'Professora', 'Divorciada'),
  ('b0000000-0000-4000-8000-000000000007', 'a1111111-1111-4111-8111-111111111111', 'Renata Almeida Cardoso', '1975-05-22', '789.012.345-67', '(11) 93210-9876', 'renata.cardoso@example.com', 'Rua Amauri, 220', 'Jardim Europa', 'São Paulo', 'SP', '01448-000', 'Médica', 'Casada'),
  ('b0000000-0000-4000-8000-000000000008', 'a1111111-1111-4111-8111-111111111111', 'Larissa Pereira Nunes', '2000-12-08', '890.123.456-78', '(11) 92109-8765', 'larissa.nunes@example.com', 'Rua Oscar Freire, 555', 'Jardins', 'São Paulo', 'SP', '01426-001', 'Estudante', 'Solteira'),
  ('b0000000-0000-4000-8000-000000000009', 'a1111111-1111-4111-8111-111111111111', 'Isabela Carvalho Dias', '1996-03-17', '901.234.567-89', '(11) 91098-7654', 'isabela.dias@example.com', 'Rua Cardeal Arcoverde, 900', 'Pinheiros', 'São Paulo', 'SP', '05407-003', 'Nutricionista', 'Solteira'),
  ('b0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-111111111111', 'Débora Martins Rocha', '1982-08-25', '012.345.678-90', '(11) 90987-6543', 'debora.rocha@example.com', 'Rua Joaquim Antunes, 45', 'Pinheiros', 'São Paulo', 'SP', '05415-010', 'Arquiteta', 'Casada');

-- ---------------------------------------------------------------------
-- 7. Fichas de anamnese (prontuário) — 4 pacientes, 2 já assinadas
-- ---------------------------------------------------------------------

INSERT INTO public.fichas_anamnese (
  id, paciente_id, user_id, data_avaliacao, queixa, duracao_queixa,
  trat_estetico_anterior, usa_lente_contato, usa_cosmeticos, exposicao_sol, filtro_solar,
  tabagismo, alcool, atividade_fisica, atividade_fisica_tipo, atividade_fisica_frequencia,
  gestante, tratamento_medico_atual, antecedentes_alergicos, alergia_anestesico,
  autorizado, autoriza_imagem, data_assinatura, assinado_em, assinatura_imagem,
  nome_paciente, idade_paciente, celular_paciente, cpf_paciente, profissao_paciente, estado_civil_paciente
) VALUES
  ('80000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111',
   current_date - interval '20 days', 'Flacidez e manchas no rosto', '6 meses',
   false, false, true, true, true,
   false, true, true, 'Pilates', '3x por semana',
   false, false, false, false,
   true, true, current_date - interval '20 days', (current_date - interval '20 days')::timestamptz,
   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
   'Juliana Alves Ribeiro', '35', '(11) 91234-5678', '123.456.789-01', 'Advogada', 'Casada'),
  ('80000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111',
   current_date - interval '18 days', 'Rugas de expressão na testa e glabela', '1 ano',
   true, false, true, false, true,
   false, false, true, 'Corrida', '2x por semana',
   false, false, true, false,
   true, true, current_date - interval '18 days', (current_date - interval '18 days')::timestamptz,
   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
   'Mariana Costa Lima', '40', '(11) 98765-4321', '234.567.890-12', 'Designer', 'Solteira'),
  ('80000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111',
   current_date - interval '15 days', 'Avaliação inicial, sem queixa específica', NULL,
   false, true, true, true, false,
   false, false, false, NULL, NULL,
   false, false, false, false,
   false, false, NULL, NULL, NULL,
   'Beatriz Fernandes Souza', '28', '(11) 97654-3210', '345.678.901-23', 'Estudante', 'Solteira'),
  ('80000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000009', 'a1111111-1111-4111-8111-111111111111',
   current_date - interval '1 day', 'Assimetria labial, deseja volume natural', '3 meses',
   false, false, true, false, true,
   false, true, true, 'Yoga', '1x por semana',
   false, false, false, false,
   false, false, NULL, NULL, NULL,
   'Isabela Carvalho Dias', '30', '(11) 91098-7654', '901.234.567-89', 'Nutricionista', 'Solteira');

-- ---------------------------------------------------------------------
-- 8. Agendamentos (passados concluídos/cancelados/falta + futuros)
-- ---------------------------------------------------------------------

-- Nota: `current_date - N` (inteiro) devolve `date`; combinado com `+ time`
-- vira `timestamp`, que é atribuído a `scheduled_at` (timestamptz) via cast
-- implícito no fuso da sessão. `date - interval` devolveria `timestamp`, que
-- não aceita `+ time` (sem esse operador) — por isso o inteiro, não interval.
INSERT INTO public.appointments (id, user_id, client_name, phone, service_id, service_name, type, scheduled_at, status, notes, wants_to_anticipate, extra_charge) VALUES
  ('90000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Juliana Alves Ribeiro', '(11) 91234-5678', 'c0000000-0000-4000-8000-000000000001', 'Limpeza de Pele Profunda', 'procedimento', current_date - 20 + time '10:00', 'concluido', NULL, false, false),
  ('90000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Mariana Costa Lima', '(11) 98765-4321', 'c0000000-0000-4000-8000-000000000003', 'Botox - Terço Superior', 'procedimento', current_date - 18 + time '14:00', 'concluido', NULL, false, false),
  ('90000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111', 'Beatriz Fernandes Souza', '(11) 97654-3210', 'c0000000-0000-4000-8000-00000000000a', 'Avaliação Estética Inicial', 'avaliacao', current_date - 15 + time '09:00', 'concluido', 'Primeira consulta', false, false),
  ('90000000-0000-4000-8000-000000000004', 'a1111111-1111-4111-8111-111111111111', 'Patrícia Gomes Silva', '(11) 96543-2109', 'c0000000-0000-4000-8000-000000000002', 'Peeling Químico', 'procedimento', current_date - 12 + time '11:00', 'falta', 'Não compareceu, não avisou', false, false),
  ('90000000-0000-4000-8000-000000000005', 'a1111111-1111-4111-8111-111111111111', 'Camila Rodrigues Martins', '(11) 95432-1098', 'c0000000-0000-4000-8000-000000000005', 'Drenagem Linfática Corporal', 'procedimento', current_date - 10 + time '15:00', 'concluido', NULL, false, false),
  ('90000000-0000-4000-8000-000000000006', 'a1111111-1111-4111-8111-111111111111', 'Fernanda Oliveira Santos', '(11) 94321-0987', 'c0000000-0000-4000-8000-000000000008', 'Depilação a Laser - Pernas Completas', 'procedimento', current_date - 8 + time '13:00', 'cancelado', 'Paciente remarcou para o mês seguinte', false, false),
  ('90000000-0000-4000-8000-000000000007', 'a1111111-1111-4111-8111-111111111111', 'Renata Almeida Cardoso', '(11) 93210-9876', 'c0000000-0000-4000-8000-000000000009', 'Microagulhamento Facial', 'procedimento', current_date - 5 + time '10:30', 'concluido', NULL, false, false),
  ('90000000-0000-4000-8000-000000000008', 'a1111111-1111-4111-8111-111111111111', 'Larissa Pereira Nunes', '(11) 92109-8765', 'c0000000-0000-4000-8000-000000000006', 'Massagem Modeladora', 'retorno', current_date - 3 + time '16:00', 'concluido', NULL, false, false),
  ('90000000-0000-4000-8000-000000000009', 'a1111111-1111-4111-8111-111111111111', 'Isabela Carvalho Dias', '(11) 91098-7654', 'c0000000-0000-4000-8000-000000000004', 'Preenchimento Labial + Botox - Terço Superior', 'procedimento', current_date - 1 + time '11:00', 'concluido', 'Combo preenchimento + botox', false, true),
  ('90000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-111111111111', 'Débora Martins Rocha', '(11) 90987-6543', 'c0000000-0000-4000-8000-000000000001', 'Limpeza de Pele Profunda', 'procedimento', current_date + time '09:00', 'confirmado', NULL, false, false),
  ('90000000-0000-4000-8000-00000000000b', 'a1111111-1111-4111-8111-111111111111', 'Juliana Alves Ribeiro', '(11) 91234-5678', 'c0000000-0000-4000-8000-000000000007', 'Depilação a Laser - Axilas', 'procedimento', current_date + 2 + time '10:00', 'agendado', NULL, false, false),
  ('90000000-0000-4000-8000-00000000000c', 'a1111111-1111-4111-8111-111111111111', 'Mariana Costa Lima', '(11) 98765-4321', 'c0000000-0000-4000-8000-000000000009', 'Microagulhamento Facial', 'procedimento', current_date + 4 + time '14:00', 'agendado', NULL, false, false),
  ('90000000-0000-4000-8000-00000000000d', 'a1111111-1111-4111-8111-111111111111', 'Beatriz Fernandes Souza', '(11) 97654-3210', 'c0000000-0000-4000-8000-000000000002', 'Peeling Químico', 'retorno', current_date + 7 + time '09:30', 'agendado', NULL, true, false),
  ('90000000-0000-4000-8000-00000000000e', 'a1111111-1111-4111-8111-111111111111', 'Camila Rodrigues Martins', '(11) 95432-1098', 'c0000000-0000-4000-8000-000000000003', 'Botox - Terço Superior', 'encaixe', current_date + 10 + time '15:00', 'pendente_pagamento', 'Encaixe de última hora', false, false);

-- Itens de serviço por agendamento (espelha appointments.service_id; o
-- agendamento 0009 tem dois serviços para demonstrar o combo).
INSERT INTO public.appointment_services (appointment_id, service_id, service_name, price, cost, duration_minutes, is_hof) VALUES
  ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Limpeza de Pele Profunda', 180.00, 60.00, 60, false),
  ('90000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'Botox - Terço Superior', 900.00, 300.00, 40, true),
  ('90000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-00000000000a', 'Avaliação Estética Inicial', 150.00, 0.00, 30, false),
  ('90000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Peeling Químico', 250.00, 80.00, 45, false),
  ('90000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'Drenagem Linfática Corporal', 150.00, 40.00, 50, false),
  ('90000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000008', 'Depilação a Laser - Pernas Completas', 350.00, 90.00, 60, false),
  ('90000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000009', 'Microagulhamento Facial', 300.00, 90.00, 60, false),
  ('90000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000006', 'Massagem Modeladora', 160.00, 40.00, 60, false),
  ('90000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000004', 'Preenchimento Labial', 1200.00, 450.00, 50, true),
  ('90000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000003', 'Botox - Terço Superior', 900.00, 300.00, 40, true),
  ('90000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000001', 'Limpeza de Pele Profunda', 180.00, 60.00, 60, false),
  ('90000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000007', 'Depilação a Laser - Axilas', 120.00, 30.00, 20, false),
  ('90000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-000000000009', 'Microagulhamento Facial', 300.00, 90.00, 60, false),
  ('90000000-0000-4000-8000-00000000000d', 'c0000000-0000-4000-8000-000000000002', 'Peeling Químico', 250.00, 80.00, 45, false),
  ('90000000-0000-4000-8000-00000000000e', 'c0000000-0000-4000-8000-000000000003', 'Botox - Terço Superior', 900.00, 300.00, 40, true);

-- ---------------------------------------------------------------------
-- 9. Financeiro — receitas ligadas aos atendimentos concluídos + despesas
-- ---------------------------------------------------------------------

INSERT INTO public.lancamento_financeiro (id, tipo, descricao, beneficiario, valor, dt_vencimento, dt_pagamento, status, forma_pagamento, plano_contas_id, appointment_id, created_by) VALUES
  ('70000000-0000-4000-8000-000000000001', 'RECEITA', 'Limpeza de Pele Profunda - Juliana Alves Ribeiro', 'Juliana Alves Ribeiro', 180.00, current_date - interval '20 days', current_date - interval '20 days', 'PAGO', 'PIX', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000002', 'RECEITA', 'Botox - Terço Superior - Mariana Costa Lima', 'Mariana Costa Lima', 900.00, current_date - interval '18 days', current_date - interval '18 days', 'PAGO', 'CARTAO_CREDITO', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000003', 'RECEITA', 'Avaliação Estética Inicial - Beatriz Fernandes Souza', 'Beatriz Fernandes Souza', 150.00, current_date - interval '15 days', current_date - interval '15 days', 'PAGO', 'DINHEIRO', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000004', 'RECEITA', 'Drenagem Linfática Corporal - Camila Rodrigues Martins', 'Camila Rodrigues Martins', 150.00, current_date - interval '10 days', current_date - interval '10 days', 'PAGO', 'PIX', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000005', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000005', 'RECEITA', 'Microagulhamento Facial - Renata Almeida Cardoso', 'Renata Almeida Cardoso', 300.00, current_date - interval '5 days', current_date - interval '5 days', 'PAGO', 'CARTAO_DEBITO', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000007', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000006', 'RECEITA', 'Massagem Modeladora - Larissa Pereira Nunes', 'Larissa Pereira Nunes', 160.00, current_date - interval '3 days', current_date - interval '3 days', 'PAGO', 'PIX', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000008', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000007', 'RECEITA', 'Preenchimento Labial + Botox - Isabela Carvalho Dias', 'Isabela Carvalho Dias', 2100.00, current_date - interval '1 days', current_date - interval '1 days', 'PAGO', 'CARTAO_CREDITO', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000009', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000008', 'RECEITA', 'Botox - Terço Superior - Camila Rodrigues Martins (encaixe)', 'Camila Rodrigues Martins', 900.00, current_date + interval '10 days', NULL, 'PENDENTE', 'DINHEIRO', 'f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-00000000000e', 'a1111111-1111-4111-8111-111111111111');

INSERT INTO public.lancamento_financeiro (id, tipo, descricao, beneficiario, valor, dt_vencimento, dt_pagamento, status, forma_pagamento, plano_contas_id, created_by) VALUES
  ('70000000-0000-4000-8000-000000000009', 'DESPESA', 'Aluguel e condomínio - salão', 'Imobiliária Prime', 3500.00, date_trunc('month', current_date) + interval '4 days', date_trunc('month', current_date) + interval '4 days', 'PAGO', 'PIX', 'f2000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-00000000000a', 'DESPESA', 'Folha de pagamento - equipe', 'Equipe G-Tech', 6200.00, date_trunc('month', current_date) + interval '29 days', date_trunc('month', current_date) + interval '29 days', 'PAGO', 'PIX', 'f2000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-00000000000b', 'DESPESA', 'Reposição de insumos (ácidos, agulhas, descartáveis)', 'Distribuidora Beauty Supply', 1450.00, current_date - interval '2 days', current_date - interval '2 days', 'PAGO', 'CARTAO_CREDITO', 'f2000000-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-00000000000c', 'DESPESA', 'Campanha de Instagram Ads - setembro', 'Agência Ideia Digital', 400.00, current_date + interval '5 days', NULL, 'PENDENTE', 'PIX', 'f2000000-0000-4000-8000-000000000004', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-00000000000d', 'DESPESA', 'Conta de água, luz e internet', 'Concessionárias', 620.00, current_date - interval '6 days', NULL, 'PENDENTE', 'DINHEIRO', 'f2000000-0000-4000-8000-000000000005', 'a1111111-1111-4111-8111-111111111111');

-- Parcelamento de equipamento (radiofrequência) em 3x — demonstra
-- grupo_parcela_id / lancamento_pai_id / numero_parcelas.
INSERT INTO public.lancamento_financeiro (id, tipo, descricao, beneficiario, valor, dt_vencimento, dt_pagamento, status, forma_pagamento, recorrencia, numero_parcelas, parcela_atual, grupo_parcela_id, plano_contas_id, created_by) VALUES
  ('70000000-0000-4000-8000-00000000000e', 'DESPESA', 'Aparelho de Radiofrequência - parcela 1/3', 'MedEquip Distribuidora', 800.00, current_date - interval '25 days', current_date - interval '25 days', 'PAGO', 'CARTAO_CREDITO', 'MENSALMENTE', 3, 1, '70000000-0000-4000-8000-00000000000e', 'f2000000-0000-4000-8000-000000000006', 'a1111111-1111-4111-8111-111111111111');

INSERT INTO public.lancamento_financeiro (id, tipo, descricao, beneficiario, valor, dt_vencimento, dt_pagamento, status, forma_pagamento, recorrencia, numero_parcelas, parcela_atual, grupo_parcela_id, lancamento_pai_id, plano_contas_id, created_by) VALUES
  ('70000000-0000-4000-8000-00000000000f', 'DESPESA', 'Aparelho de Radiofrequência - parcela 2/3', 'MedEquip Distribuidora', 800.00, current_date + interval '5 days', NULL, 'PENDENTE', 'CARTAO_CREDITO', 'MENSALMENTE', 3, 2, '70000000-0000-4000-8000-00000000000e', '70000000-0000-4000-8000-00000000000e', 'f2000000-0000-4000-8000-000000000006', 'a1111111-1111-4111-8111-111111111111'),
  ('70000000-0000-4000-8000-000000000010', 'DESPESA', 'Aparelho de Radiofrequência - parcela 3/3', 'MedEquip Distribuidora', 800.00, current_date + interval '35 days', NULL, 'PENDENTE', 'CARTAO_CREDITO', 'MENSALMENTE', 3, 3, '70000000-0000-4000-8000-00000000000e', '70000000-0000-4000-8000-00000000000e', 'f2000000-0000-4000-8000-000000000006', 'a1111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------
-- 10. Arquivos (URLs de exemplo — não apontam pra arquivos reais)
-- ---------------------------------------------------------------------

INSERT INTO public.arquivos_paciente (id, paciente_id, user_id, nome, tipo, url, tamanho) VALUES
  ('50000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Foto Antes - Limpeza de Pele.jpg', 'image/jpeg', 'https://placehold.co/400x300?text=Antes', 245000),
  ('50000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Laudo Dermatológico.pdf', 'application/pdf', 'https://placehold.co/400x300?text=Laudo+PDF', 102400);

INSERT INTO public.anexo_financeiro (id, lancamento_id, nome, url, created_by) VALUES
  ('40000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000009', 'Boleto Aluguel.pdf', 'https://placehold.co/400x300?text=Boleto', 'a1111111-1111-4111-8111-111111111111');

NOTIFY pgrst, 'reload schema';
