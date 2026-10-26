# CHANGELOG - Registro de Mudanças

Todas as mudanças importantes do projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.4.2] - 2026-10-26

### Adicionado
- **Banner e foto real do prestador no perfil público** (`detalhes-prestador`): o hero ganhou banner com proporção ~21:9 (e scrim para o texto continuar legível) e o avatar passou a mostrar a foto de perfil — o fallback preserva a foto do Google OAuth (`foto`) e, por último, as iniciais
- **Upload de imagem no Meu negócio** (`meu-negocio.html`): arquivo comprimido no navegador via canvas (banner 1200px JPEG 0.72, foto 512px JPEG 0.8) e gravado como data URL nas colunas novas `usuarios.banner` / `usuarios.foto_upload` pelo `PUT /api/auth/negocio` 🔒 — backend aceita só `data:image/jpeg|png|webp;base64` com até ~450KB, campo ausente mantém a imagem e `null` remove
- **Vitrine expõe as imagens**: `GET /api/prestadores` agora devolve `banner` e `foto_upload` de cada prestador

### Alterado
- Limite do `bodyParser` subiu de 100KB para **2mb** — data URLs grandes dos uploads passam a chegar no JSON (`Backend/server.js`)

## [1.4.1] - 2026-10-23

### Corrigido
- **Expiração de sessão valia "ao dia"**: `expira_em` era gravado em ISO com `T`/`Z`, mas comparado em texto com o formato do `AGORA_SQL` (`YYYY-MM-DD HH24:MI:SS`) — a comparação só acertava a data, não a hora. Novo helper `formatoUTC()` em `database.js` (exportado) usado em `criarSessao`, mais um `UPDATE` idempotente no array `SCHEMA` para corrigir sessões antigas com `T`
- **"Hoje" quebrava no fuso do Brasil**: o Render roda em UTC e o `new Date(...)` do processo deslocava o dia corrente. Novas funções em `server.js`: `agoraSaoPaulo()` (via `Intl`), `parseDataLocal` reescrito para base UTC; `validarDataHoraFutura` e `validarDataFutura` comparam no fuso de Brasília (hoje conta como futuro) e o dia da semana do `POST /agendamentos` usa `parseDataLocal(data).getUTCDay()` determinístico
- **Conflito no `PUT /agendamentos/:id`** checava horário exato; agora usa a função compartilhada `existeConflitoDeHorario()` (mesma regra de sobreposição por duração do `POST`), com `ignorarId` para excluir o próprio registro

### Segurança
- **CORS deixou de ser aberto** (`cors()`): virou whitelist (`ORIGENS_PERMITIDAS` = `SAOPS_PUBLIC_URL` + `localhost:5500`/`:3000`) com `credentials: true`; origem fora da lista recebe `callback(null, false)` (`Backend/server.js:38-56`)
- `.gitignore`: corrigida a linha quebrada que fazia o `env` **não** ser ignorado

### Adicionado
- **Novo layout da `/login-empresa`**: bloco `negocio-hero` + `negocio-card` centralizado (`style.css`), link "Ver painel do prestador" que aparece só com sessão de empresa ativa, e `api.js`/`ui.js` passando a enviar `credentials: 'include'` nas chamadas de API (necessário para o cookie cruzar origem no dev)
- **Botão mostrar/ocultar senha** (olhinho com SVG, `aria-pressed`/`aria-label`, `type="button"`) injetado em todo `<input type="password">` por `initMostrarOcultarSenha()` em `Frontend/js/ui.js`; variáveis `--senha-icon*` em `style.css` com contraste ≥ 7:1 nos temas claro e escuro, e seletores de botão do tema escuro ganharam `:not(.senha-toggle)`

## [1.4.0] - 2026-10-04

### Adicionado
- **Tela "Meu negócio"** (`/meu-negocio`, só prestador): perfil público (nome, categoria, endereço, apresentação, anos de experiência, Instagram), **horários de atendimento por dia** (expediente salvo em `disponibilidade`) e CRUD de serviços na mesma página — linkada no painel e na agenda
- `PUT /api/auth/negocio` 🔒 (só `tipo=empresa`) + campos novos em `usuarios`: `bio`, `anos_experiencia`, `instagram`, `disponibilidade` (JSONB, padrão seg–sex 09:00–17:00, intervalo 30 min)
- `GET /api/prestadores` público — vitrine de prestadores com perfil + serviços reais; a busca deixou o catálogo mock (`prestadores.js`)
- **Validações de agendamento por prestador**: `prestador_id` obrigatório, serviço precisa pertencer ao prestador, dia ativo e horário dentro do expediente, conflito calculado pela **duração** do serviço (`409`)
- Página `detalhes-prestador` (perfil público do prestador, `index, follow`) com botão "Compartilhar perfil" no Meu negócio

