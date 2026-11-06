# 📊 Diagramas do SAOPS

Arquitetura em [Mermaid](https://mermaid.js.org/) (renderizam direto no GitHub).

---

## 1. Arquitetura de Software

```mermaid
flowchart TB
    subgraph NAV["Navegador do usuário"]
        PAG["20 páginas HTML5 + CSS3"]
        JS["Scripts JavaScript<br/>api.js, ui.js, tema.js,<br/>lembretes.js, social.js, toast.js, cadastro.js"]
        PAG --> JS
    end

    subgraph SRV["Servidor Node.js + Express 5 (Render)"]
        MW["Middlewares: CORS, body-parser,<br/>rate-limit, exigirLogin"]
        REST["API REST<br/>/agendamentos, /servicos,<br/>/api/tarefas, /api/prestadores"]
        AUTH["/api/auth<br/>cadastro, login, sessão,<br/>OAuth Google + cookie saops_token"]
        STATIC["Arquivos estáticos e URLs amigáveis"]
        MW --> REST
        MW --> AUTH
    end

    DB[("PostgreSQL (Supabase)")]
    GOOGLE["Google"]
    NAVEGADOR(("Usuário"))

    NAVEGADOR -- "HTTP/JSON + cookie de sessão" --> SRV
    REST --> DB
    AUTH --> DB
    AUTH -. "valida id_token" .-> GOOGLE
    STATIC -. "entrega as páginas" .-> NAVEGADOR
```

---

## 2. Diagrama de Classes

```mermaid
classDiagram
    class Usuario {
        +id: number
        +nome: string
        +email: string
        -senha_hash: string
        +telefone: string
        +tipo: cliente | empresa
        +provider: local | google
        +categoria: string
        +endereco: string
        +whatsapp: string
        +banner: string
        +foto_upload: string
        +disponibilidade: JSON
        +cadastrar()
        +login()
        +logout()
        +atualizarNegocio()
        +excluirConta()
    }

    class Sessao {
        +token: string
        +usuario_id: number
        +expira_em: string
        +criarSessao()
        +usuarioAtual()
        +limparSessoes()
    }

    class Tarefa {
        +id: number
        +usuario_id: number
        +titulo: string
        +data: string
        +hora: string
        +categoria: string
        +concluido: number
        +criar()
        +listar()
        +atualizar()
        +excluir()
    }

    class Servico {
        +id: number
        +usuario_id: number
        +nome: string
        +descricao: string
        +preco: number
        +duracao_min: number
        +criar()
        +listar()
        +atualizar()
        +excluir()
    }

    class Agendamento {
        +id: number
        +nome_cliente: string
        +servico: string
        +data: string
        +horario: string
        +telefone: string
        +status: string
        +usuario_id: number
        +prestador_id: number
        +criar()
        +listar()
        +atualizar()
        +excluir()
        +existeConflitoDeHorario()
    }

    Usuario "1" --> "0..*" Sessao : possui
    Usuario "1" --> "0..*" Tarefa : organiza
    Usuario "1" --> "0..*" Servico : oferece
    Usuario "1" --> "0..*" Agendamento : marca (cliente)
    Usuario "1" --> "0..*" Agendamento : atende (prestador)
    Agendamento ..> Servico : usa a duração e o nome
```

---

## 3. Diagrama de atividade

```mermaid
flowchart LR
    START([Início]) --> BUSCAR["Buscar um prestador"]
    BUSCAR --> PERFIL["Abrir o perfil e<br/>escolher o serviço"]
    PERFIL --> LOGADO{Logado?}
    LOGADO -- "Não" --> LOGIN["Fazer login ou criar conta"]
    LOGADO -- "Sim" --> DATA
    LOGIN --> DATA["Escolher a data"]
    DATA --> LIVRES["Sistema exibe os horários<br/>livres dentro do expediente"]
    LIVRES --> ESCOLHE["Escolher horário e confirmar"]
    ESCOLHE --> VALIDOS{Dados válidos?}

    subgraph ERROS["Validações (voltam ao fluxo)"]
        direction LR
        ERRO["Exibir erro (400)"] ~~~ OCUPADO["Avisar horário<br/>ocupado (409)"]
    end

    VALIDOS -- "Não" --> ERRO
    ERRO --> LIVRES
    VALIDOS -- "Sim" --> CONFLITO{Horário em conflito?}
    CONFLITO -- "Sim" --> OCUPADO
    OCUPADO --> LIVRES
    CONFLITO -- "Não" --> GRAVAR["Gravar agendamento<br/>com status 'agendado'"]
    GRAVAR --> CONFIRMA["Exibir confirmação"]
    CONFIRMA --> FIM([Fim])
```

---

## 4. Diagrama de caso de uso

```mermaid
graph LR
    subgraph SISTEMA["Sistema SAOPS"]
        BUSCAR(["Buscar prestadores"])
        PERFIL(["Ver perfil do prestador"])
        AGENDAR(["Agendar horário"])
        CANCELAR(["Cancelar ou reagendar"])
        LEMBRETES(["Configurar lembretes"])
        TAREFAS(["Gerenciar tarefas"])
        CALENDARIO(["Ver calendário"])
        WHATSAPP(["Chamar no WhatsApp"])
        EXCLUIRCONTA(["Excluir conta (LGPD)"])
        LOGIN(["Criar conta / Fazer login"])
        GOOGLELOGIN(["Entrar com Google"])
        PAINEL(["Ver painel e agenda"])
        CONCLUIR(["Confirmar ou concluir atendimento"])
        SERVICOS(["Gerenciar serviços"])
        NEGOCIO(["Editar perfil do negócio e expediente<br/>(banner, foto, WhatsApp)"])
    end

    CLIENTE(("Cliente"))
    PRESTADOR(("Prestador"))
    USUARIO(("Usuário"))
    GOOGLE(("Google"))

    AGENDAR -."include".-> LOGIN
    GOOGLELOGIN -."extend".-> LOGIN

    CLIENTE --> BUSCAR & PERFIL & AGENDAR & CANCELAR & LEMBRETES & WHATSAPP & EXCLUIRCONTA
    PRESTADOR --> PAINEL & CONCLUIR & SERVICOS & NEGOCIO
    USUARIO --> TAREFAS & CALENDARIO & LOGIN
    CLIENTE -.-> USUARIO
    PRESTADOR -.-> USUARIO
    GOOGLE --> GOOGLELOGIN
```

---

## 5. Login social (Google)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant S as social.js
    participant IdP as Google
    participant API as POST /api/auth/oauth
    U->>S: clica no botão social
    S->>IdP: botão GIS
    IdP-->>S: id_token
    S->>API: {provider: 'google', credential}
    API->>IdP: valida Google via tokeninfo (aud, iss, email verificado)
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
    DEV["git push main"] --> GH[("GitHub nicolaskmazzini-coder/SAOPS-new")]
    GH --> R["Render Blueprint render.yaml"]
    R --> B["build: npm install --prefix Backend"]
    B --> S["start: npm start --prefix Backend"]
    S --> P["https://saops-zjyx.onrender.com"]
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
            Login social Google
        Organização
            Tarefas com categorias
            Sobre nós
```

---

*Gerado a partir do código em `Backend/` e `Frontend/` — se o código mudar, atualize os diagramas.*
