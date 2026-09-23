Sistema G-Clin — G-Tech (versão sem VPS)

1. O que é isto

Esta pasta é uma réplica do sistema de gestão de clínica **G-Clin** (originalmente hospedado numa VPS — veja `C:/dev/G-ClinVPS-main`), adaptada para rodar **sem servidor próprio (VPS)**:

- Banco/Auth/Storage: **Supabase** — local via Docker em desenvolvimento, e **Supabase Cloud** (hospedado pela Supabase) em produção, em vez de uma instalação self-hosted numa VPS.
- App (frontend/SSR): mesmo código React 19 + TanStack Start/Router + Vite + TailwindCSS 4 + shadcn/ui, pronto para deploy em **Cloudflare Workers** (`wrangler.jsonc` já presente) ou qualquer outro host serverless/estático compatível — a decidir depois.
- Automação de WhatsApp (n8n + Evolution API): **removida nesta versão**. O envio de mensagens continua existindo na tela de agendamentos (Dashboard), mas via link `wa.me` (abre o WhatsApp Web/app manualmente) em vez de uma chamada automática a uma Evolution API — isso eliminava tanto a dependência de VPS quanto uma API key que estava hardcoded no código-fonte do app original (`dashboard.tsx`).
- Proxy/Nginx Proxy Manager: **não se aplica** — não há servidor próprio para expor com HTTPS manual; Cloudflare/Supabase Cloud cuidam disso.

2. Stack

| Camada | Antes (VPS) | Agora (sem VPS) |
|---|---|---|
| App | Bun/Docker numa VPS | Local (npm/vite) → deploy futuro em Cloudflare Workers |
| Banco/Auth | Supabase self-hosted (Docker na VPS) | Supabase CLI local (Docker, só em dev) → Supabase Cloud (produção) |
| WhatsApp | n8n + Evolution API (Docker na VPS) | Removido — link `wa.me` manual |
| HTTPS/Proxy | Nginx Proxy Manager | Cloudflare / Supabase Cloud (nativo) |

3. Estrutura da pasta

```
g-clin-gtech/
├── src/                        → código do app (rotas, componentes, lib, integrações Supabase)
├── supabase/
│   ├── config.toml              → config do Supabase CLI para rodar local via Docker
│   ├── migrations/              → UMA migration consolidada (schema real de produção — ver seção 4.1)
│   └── migrations_legacy/       → migrations originais do repo VPS, mantidas só como histórico (não são aplicadas)
├── prontuario/                  → modelo de prontuário clínico (Word)
├── public/                      → arquivos estáticos
├── package.json / package-lock.json / bun.lock
├── vite.config.ts
├── wrangler.jsonc                → config para deploy em Cloudflare Workers (preencher depois)
├── Dockerfile / server-node.mjs  → alternativa para rodar o app em container, se necessário
├── .env                          → variáveis de ambiente (aponta para o Supabase local por padrão)
└── .env.example
```

Não foram copiados: `automacao/`, `automacao-gclin/` (n8n/Evolution), `supabase-project/` (stack self-hosted) e `proxy/` (Nginx Proxy Manager) — tudo específico da VPS antiga. Também não foram copiados os `.dump` de backup do banco antigo (dados de pacientes da clínica original + credenciais antigas expostas em texto puro) — só o **schema** (estrutura de tabelas) foi extraído deles, sem nenhum dado de paciente.

4.1 Sobre a migration consolidada

As migrations originais em `supabase/migrations/` do projeto VPS estavam **incompletas**: faltavam várias tabelas realmente usadas em produção (`pacientes`, `lancamento_financeiro`, `plano_contas`, `fichas_anamnese`, `clinic_settings`, `profiles`, `whatsapp_sessao`, etc. — provavelmente criadas direto no Supabase Studio, sem gerar migration). Rodar as migrations originais falhava.

Por isso, esta versão usa uma **migration única** (`20260508000000_baseline_schema.sql`) gerada a partir do schema real do `backup_gclin.dump` (backup de produção, só estrutura — sem dados/pacientes), que é a fonte mais confiável do estado atual do sistema. Ela já foi testada com `supabase db reset` e sobe sem erros.

4. Rodando localmente

