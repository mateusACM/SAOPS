<div align="center">

<img src="Frontend/img/logo-lockup.jpg" alt="SAOPS — Seu agendamento, mais simples" width="420">

**Sua agenda, sem complicação.** Sistema de agendamento online gratuito para barbearias, salões, clínicas e outros prestadores.

[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Deploy](https://img.shields.io/badge/Render-live-46E3B7?logo=render&logoColor=white)](https://saops-zjyx.onrender.com/)
[![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-green)](LICENSE)
[![PRs](https://img.shields.io/badge/PRs-bem--vindos-brightgreen)](https://github.com/nicolaskmazzini-coder/SAOPS-new/pulls)

[🌐 Demonstração ao vivo](https://saops-zjyx.onrender.com/) · [📖 Diagramas](DIAGRAMAS.md) · [🐛 Issues](https://github.com/nicolaskmazzini-coder/SAOPS-new/issues)

</div>

---

## 📑 Índice

- [✨ Funcionalidades](#-funcionalidades)
- [🖥️ Páginas](#️-páginas)
- [🛠️ Tecnologias](#️-tecnologias)
- [📁 Estrutura](#-estrutura)
- [🔌 API](#-api)
- [🚀 Rodando localmente](#-rodando-localmente)
- [☁️ Deploy](#️-deploy)
- [🔒 Segurança](#-segurança)
- [👥 Equipe](#-equipe)
- [📄 Licença](#-licença)

---

## ✨ Funcionalidades

| Recurso | Descrição |
|---|---|
| 📅 **Agendamentos** | Marcar, cancelar e reagendar horários com validação de conflito por prestador (409) e índice único `prestador+data+horário` |
| 🔍 **Filtros avançados** | Busca por texto, chips de status, período de/até e ordenação na agenda |
| 🗓️ **Calendário mensal** | Visão dia a dia de agendamentos + tarefas, com semana começando na segunda |
| ✅ **Tarefas** | Categorias (casa, trabalho, estudos, saúde, pessoal), prazos e conclusão |
| ✂️ **Serviços do prestador** | CRUD real: nome, descrição, preço e duração — cada dono gerencia os seus |
| ✉️ **Boas-vindas por e-mail** | E-mail transacional após cadastro local ou Google, enviado pelo Resend |
| 🔗 **Compartilhar perfil** | Link direto do perfil público do prestador para enviar aos clientes |
| 🔔 **Lembretes** | Aviso no site + notificação do navegador quando faltar pouco pro horário |
| 🔐 **Login social** | Conta local (e-mail/senha com bcrypt) ou Google via OAuth |
| 🌙 **Tema claro/escuro** | Segue o sistema, com alternância manual e sem flash ao carregar |
| 📱 **PWA + responsivo** | Instalável, funciona bem no celular |
| 🔎 **SEO + IAs** | Meta/Open Graph, sitemap, `robots.txt`, `llms.txt` e JSON-LD |

---

## 🖥️ Páginas

| Página | Rota | O que faz |
|---|---|---|
| Início | `/` | Apresentação + perguntas frequentes |
| Buscar | `/busca` | Encontra prestadores por nome, categoria ou bairro |
| Agendar | `/agendamento` | Escolhe serviço, dia e horário *(login)* |
| Calendário | `/calendario` | Grade mensal + lista do dia com filtros de status |
| Tarefas | `/tarefas` | CRUD de tarefas *(login)* |
| Agenda do prestador | `/agenda-prestador` | Gestão com filtros avançados *(login)* |
| Meu negócio | `/meu-negocio` | Perfil público e serviços do prestador *(login empresa)* |
| Perfil | `/perfil` | Dados, foto, agendamentos e notificações |
| Sobre nós | `/sobre-nos` | Equipe, stack e números do projeto |

*Leituras e alterações de dados exigem sessão e retornam apenas registros do usuário ou prestador autenticado. A vitrine e a consulta de horários disponíveis são públicas.*

---

## 🛠️ Tecnologias

- **Backend:** Node.js 24 + Express 5 + PostgreSQL (`pg`, Supabase) + `bcryptjs` + `express-rate-limit` + `dotenv`
- **Frontend:** HTML + CSS + JavaScript puros (sem frameworks), Google Identity Services para login social
- **Infra:** [Render](https://render.com/) (plano gratuito, região Frankfurt) com deploy automático a cada push na `main`

---

## 📁 Estrutura

```
SAOPS/
├── Backend/
│   ├── server.js      # API REST + rotas amigáveis + 404 real
│   ├── auth.js        # Cadastro/login/sessão (cookie HttpOnly) + OAuth
│   ├── database.js    # PostgreSQL (Supabase): agendamentos, tarefas, usuarios, sessoes, servicos
│   └── package.json
├── Frontend/
│   ├── Paginas/       # 19 páginas + robots.txt, sitemap.xml, llms.txt, manifest
│   ├── js/            # api, ui, tema, lembretes, social, toast, prestadores
│   ├── CSS/           # Tema Google Agenda (variáveis + modo escuro)
│   └── img/           # Logo, favicon, og:image e ícones PWA
├── README.md
├── DIAGRAMAS.md       # Arquitetura, banco e fluxos em Mermaid
└── render.yaml        # Blueprint do deploy no Render
```

---

## 🔌 API

Base: `https://saops-zjyx.onrender.com`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/status` | — | Saúde do serviço |
| GET | `/agendamentos` | 🔒 | Lista os registros da conta (com `?sort=` e `?order=`) |
| GET | `/agendamentos/data/:data` | — | Horários ocupados (filtra com `?prestador_id=`) |
| GET | `/agendamentos/:id` | 🔒 | Detalhe de agendamento próprio |
| POST | `/agendamentos` | 🔒 | Cria (valida conflito → `409`) |
| PUT | `/agendamentos/:id` | 🔒 | Atualiza (passado só muda status) |
| DELETE | `/agendamentos/:id` | 🔒 | Remove |
| GET/POST/PUT/DELETE | `/api/tarefas`… | 🔒 todas | CRUD de tarefas (`?data=`, `?concluido=`) |
| GET | `/api/prestadores` | — | Vitrine de prestadores com serviços |
| GET | `/servicos` | — | Vitrine de serviços (com nome do prestador) |
| GET | `/servicos/meus` | 🔒 | Serviços do dono logado |
| POST/PUT/DELETE | `/servicos`… | 🔒 | CRUD (só o dono; alheio dá `404`) |
| POST | `/api/auth/cadastro` | — | Cria conta (senha 8–72) |
| POST | `/api/auth/login` | — | E-mail (+ nome do negócio p/ empresa) |
| POST | `/api/auth/oauth` | — | Google (`id_token` validado) |
| PUT | `/api/auth/negocio` | 🔒 | Atualiza o perfil do prestador logado |
| POST | `/api/auth/logout` | 🔒 | Encerra a sessão |
| GET | `/api/auth/eu` | 🔒 | Usuário atual |

Exemplo:

```bash
curl https://saops-zjyx.onrender.com/api/status
# {"status":"ok","mensagem":"SAOPS ativo."}
```

---

## 🚀 Rodando localmente

Pré-requisito: **Node.js 18+**.

```bash
git clone https://github.com/nicolaskmazzini-coder/SAOPS-new.git
cd SAOPS
npm install --prefix Backend
PORT=3000 node Backend/server.js
```

Acesse **http://localhost:3000**. Copie `Backend/.env.example` para `Backend/.env` e configure `DATABASE_URL` (PostgreSQL/Supabase) — as tabelas e índices são criados sozinhos na primeira execução.

Login social local (opcional): acrescente no mesmo `.env` `GOOGLE_CLIENT_ID` e cadastre `http://localhost:3000` como origem/redirect no console do Google.

---

## ☁️ Deploy

O `render.yaml` na raiz configura o Blueprint: a cada push na `main`, o Render reinstala e reinicia sozinho (~1 min). Variáveis de ambiente no dashboard: `DATABASE_URL` (obrigatória), `NODE_ENV=production`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY` e `RESEND_FROM`.

O Resend envia o e-mail de boas-vindas após o cadastro local. Crie uma API key no Resend, verifique o domínio remetente e configure `RESEND_API_KEY` e `RESEND_FROM` no Render (e no `.env` local). Sem essas duas variáveis, o cadastro continua funcionando e o envio é ignorado. `SAOPS_PUBLIC_URL` define o endereço usado no botão do e-mail.

> ⚠️ Plano gratuito: o serviço dorme sem tráfego (~50s pra acordar). Os dados vivem no Supabase (PostgreSQL) e **não zeram mais** a cada deploy.

---

## 🔒 Segurança

- Senhas com bcrypt (10 rounds), sessão em cookie `HttpOnly` + `SameSite=Lax` de 7 dias
- `id_token` do Google validado (`aud`, `iss`, `email_verified`)
- Vínculo de conta por e-mail só com e-mail verificado · `rate-limit` no `/api/auth`
- Escape de HTML em todas as telas (anti-XSS) · erros internos genéricos · validação de entrada no backend

---

## 👥 Equipe

| Nome | Papel |
|---|---|
| **Mateus Arthur Castillo Meneguin** | Backend e API |
| **Gustavo Liberato Cabral** | Frontend |
| **Pedro Henrique Chagas Pimentel** | Documentação e Testes |

Trabalho de Conclusão de Curso (TCC).

---

## 📄 Licença

MIT — use à vontade, mantendo os créditos. 🤝