### Alterado
- **Login Microsoft removido** — restam e-mail/senha e Google; saíram `verificarMicrosoft`/JWKS/RS256, o botão das telas de login e a página `auth-callback.html`
- `GET /agendamentos` virou privado (dono: cliente = `usuario_id`, empresa = `prestador_id`) e `GET/PUT/DELETE /:id` só respondem para o dono
- **Tarefas movidas para `/api/tarefas`** com dono por usuário (`usuario_id`): cada conta só enxerga/atualiza/apaga as próprias (`401` sem sessão)
- Cadastro de empresa **exige** `categoria` (`barbearia|salao|clinica|outro`) e `endereco`; senha mínima alinhada em 8 caracteres no frontend e no backend; rótulo do login da empresa agora diz "E-mail ou nome do negócio"
- **Domínio oficial adotado: `https://saops-zjyx.onrender.com`** (101 referências em 26 arquivos; sitemap/robots/canonical/JSON-LD no domínio novo)

### Segurança
- **`Backend/env` (credencial do banco) apagado do repositório** e incluído no `.gitignore`; a credencial continua exposta no histórico antigo — trocar a senha do Supabase é recomendado

### Removido
- Verificação de e-mail por Resend (entrou e saiu nesta mesma janela)

## [1.3.0] - 2026-10-03

### Adicionado
- **Botão "Entrar" na página inicial** (vira "Meu perfil" quando já existe sessão)
- **Painel do prestador** (`/painel-prestador`): cards de hoje / semana (seg–dom) / pendentes, contagem por status, lista do dia e ações rápidas — novo destino do login e do cadastro de empresa
- `GET /agendamentos/meus` 🔒 — só os agendamentos da conta logada (`401` sem sessão) + `listarMeusAgendamentos()` no frontend
- Coluna `usuario_id` em `agendamentos` (schema + índice + backfill por nome): toda criação grava o dono do agendamento

### Alterado
- **Perfil exige login**: sem sessão redireciona para o login com volta automática; a lista deixou de "todos do banco filtrados pelo nome no navegador" e passou a ser "só os meus", filtrada no servidor
- `login-empresa.html` e `cadastro-empresa.html` agora levam ao painel do prestador (e o link "Painel" entrou na agenda)

### Corrigido
- **Calendário não pisca mais ao clicar num dia**: a seleção é aplicada no lugar, sem redesenhar a grade inteira
- Esqueleto de carregamento só na primeira carga — recarregar (após cancelar/concluir) não troca mais a grade por um flash

---

## [1.2.0] - 2026-10-03

### Adicionado
- **PostgreSQL (Supabase)** no lugar do SQLite: dados persistem e não zeram mais a cada deploy
- Script `Backend/migrar-pra-pg.js` — migração SQLite → PostgreSQL (dados, schema, índices e sequências)

### Alterado
- `database.js` reescrito: pool `pg` + helpers async (`q`/`qGet`/`qAll`), schema em dialeto PostgreSQL
- `server.js` e `auth.js`: 33 chamadas convertidas para `async/await` com placeholders `$1..$n`
- `INSERT ... RETURNING id` no lugar de `this.lastID`; `rowCount` no lugar de `this.changes`
- Erros de corrida no índice único (`23505`) → `409` (antes `SQLITE_CONSTRAINT`)
- Id de rota não numérico → `404` (no PostgreSQL daria erro de tipo)

### Corrigido
- `DELETE /tarefas/:id` estava sem `exigirLogin` — escrita de tarefa agora exige login como as demais

---

## [1.1.0] - 2026-09-29

### Renomeado
- Sistema **PGENFMA → SAOPS** (código, banco de chaves, `render.yaml`, repo GitHub)
- Nova logo: símbolo "S" em degradê + wordmark (`Frontend/img/`)

### Adicionado
- **Autenticação real**: cadastro/login (bcrypt), sessão em cookie HttpOnly de 7 dias, OAuth **Google** (GIS), vínculo por e-mail verificado
- **Escrita com login**: `POST/PUT/DELETE` exigem sessão (`401`); volta-do-login (`saops_voltar`, anti-open-redirect)
- **Serviços do prestador**: tabela `servicos` + CRUD com dono (`GET /servicos`, `/meus`, validações)
- **Filtros avançados**: texto, chips de status, período, ordenação, contador (agenda + calendário)
- **Lembretes**: toggle no perfil, antecedência 15/30/60 min, Notification + toast (1x por agendamento)
- **Tema claro/escuro** (segue o sistema, botão sol/lua, sem flash)
- **SEO + IAs**: metatags/OG, `robots.txt` (bots de IA), `sitemap.xml`, `llms.txt`, JSON-LD, FAQ, PWA, 404 real
- **Segurança**: `esc()` anti-XSS nas telas, `UNIQUE(data,horario)` + `409`, erros genéricos, `rate-limit`, `PRAGMA FK`, JWKS com cache, senha 8–72
- **Docs**: README reescrito, `DIAGRAMAS.md` (Mermaid), `ARQUITETURA`/`MANUAL`/`INTEGRACAO` atualizados
- Licença **MIT** (`LICENSE`)