Pré-requisitos: **Node.js + npm** (ou Bun — ver observação abaixo), **Docker Desktop** (aberto e rodando).

```bash
npm install

# Sobe Postgres + Auth + Storage + Studio localmente via Docker (primeira vez baixa as imagens, demora alguns minutos)
npm run db:start

# Em outro terminal, sobe o app
npm run dev
```

> **Nota (Windows + Bun):** `bun install` neste projeto pode falhar com `ERR_MODULE_NOT_FOUND` em dependências aninhadas (`fdir`, `@jridgewell/remapping` dentro de `@tailwindcss/vite`) — parece um bug do instalador do Bun com hardlinks/paths aninhados no Windows. `npm install` funciona normalmente e foi o que validamos. Os scripts (`db:start` etc.) funcionam com `npm run <script>` ou `bunx --bun <script>` depois de instalar com npm.

Depois de `npm run db:start`, o comando mostra no terminal a URL e as chaves locais (API URL, anon key, service role key, Studio URL) **específicas deste projeto** (nome `g-clin-gtech`). Elas já estão preenchidas em `.env`. Se você recriar o ambiente do zero (`db:reset` ou reinstalar o Docker), as chaves são as mesmas enquanto o `project_id` em `supabase/config.toml` não mudar — mas se algum dia vier diferente, copie os novos valores de `ANON_KEY`/`SERVICE_ROLE_KEY` do terminal para o `.env`.

- App: a porta é escolhida pelo Vite a partir de 8080 (se estiver ocupada, ele tenta a próxima — observe a URL impressa no terminal).
- Supabase Studio (painel do banco, local): http://127.0.0.1:54323
- API REST/Auth local: http://127.0.0.1:54321

Para reaplicar as migrations do zero (apaga dados locais):

```bash
npm run db:reset
```

Para parar os containers:

```bash
npm run db:stop
```

5. Primeiro acesso

1. Com `db:start` e `dev` rodando, acesse o app e crie o usuário administrador pela tela de login/cadastro (ou pelo Supabase Studio local → Authentication → Add user).
2. Copie o UUID desse usuário (Studio → Authentication → Users) e cole em `VITE_CLINIC_USER_ID` no `.env` — é o usuário "dono" da agenda pública (rota `/agendar`).
3. Preencha `public.clinic_settings` para esse usuário (nome da clínica, WhatsApp, horários) — pode ser feito pela tela de configurações do app ou direto no Studio.
4. Reinicie `npm run dev` para carregar a variável de ambiente.

6. Indo para produção (quando decidir)

Banco (Supabase Cloud):
1. Criar um projeto em https://supabase.com/dashboard.
2. Rodar as migrations: `npx supabase link --project-ref <ref-do-projeto>` e depois `npx supabase db push`.
3. Trocar as variáveis do `.env` (ou das secrets do host de deploy) pelas chaves reais do projeto (Project Settings → API) — **nunca** commitar essas chaves.

App (Cloudflare Workers, já preparado em `wrangler.jsonc`):
1. Preencher `vars.VITE_SUPABASE_URL` e `vars.VITE_SUPABASE_PUBLISHABLE_KEY` no `wrangler.jsonc` com os valores do Supabase Cloud (só valores públicos — a chave `service_role` nunca vai para variáveis client-side/`vars`; use `wrangler secret put` se precisar dela no server).
2. `npm run build`
3. `npx wrangler deploy`

Automação de WhatsApp: se quiser reintroduzir depois, considere uma alternativa sem VPS (ex: n8n Cloud, ou um número comercial oficial via WhatsApp Cloud API da Meta) em vez de reativar Evolution API — evita reabrir a dependência de servidor próprio e API keys expostas no frontend.

7. Segurança

- `.env` está no `.gitignore` — não versionar chaves reais.
- `vite.config.ts` original tinha a URL/anon key da clínica antiga hardcoded via `define`, o que sobrescrevia o `.env` silenciosamente em build/dev — isso foi removido nesta versão; a configuração agora vem só do `.env`.
- Ao configurar o Supabase Cloud, ative RLS (já vem da migration) e nunca use a `service_role key` no código client-side.
- Personalize marca/identidade (logo em `src/assets/`, nome da clínica em `src/routes/`) antes de publicar para o cliente final.
