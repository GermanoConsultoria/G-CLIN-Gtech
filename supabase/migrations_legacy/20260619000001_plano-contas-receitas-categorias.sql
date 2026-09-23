-- MELHORIA 1: Criar categorias de receita por tipo de serviço
-- Insere apenas se não existir (idempotente)
INSERT INTO public.plano_contas (tipo, nome, ativo, created_by)
SELECT 'RECEITA', nome_categoria, true,
  (SELECT id FROM auth.users LIMIT 1)
FROM (VALUES
  ('Sobrancelhas'),
  ('Micropigmentação'),
  ('Depilação'),
  ('Tratamento Facial'),
  ('HOF')
) AS t(nome_categoria)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plano_contas
  WHERE nome = t.nome_categoria AND tipo = 'RECEITA'
);

-- MELHORIA 2: Vincular serviços existentes ao plano de contas pela categoria
-- Usa CASE para mapear o valor do campo (ex: 'micropigmentacao') para o nome do plano
UPDATE public.services s
SET plano_contas_id = pc.id
FROM public.plano_contas pc
WHERE pc.tipo = 'RECEITA'
  AND s.plano_contas_id IS NULL
  AND pc.nome = CASE s.category_group
    WHEN 'sobrancelhas'     THEN 'Sobrancelhas'
    WHEN 'micropigmentacao' THEN 'Micropigmentação'
    WHEN 'depilacao'        THEN 'Depilação'
    WHEN 'facial'           THEN 'Tratamento Facial'
    WHEN 'hof'              THEN 'HOF'
    ELSE NULL
  END;