### Corrigido
- Calendário desalinhado (semana segunda-primeira, fim de semana real), `moverFiltro` com `NaN`, datas UTC → locais
- PUT permite concluir passado, valida data+hora, `status` em lowercase; tarefas com `concluido` estrito
- Logout sem abortar, `social-btn:hover`, stats do Sobre (24 endpoints, 5,6k linhas)

### Removido
- `server-antigo(Backup).js`, SVGs da logo antiga, exemplo comentado, seletores mortos

---

## [1.0.0] - 2026-07-22

### Adicionado

#### Backend (API REST)
- ✅ Servidor Express.js rodando na porta 3000
- ✅ Banco de dados SQLite com tabela `agendamentos`
- ✅ 6 endpoints REST completos:
  - POST /agendamentos (criar)
  - GET /agendamentos (listar todos)
  - GET /agendamentos/:id (buscar por ID)
  - GET /agendamentos/data/:data (buscar por data)
  - PUT /agendamentos/:id (atualizar)
  - DELETE /agendamentos/:id (deletar)

#### Validações Robustas
- ✅ Validação de campos obrigatórios
- ✅ Validação de formato de data (YYYY-MM-DD)
- ✅ Validação de formato de horário (HH:MM)
- ✅ Bloqueio de agendamentos em datas passadas
- ✅ Prevenção de horários duplicados (mesmo dia/hora)
- ✅ Validação de telefone (10-11 dígitos)
- ✅ Validação de status permitidos

#### Banco de Dados
- ✅ SQLite como banco de dados relacional
- ✅ Tabela agendamentos com 7 campos
- ✅ Auto-incremento de IDs
- ✅ Arquivo portável (agendamento.db)

#### Documentação
- ✅ README.md com instruções de instalação
- ✅ MANUAL_USUARIO.md com guia completo
- ✅ ARQUITETURA.md com documentação técnica
- ✅ INTEGRACAO_FRONTEND.md com guia de API
- ✅ EXEMPLOS_TESTES.md com exemplos de requisições
- ✅ GUIA_TESTES_POSTMAN.md com passo a passo

#### Testes
- ✅ Testes manuais com Postman
- ✅ Validações em tempo real
- ✅ Tratamento de erros com mensagens descritivas

#### Controle de Versão
- ✅ Repositório Git inicializado
- ✅ GitHub remoto conectado
- ✅ .gitignore configurado
- ✅ Histórico de commits organizado

###  Modificado

- **server.js** - Adicionadas 7 validações robustas
- **database.js** - Mantém criação automática de tabela
- **package.json** - Adicionadas dependências necessárias

###  Dependências

```json
{
  "express": "^4.18.0",
  "body-parser": "^1.20.0",
  "sqlite3": "^5.1.6"
}
```

###  Bugs Corrigidos

- ✅ Resolvido: Conflitos de merge do GitHub
- ✅ Resolvido: IDs não voltavam ao 1 após deletar (criado reset-database.js)
- ✅ Resolvido: Conexão SQLite em ambientes diferentes

###  Segurança

- ✅ Validação de entrada robusta
- ✅ Tratamento de exceções
- ✅ Mensagens de erro sem expor stack trace
- ✅ Parametrized queries contra SQL injection

###  Status

**Versão:** 1.0.0 (Completa)  
**Estabilidade:** ✅ Produção  
**Testes:** ✅ 100% funcional  

---

## [0.9.0] - 2026-07-21

###  Adicionado

#### Backend Base
- ✅ Estrutura inicial com Node.js + Express
- ✅ Conexão básica com SQLite
- ✅ CRUD básico sem validações

#### Endpoints Base (sem validações)
- ✅ POST /agendamentos
- ✅ GET /agendamentos
- ✅ GET /agendamentos/:id
- ✅ PUT /agendamentos/:id
- ✅ DELETE /agendamentos/:id

#### Banco de Dados
- ✅ Tabela agendamentos criada
- ✅ Arquivo SQLite portável

