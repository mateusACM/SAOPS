# 🏗️ ARQUITETURA DO SISTEMA — SAOPS

## 📌 Visão Geral

O **SAOPS** é uma aplicação web de agendamento (TCC) com **API REST** em Node.js + PostgreSQL (Supabase) e frontend estático servido pelo próprio backend. A leitura e escrita de dados pessoais exigem **login** (sessão em cookie HttpOnly); a vitrine e os horários ocupados são públicos.

### Stack Tecnológico

```
Navegador (19 páginas HTML + 7 scripts JS)
    ↓ HTTP (mesma origem)
Express 5 — rotas amigáveis + API REST + /api/auth
    ↓
PostgreSQL 17 (Supabase) — 5 tabelas
```

**Dependências:** `express`, `pg`, `bcryptjs`, `express-rate-limit`, `body-parser`, `cors`, `dotenv`. **Runtime:** Node.js 18+ (produção: 24 no Render).

---

## 🧩 Componentes

### 1. Frontend (`Frontend/`)
- **19 páginas** em `Paginas/` servidas como raiz estática + URLs amigáveis (`/calendario` → `calendario.html`)
- **JS** em `js/`: `api.js` (chamadas REST + vitrine real), `ui.js` (avatar, nav ativa, `esc()`, skeletons, `exigirLogin`/`voltarAposLogin`), `tema.js` (claro/escuro), `lembretes.js` (avisos), `social.js` (Google) e `toast.js`
- **CSS** em `CSS/style.css`: variáveis + tema escuro (`html[data-tema="escuro"]`)
- **Imagens** em `img/`: logo PNG, lockup, favicon, og:image, ícones PWA + `logo-original.png` (fonte)

### 2. Backend (`Backend/`)
- **`server.js`** — Express: CRUD `/agendamentos`, `/api/tarefas`, `/servicos`, rotas amigáveis, 404 real (`erro.html` com status 404), rate-limit no `/api/auth`
- **`auth.js`** — cadastro/login/logout/`eu`/config/OAuth (Google via `tokeninfo`), sessão de 7 dias em cookie `saops_token` (`HttpOnly`, `SameSite=Lax`)
- **`database.js`** — pool do PostgreSQL, helpers async (`q`/`qGet`/`qAll`), 5 tabelas com FKs nativas, índices e limpeza horária de sessões
- **Porta:** `PORT` (produção) ou 3000 local — `PORT=3000 node Backend/server.js`

### 3. Banco de Dados (PostgreSQL — Supabase)
| Tabela | Dono | Descrição |
|---|---|---|
| `agendamentos` | `usuario_id`, `prestador_id` | Cliente, serviço, data, horário, telefone e status + `UNIQUE(prestador_id, data, horario)` |
| `tarefas` | `usuario_id` | Título, data, hora, categoria, concluído |
| `usuarios` | — | Nome, e-mail único, `senha_hash`, tipo, provider, foto |
| `sessoes` | `usuarios` | Token, expiração (limpeza horária) |
| `servicos` | `usuarios` | Nome, descrição, preço, duração |

---

