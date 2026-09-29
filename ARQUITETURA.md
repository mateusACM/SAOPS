# 🏗️ ARQUITETURA DO SISTEMA — SAOPS

## 📌 Visão Geral

O **SAOPS** é uma aplicação web de agendamento (TCC) com **API REST** em Node.js + SQLite e frontend estático servido pelo próprio backend. Escrita exige **login** (sessão em cookie HttpOnly); leituras são públicas.

### Stack Tecnológico

```
Navegador (18 páginas HTML + 7 scripts JS)
    ↓ HTTP (mesma origem)
Express 5 — rotas amigáveis + API REST + /api/auth
    ↓
SQLite (agendamento.db) — 5 tabelas
```

**Dependências:** `express`, `sqlite3`, `bcryptjs`, `express-rate-limit`, `body-parser`, `cors`, `dotenv`. **Runtime:** Node.js 18+ (produção: 24 no Render).

---

## 🧩 Componentes

### 1. Frontend (`Frontend/`)
- **18 páginas** em `Paginas/` servidas como raiz estática + URLs amigáveis (`/calendario` → `calendario.html`)
- **JS** em `js/`: `api.js` (chamadas REST + flag `naoAutenticado`), `ui.js` (avatar, nav ativa, `esc()`, skeletons, `exigirLogin`/`voltarAposLogin`), `tema.js` (claro/escuro), `lembretes.js` (aviso ≤ antecedência), `social.js` (Google/Microsoft), `toast.js`, `prestadores.js` (catálogo mock)
- **CSS** em `CSS/style.css`: variáveis + tema escuro (`html[data-tema="escuro"]`)
- **Imagens** em `img/`: logo PNG, lockup, favicon, og:image, ícones PWA + `logo-original.png` (fonte)

### 2. Backend (`Backend/`)
- **`server.js`** — Express: CRUD `/agendamentos`, `/tarefas`, `/servicos`, rotas amigáveis, 404 real (`erro.html` com status 404), rate-limit no `/api/auth`
- **`auth.js`** — cadastro/login/logout/`eu`/config/OAuth (Google via `tokeninfo`, Microsoft via JWKS RS256), sessão de 7 dias em cookie `saops_token` (`HttpOnly`, `SameSite=Lax`)
- **`database.js`** — conexão, 5 tabelas, `PRAGMA foreign_keys`, índices e limpeza horária de sessões
- **Porta:** `PORT` (produção) ou 3000 local — `PORT=3000 node Backend/server.js`

### 3. Banco de Dados (`agendamento.db`, SQLite)
| Tabela | Dono | Descrição |
|---|---|---|
| `agendamentos` | — (global) | Nome, serviço, data, horário, telefone, status + `UNIQUE(data, horario)` |
| `tarefas` | — (global) | Título, data, hora, categoria, concluído |
| `usuarios` | — | Nome, e-mail único, `senha_hash`, tipo, provider, foto |
| `sessoes` | `usuarios` | Token, expiração (limpeza horária) |
| `servicos` | `usuarios` | Nome, descrição, preço, duração |

---

## 🔌 Endpoints (24)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/status` | — | Saúde (`{"status":"ok"}`) |
| GET | `/agendamentos` | — | Lista (`?sort=&order=` com whitelist) |
| GET | `/agendamentos/data/:data` | — | Do dia |
| GET | `/agendamentos/:id` | — | Detalhe |
| POST | `/agendamentos` | 🔒 | Cria (conflito → `409`) |
| PUT | `/agendamentos/:id` | 🔒 | Atualiza (passado só muda status) |
| DELETE | `/agendamentos/:id` | 🔒 | Remove |
| GET/POST/PUT/DELETE | `/tarefas`… | GET — / 🔒 resto | CRUD (`?data=`, `?concluido=`) |
| GET | `/servicos` | — | Vitrine (com nome do prestador) |
| GET | `/servicos/meus` | 🔒 | Do dono logado |
| POST/PUT/DELETE | `/servicos`… | 🔒 | CRUD (alheio → `404`) |
| POST | `/api/auth/cadastro` | — | Conta (senha 8–72) |
| POST | `/api/auth/login` | — | E-mail (+ nome do negócio p/ empresa) |
| POST | `/api/auth/oauth` | — | Google/Microsoft (`id_token` validado) |
| POST | `/api/auth/logout` | 🔒 | Encerra sessão |
| GET | `/api/auth/eu` · `/config` | 🔒 / — | Usuário atual · client IDs |

Sem sessão nas rotas 🔒 → `401 { erro: 'Login necessário.' }`.

---

## 🔄 Fluxo de Dados

### Escrita com login (ex.: POST /agendamentos)
```
Página chama exigirLogin() → sem sessão: guarda saops_voltar e vai pro login
    ↓ (logado: cookie saops_token vai junto, mesma origem)
Middleware exigirLogin valida sessão no SQLite
    ↓
Validações → conflito? → INSERT → 201 + id (ou 400/401/409)
    ↓
Frontend trata naoAutenticado (volta pro login) ou exibe toast
```

### Leitura pública (ex.: GET /agendamentos)
```
Página → fetch → SELECT → JSON { mensagem, total, agendamentos[] } → render com esc()
```

---

## ✅ Validações (backend)

1. Campos obrigatórios · 2. Data `YYYY-MM-DD` real · 3. Hora `HH:MM` · 4. **Data+hora futuras** (criação e reagendamento) · 5. **Conflito → `409`** (SELECT + `UNIQUE`, com rede p/ corrida) · 6. Telefone 10–11 dígitos · 7. Status/duração/preço/categoria/tamanhos máximos · 8. Senha 8–72 + e-mail válido + e-mail único (`409`) · 9. OAuth: `aud`/`iss`/`exp`/`nonce` + `email_verified` no Google · 10. Dono do serviço (`usuario_id`) · 11. Ordenação com whitelist (anti SQL injection)

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
