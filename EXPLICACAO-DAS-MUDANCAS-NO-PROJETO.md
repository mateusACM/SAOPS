# Explicação das Mudanças no Projeto

Histórico completo do que foi feito no **SAOPS** (Sistema de Agendamento) — do TCC original ao sistema atual em produção: https://saops.onrender.com/

> Repositório: https://github.com/nicolaskmazzini-coder/SAOPS-new · Licença MIT · Documentação técnica em `DIAGRAMAS.md`, `ARQUITETURA.md` e `README.md`.

---

## Índice

1. [Ponto de partida](#1-ponto-de-partida)
2. [Deploy no Render](#2-deploy-no-render)
3. [Animações e carregamento](#3-animações-e-carregamento)
4. [Página Sobre Nós + autenticação real](#4-página-sobre-nós--autenticação-real)
5. [Rename PGENFMA → SAOPS](#5-rename-pgenfma--saops)
6. [Logos](#6-logos)
7. [Tema claro/escuro](#7-tema-claroescuro)
8. [Filtros avançados](#8-filtros-avançados)
9. [Lembretes de agendamento](#9-lembretes-de-agendamento)
10. [SEO + reconhecimento por IAs](#10-seo--reconhecimento-por-ias)
11. [Revisão geral + Fases 0–4](#11-revisão-geral--fases-04)
12. [Serviços de verdade](#12-serviços-de-verdade)
13. [Documentação e licença](#13-documentação-e-licença)
14. [Estado atual e pendências](#14-estado-atual-e-pendências)

---

## 1. Ponto de partida

O projeto nasceu como TCC de agendamento (`364c3bc`, mar/2026): API Express + SQLite com CRUD de agendamentos, validações (data passada, horário duplicado, formatos) e docs iniciais (`c911998`, jul/2026). Tudo público, sem login, sem frontend organizado.

## 2. Deploy no Render

**Por quê:** tirar o sistema do `localhost` e deixar acessível de graça.
**O que foi feito** (`6a29baf`, `b8246b2` — 24/set):
- Reorganização em `Backend/` + `Frontend/` (antes tudo misturado)
- `render.yaml` (Blueprint: build `npm install --prefix Backend`, start `npm start --prefix Backend`, plano gratuito, Frankfurt, deploy automático a cada push)
- Repo novo `nicolaskmazzini-coder/PGENFMA` (abandonado o `mateusACM/sistema-agendamento-tcc`)
- Descobertas: SQLite é **efêmero** (zera a cada deploy) e o plano gratuito **dorme** (~50s pra acordar)

## 3. Animações e carregamento

**Por quê:** o site era estático e "travado" ao carregar listas.
**O que foi feito** (`8a808db`): animações de entrada (`fadeUp/fadeDown/popIn`), skeletons com shimmer (`esqueleto()` em `ui.js`, 7 páginas), hover com elevação, respeito a `prefers-reduced-motion`.

## 4. Página Sobre Nós + autenticação real

**O que foi feito** (`8286da4`):
- `sobre-nos.html`: equipe (Mateus/Gustavo/Pedro), stats, features, techs
- **Auth de verdade** (antes era só `localStorage`): `Backend/auth.js` com cadastro/login/logout/`eu`, tabelas `usuarios` + `sessoes`, senha com bcrypt, cookie `saops_token` (`HttpOnly`, 7 dias) + **OAuth Google** (GIS) e **Microsoft** (popup + nonce, JWKS RS256)

## 5. Rename PGENFMA → SAOPS

**Por quê:** novo nome do sistema.
**O que foi feito** (`7232fd8` — 25/set): troca global em 28 arquivos (títulos, marca, chaves `saops_*`, cookie, pacote, README, `render.yaml` com `name: saops`), repo renomeado pra `SAOPS` (antigo vira 301) e **URL nova `saops.onrender.com`** criada via Blueprint (serviço antigo deletado depois, zero downtime).

## 6. Logos

- `58f9b33`: calendário azul com letra **S** (combinando com SAOPS)
- `2cd50d7`: **logo enviada pelo usuário** — "S" em degradê azul→roxo + wordmark *saops*: ícone do header/favicon, lockup no hero, og:image e apple-touch-icon regenerados, `theme-color`/manifest em navy, original em `logo-original.png`

## 7. Tema claro/escuro

**O que foi feito** (`3c6f5e6`): paleta escura estilo Google Dark via `html[data-tema="escuro"]` (~15 novas variáveis CSS), `tema.js` com botão sol/lua no header (salva em `saops_tema`, segue o sistema, script anti-flash no `<head>` das 18 páginas).

## 8. Filtros avançados

**O que foi feito** (`696989f`): `agenda-prestador` ganhou busca por texto, chips de status, período de/até, ordenação, contador "X de Y" e limpar filtros; `calendario` ganhou chips na lista do dia; helper `montarChipsStatus()` em `ui.js`.

## 9. Lembretes de agendamento

**O que foi feito** (`fb7fa59`): seção **Notificações** no perfil (toggle com permissão só no clique + antecedência 15/30/60 min) e `lembretes.js` (checa a cada 60s, `Notification` + toast, 1 aviso por agendamento). Limite: só com aba aberta (push em 2º plano ficou pro futuro).

## 10. SEO + reconhecimento por IAs

**O que foi feito** (`c99a484`, `1904da0`): metatags/OG/canonical nas 18 páginas, `robots.txt` liberando GPTBot/ClaudeBot/Perplexity e outros, `sitemap.xml`, **`llms.txt`**, JSON-LD (Organization/WebSite/SoftwareApplication/FAQPage), FAQ visível, PWA, og:image, **404 real** e meta `google-site-verification` (Search Console).

## 11. Revisão geral + Fases 0–4

Auditoria com 2 agentes + verificação manual achou ~45 itens; corrigidos em 4 commits:

| Fase (commit) | O que corrigiu |
|---|---|
| 0+1 (`9a7eed9`) | `saops_sessao` → `saops_usuario`; **XSS eliminado** nas 7 telas (`esc()`); Google exige `iss` + `email_verified`, vínculo só verificado |
| 2 (`a4cd10a`) | Calendário alinhado (segunda-primeira, fim de semana real), `moverFiltro` sem `NaN`, datas locais (fim do bug das 21h) |
| 3 (`81f0375`) | `UNIQUE(data,horario)` + **409**, erros genéricos, PUT reescrito (concluir passado ok), senha 8–72, **rate-limit**, FK/índices/limpeza de sessões, JWKS com cache, logout sem abortar |
| 4 (`64fccae`) | **Escrita exige login** (`401` em 6 rotas; GETs públicos), volta-do-login (`saops_voltar`, anti-open-redirect), FAQ/llms atualizados |

Decisão do usuário na Fase 4: CRUD continua público? **Não — proteger com login.**

## 12. Serviços de verdade

**O que foi feito** (`407f5d6` — 29/set): a página `gerenciar-servicos` era mock (botões mortos). Virou CRUD real com tabela `servicos` (dono, nome, descrição, preço, duração): vitrine pública + `/meus`, escrita com login e **só o dono altera** (alheio → 404). Limite assumido: a reserva ainda usa serviços mock (ligar os dois exige modelar o prestador).

## 13. Documentação e licença

- `b011db6`: **README** reescrito (badges, features, API, setup, deploy) + **`DIAGRAMAS.md`** (9 diagramas Mermaid: arquitetura, ER, sequências, status, deploy, mapa) — com correções de sintaxe em `bc6d39a`/`a9c5eda`
- `5d98a80`: licença **ISC → MIT** (`LICENSE`)
- `c528353`: `ARQUITETURA`/`MANUAL`/`INTEGRACAO` atualizados, CHANGELOG **1.1.0**, stats do Sobre (18 páginas, 24 endpoints, 5,6k linhas)

## 14. Estado atual e pendências

**No ar:** https://saops.onrender.com/ — 18 páginas, auth local + social (quando configurado), 24 endpoints, tudo verificado em produção a cada entrega.

**Falta (ações do usuário):** criar os apps OAuth (Google/Azure) e setar `GOOGLE_CLIENT_ID`/`MICROSOFT_CLIENT_ID` no Render · clicar **Verificar** no Search Console + enviar o sitemap · deletar o serviço `pgenfma` antigo (se ainda existir).

**Futuro sugerido:** push em 2º plano (Service Worker + Web Push), reserva ligada aos serviços reais, avaliações de prestadores, exportar `.ics`/Google Agenda, paginação, PostgreSQL.