## 🔌 Endpoints (24)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/status` | — | Saúde (`{"status":"ok"}`) |
| GET | `/agendamentos` | 🔒 | Registros do cliente ou prestador autenticado (`?sort=&order=`) |
| GET | `/agendamentos/data/:data` | — | Horários ocupados (`?prestador_id=`) |
| GET | `/agendamentos/:id` | 🔒 | Detalhe de registro próprio |
| POST | `/agendamentos` | 🔒 | Cria (conflito → `409`) |
| PUT | `/agendamentos/:id` | 🔒 | Atualiza (passado só muda status) |
| DELETE | `/agendamentos/:id` | 🔒 | Remove |
| GET/POST/PUT/DELETE | `/api/tarefas`… | 🔒 todas | CRUD (`?data=`, `?concluido=`) |
| GET | `/servicos` | — | Vitrine (com nome do prestador) |
| GET | `/servicos/meus` | 🔒 | Do dono logado |
| POST/PUT/DELETE | `/servicos`… | 🔒 | CRUD (alheio → `404`) |
| POST | `/api/auth/cadastro` | — | Conta (senha 8–72) |
| POST | `/api/auth/login` | — | E-mail (+ nome do negócio p/ empresa) |
| POST | `/api/auth/oauth` | — | Google (`id_token` validado) |
| POST | `/api/auth/logout` | 🔒 | Encerra sessão |
| GET | `/api/auth/eu` · `/config` | 🔒 / — | Usuário atual · client ID Google |
| PUT | `/api/auth/negocio` | 🔒 | Atualiza perfil do prestador |
| GET | `/api/prestadores` | — | Vitrine com serviços reais |

Sem sessão nas rotas 🔒 → `401 { erro: 'Login necessário.' }`.

---

## 🔄 Fluxo de Dados

### Escrita com login (ex.: POST /agendamentos)
```
Página chama exigirLogin() → sem sessão: guarda saops_voltar e vai pro login
    ↓ (logado: cookie saops_token vai junto, mesma origem)
Middleware exigirLogin valida sessão no PostgreSQL
    ↓
Validações → conflito? → INSERT → 201 + id (ou 400/401/409)
    ↓
Frontend trata naoAutenticado (volta pro login) ou exibe toast
```

### Vitrine e disponibilidade públicas
```
Busca → GET /api/prestadores → perfil e serviços
Reserva → GET /agendamentos/data/:data?prestador_id=... → apenas horários ocupados
```

---

## ✅ Validações (backend)

1. Campos obrigatórios · 2. Data `YYYY-MM-DD` real · 3. Hora `HH:MM` · 4. **Data+hora futuras** (criação e reagendamento) · 5. **Conflito → `409`** (SELECT + `UNIQUE(prestador_id, data, horario)`, com rede p/ corrida) · 6. Telefone 10–11 dígitos · 7. Status/duração/preço/categoria/tamanhos máximos · 8. Senha 8–72 + e-mail válido + e-mail único (`409`) · 9. OAuth: `aud`/`iss`/`exp`/`nonce` + `email_verified` no Google · 10. Dono do serviço (`usuario_id`) · 11. Ordenação com whitelist (anti SQL injection)

Erros de banco viram `{"erro":"Erro interno do servidor"}` (detalhes só no log).

---

## 🔒 Segurança

- bcrypt (10 rounds) · cookie `HttpOnly`/`Lax` · vínculo OAuth só com e-mail verificado
- `rate-limit` (100/15min por IP) no `/api/auth` · `esc()` anti-XSS nas telas
- Sem stack no cliente · `PRAGMA foreign_keys` · placeholders `?` em todo SQL

---

## 📁 Estrutura de Pastas

```
SAOPS/
├── Backend/          # server.js, auth.js, database.js, package.json
├── Frontend/         # Paginas/ (18 + robots/sitemap/llms/manifest), js/ (7), CSS/, img/
├── render.yaml       # Blueprint (build + start + auto-deploy)
├── README.md         # Visão geral e setup
├── DIAGRAMAS.md      # Arquitetura e fluxos (Mermaid)
├── MANUAL_USUARIO.md # Guia do usuário final
├── INTEGRACAO_FRONTEND.md # Referência da API
└── CHANGELOG.md      # Histórico
```

---

## 🚀 Escalabilidade e próximos passos

- [x] Autenticação + login social ~~(era "melhoria futura")~~
- [x] Filtros avançados ~~(era "melhoria futura")~~
- [ ] Push em 2º plano (Service Worker + Web Push + scheduler)
- [ ] Ligar a reserva aos serviços reais (identidade do prestador)
- [ ] Paginação · [ ] PostgreSQL (se sair do plano gratuito)
