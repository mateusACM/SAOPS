# 📊 Diagramas do SAOPS

Arquitetura, banco de dados e fluxos do sistema em [Mermaid](https://mermaid.js.org/) (renderizam direto no GitHub).

---

## 1. Arquitetura

```mermaid
flowchart LR
    subgraph Navegador
        P["18 páginas HTML"]
        JS["js: api, ui, tema, lembretes, social, toast"]
        SW["Service Worker - futuro: push em 2o plano"]
    end
    subgraph "Node.js + Express (Render)"
        R["Rotas amigaveis /:pagina + 404 real"]
        API["API REST - agendamentos, tarefas, servicos"]
        AUTH["/api/auth - sessao em cookie HttpOnly"]
        LIM["Rate-limit no /api/auth"]
    end
    subgraph Dados
        DB[("SQLite agendamento.db")]
    end
    subgraph IdPs
        G["Google tokeninfo"]
        M["Microsoft JWKS RS256"]
    end
    P --> JS
    JS --> API
    JS --> AUTH
    API --> DB
    AUTH --> DB
    AUTH -. valida id_token .-> G
    AUTH -. valida id_token .-> M
    R --> P
    LIM -. protege .-> AUTH
```

---

## 2. Banco de dados

```mermaid
erDiagram
    usuarios ||--o{ sessoes : "tem"
    usuarios ||--o{ servicos : "é dono de"
    usuarios {
        int id PK
        string nome
        string email UK
        string senha_hash "null se social"
        string telefone
        string tipo "cliente/empresa"
        string provider "local/google/microsoft"
        string provider_id
        string foto
    }
    sessoes {
        string token PK
        int usuario_id FK
        string expira_em "7 dias"
    }
    servicos {
        int id PK
        int usuario_id FK
        string nome
        string descricao
        real preco
        int duracao_min
    }
    agendamentos {
        int id PK
        string nome_cliente
        string servico
        string data "YYYY-MM-DD"
        string horario "HH:MM"
        string status "agendado, confirmado, concluido, cancelado"
    }
    tarefas {
        int id PK
        string titulo
        string data
        string hora
        string categoria
        int concluido "0/1"
    }
```

> Índices: `UNIQUE(data, horario)` em agendamentos (anti double-booking) + índices em `sessoes(expira_em, usuario_id)`. `agendamentos` e `tarefas` são globais (sem dono) — herança do TCC.

---

## 3. Agendar horário (com login)

```mermaid
sequenceDiagram
    actor C as Cliente
    participant A as agendamento.html
    participant UI as exigirLogin()
    participant L as login-cliente.html
    participant API as POST /agendamentos
    participant DB as SQLite
    C->>A: escolhe serviço, dia e horário
    A->>UI: exigirLogin()
    alt sem sessão
        UI->>L: guarda saops_voltar e redireciona
        L->>L: login ok
        L->>A: voltarAposLogin() devolve
    end
    A->>API: {nome, servico, data, horario}
    API->>DB: SELECT data+horario (conflito?)
    alt ocupado
        DB-->>A: 409 Escolha outro horário
    else livre
        DB-->>A: 201 + id
        A->>A: confirmacao-agendamento.html?id=
    end
```

---

## 4. Login local + sessão

```mermaid
sequenceDiagram
    actor U as Usuário
    participant F as login-*.html
    participant API as POST /api/auth/login
    participant DB as SQLite
    U->>F: e-mail (+ nome do negócio, se empresa) e senha
    F->>API: e-mail e senha
    API->>DB: busca por email (bcrypt.compare)
    alt credenciais ok
        DB-->>API: usuário
        API->>DB: INSERT sessoes (token aleatório, 7 dias)
        API-->>F: Set-Cookie saops_token (HttpOnly, Lax) + usuário
        F->>F: salvarSessaoLocal() + voltarAposLogin()
    else inválidas
        API-->>F: 401 E-mail ou senha incorretos
    end
```

---

## 5. Login social (Google / Microsoft)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant S as social.js
    participant IdP as Google / Microsoft
    participant API as POST /api/auth/oauth
    U->>S: clica no botão social
    S->>IdP: botão GIS / popup + nonce
    IdP-->>S: id_token
    S->>API: {provider, credential, nonce?}
    API->>IdP: valida Google via tokeninfo (aud, iss, email verificado)
    API->>IdP: valida Microsoft via JWKS RS256 (aud, iss, exp, nonce)
    alt provider_id conhecido
        API-->>S: sessão existente
    else e-mail verificado já cadastrado
        API-->>S: vincula e cria sessão
    else e-mail novo
        API-->>S: cria conta + sessão
    end
```

---

## 6. Lembretes de agendamento

```mermaid
sequenceDiagram
    actor U as Usuário
    participant PF as perfil.html
    participant LJ as lembretes.js
    participant API as GET /agendamentos
    U->>PF: ativa toggle (Notification.requestPermission)
    PF->>PF: salva saops_lembretes=on + antecedência
    loop a cada 60s, com aba aberta
        LJ->>API: lista agendado/confirmado
        alt falta ≤ antecedência e ainda não avisado
            LJ->>U: Notification + toast (marca id em vistos)
        end
    end
```

> Push em 2º plano (aba fechada) é o próximo passo: Service Worker + Web Push + scheduler no servidor.

---

## 7. Status do agendamento

```mermaid
stateDiagram-v2
    [*] --> agendado : POST /agendamentos
    agendado --> confirmado : PUT (prestador confirma)
    agendado --> cancelado : PUT / DELETE
    confirmado --> concluido : PUT (pós-atendimento)
    confirmado --> cancelado : PUT / DELETE
    concluido --> [*]
    cancelado --> [*]
    note right of agendado : Passado so muda de status
```

---

## 8. Deploy

```mermaid
flowchart LR
    DEV["git push main"] --> GH[("GitHub nicolaskmazzini-coder/SAOPS")]
    GH --> R["Render Blueprint render.yaml"]
    R --> B["build: npm install --prefix Backend"]
    B --> S["start: npm start --prefix Backend"]
    S --> P["https://saops.onrender.com"]
```

---

## 9. Mapa das páginas

```mermaid
mindmap
    root((SAOPS))
        Cliente
            Buscar prestadores
            Agendar horário
            Calendário
            Cancelar e reagendar
            Perfil e lembretes
        Prestador
            Agenda com filtros
            Gerenciar serviços
        Conta
            Login cliente e empresa
            Cadastro cliente e empresa
            Login social Google e Microsoft
        Organização
            Tarefas com categorias
            Sobre nós
```

---

*Gerado a partir do código em `Backend/` e `Frontend/` — se o código mudar, atualize os diagramas.*