#### Documentação Básica
- ✅ README.md inicial
- ✅ EXEMPLOS_TESTES.md

#### Controle de Versão
- ✅ Repositório GitHub criado
- ✅ Primeiro commit

###  Limitações

- ❌ Sem validações de data passada
- ❌ Sem validação de horários duplicados
- ❌ Sem validação de formato
- ❌ Sem tratamento robusto de erros

---

## Timeline de Desenvolvimento

```
21/07 - Início do projeto
├─ Criação do repositório GitHub
├─ Setup inicial (Node.js + Express)
├─ Banco de dados básico
└─ CRUD simples funcionando

22/07 - Melhorias e Validações
├─ Adicionadas 7 validações robustas
├─ Correção de bugs
├─ Documentação completa
├─ Testes no Postman
└─ v1.0.0 PRONTA!
```

---

##  Roadmap Futuro

### Curto Prazo (Próximos Sprints)

- [ ] Interface Web (HTML/CSS) - Gustavo
- [ ] Filtros e buscas avançadas
- [ ] Paginação de resultados
- [ ] Exportar relatórios (CSV/PDF)
- [ ] Notificações por email

### Médio Prazo

- [ ] Autenticação de usuários (JWT)
- [ ] Suporte a múltiplos prestadores
- [ ] Sistema de avaliações
- [ ] Histórico de agendamentos
- [ ] Dashboard com estatísticas

### Longo Prazo
- [ ] Integração com calendários (Google, Outlook)
- [ ] Notificações por SMS/WhatsApp
- [ ] Sistema de pagamento integrado
- [ ] Deploy em nuvem (AWS, Heroku)
- [ ] Migração para banco PostgreSQL

---

##  Métricas

### Código

| Métrica | Valor |
|---------|-------|
| Linhas de código (backend) | ~150 |
| Linhas de código (database) | ~20 |
| Endpoints | 6 |
| Validações | 7 |
| Arquivos de documentação | 6 |

### Testes

| Tipo | Status |
|------|--------|
| CRUD | ✅ 100% |
| Validações | ✅ 100% |
| Erros | ✅ 100% |
| Integração | ✅ 100% |

### Cobertura

- ✅ Criar agendamento
- ✅ Listar agendamentos
- ✅ Atualizar agendamento
- ✅ Deletar agendamento
- ✅ Validações
- ✅ Tratamento de erros

---

## Como Usar Este Arquivo

### Para Desenvolvedores (Nos)

- Consulte este arquivo para saber o que foi feito
- Verifique o roadmap antes de adicionar features
- Atualize este arquivo quando fizer mudanças

### Para o TCC

- Refira-se a este arquivo na apresentação
- Mostre o progresso do projeto
- Explique as versões e atualizações

### Formato de Entrada

Quando adicionar uma mudança, use este formato:

```markdown
### Adicionado
- ✅ Descrição da feature

###  Modificado
- Arquivo mudado e por quê

###  Bugs Corrigidos
- ✅ Bug resolvido

###  Documentação
- Link ou descrição

###  Performance
- Melhoria implementada
```

---

##  Commits Relacionados

Veja os commits no GitHub para mais detalhes:

```bash
git log --oneline
```

Commits principais:
- `abc1234` - Primeiro commit - Sistema de Agendamento TCC
- `def5678` - Adiciona validações robustas: datas passadas, horários duplicados, formatos
- `ghi9012` - Merge com atualizações do GitHub
- `jkl3456` - Adiciona guia de integração e dados de exemplo para o frontend

---

##  Destaques

###  Melhores Features

1. **Validação de Horários Duplicados**
   - Impede conflitos automaticamente
   - Mensagem clara do porquê

2. **Bloqueio de Datas Passadas**
   - Segurança contra erros
   - Validação no servidor

3. **Validações em Múltiplas Camadas**
   - Frontend + Backend
   - Formato + Negócio

4. **Tratamento de Erros Robusto**
   - Mensagens descritivas
   - Status codes corretos

5. **Documentação Completa**
   - Manual do usuário
   - Guia técnico
   - Exemplos de uso

---

##  Suporte

Para dúvidas sobre mudanças específicas:

- **Backend:** Mateus
- **Frontend:** Gustavo
- **Documentação:** Pedro

---

**Última atualização:** 29/09/2026

**Versão Atual:** 1.1.0 

**Status:** Estamos muitos fodidos


## [Unreleased]

- Prestadores e serviços reais na busca e na reserva; agendamentos passam a registrar cliente e prestador.
- Tela Meu negócio com perfil público e edição inline de serviços.
- Tarefas e agendamentos limitados ao usuário autenticado.
