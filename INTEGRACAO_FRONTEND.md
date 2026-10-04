#  GUIA DE INTEGRAÇÃO - FRONTEND COM API (SAOPS)

Referência da API REST para o frontend (`Frontend/js/api.js`). Leituras de dados pessoais e operações de escrita exigem sessão; sem login retornam `401`. A vitrine e a disponibilidade de horários são públicas.

---

##  INFORMAÇÕES DA API

**URL Base (local):** `http://localhost:3000`

**URL Base (produção):** `https://saops-zjyx.onrender.com`

**Porta:** `3000` local (`PORT` no Render)

**Ambiente:** Node.js 18+ + Express 5 + PostgreSQL (Supabase)

---

##  COMO INICIAR O SERVIDOR

Na raiz do projeto:

```bash
npm install --prefix Backend
PORT=3000 node Backend/server.js
```

Deve aparecer (entre outras):
```
 Conectado ao PostgreSQL (Supabase)
 Tabelas e índices prontos!
```

---

##  ENDPOINTS DISPONÍVEIS

### 1️ CRIAR AGENDAMENTO 🔒 (exige login)

**Método:** `POST`

**URL:** `http://localhost:3000/agendamentos` (sessão obrigatória)

> Sem sessão (cookie `saops_token`) → `401 { "erro": "Login necessário." }`.
> Com `tipo: "empresa"`, o cadastro **exige** `categoria` (`barbearia` | `salao` | `clinica` | `outro`) e `endereco`.

**Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "nome_cliente": "João Silva",
  "servico": "Corte de Cabelo",
  "data": "2024-04-20",
  "horario": "14:00",
  "telefone": "(11) 98765-4321",
  "prestador_id": 7
}
```

> `prestador_id` é obrigatório (usuário `tipo=empresa`) e `servico` deve ser um serviço cadastrado **por aquele prestador**. A API ainda valida: dia ativo no expediente do prestador, horário dentro do expediente e alinhado ao intervalo (padrão 30 min) — ver "Validações" abaixo.

**Resposta Sucesso (Status 201):**
```json
{
  "mensagem": " Agendamento criado com sucesso!",
  "id": 1,
  "detalhes": {
    "nome_cliente": "João Silva",
    "servico": "Corte de Cabelo",
    "data": "2024-04-20",
    "horario": "14:00"
  }
}
```

**Resposta Erro (Status 400):**
```json
{
  "erro": "Não é possível agendar em data/horário passados"
}
```

**Resposta Erro (Status 409 — horário ocupado):**
```json
{
  "erro": "Esse horário conflita com outro atendimento em 2024-04-20. Escolha outro horário."
}
```

> O conflito é calculado pela **duração do serviço** (não só minuto exato) e vale para o mesmo prestador, ignorando agendamentos cancelados.

---

### 2️ LISTAR TODOS OS AGENDAMENTOS

**Método:** `GET`

**URL:** `http://localhost:3000/agendamentos` (sessão obrigatória)

**Resposta (Status 200):**
```json
{
  "mensagem": " Lista de agendamentos",
  "total": 2,
  "agendamentos": [
    {
      "id": 1,
      "nome_cliente": "João Silva",
      "servico": "Corte de Cabelo",
      "data": "2024-04-20",
      "horario": "14:00",
      "telefone": "(11) 98765-4321",
      "status": "agendado"
    },
    {
      "id": 2,
      "nome_cliente": "Maria Santos",
      "servico": "Manicure",
      "data": "2024-04-21",
      "horario": "10:30",
      "telefone": "(21) 91234-5678",
      "status": "confirmado"
    }
  ]
}
```

---

### 2b LISTAR MEUS AGENDAMENTOS 🔒 (exige login)

Só os agendamentos da conta logada (por `usuario_id`, com fallback pelo nome da conta). Sem sessão responde `401`.

**Método:** `GET`

**URL:** `http://localhost:3000/agendamentos/meus`

**Resposta (Status 200):**
```json
{
  "mensagem": " Meus agendamentos",
  "total": 1,
  "agendamentos": [
    {
      "id": 1,
      "nome_cliente": "João Silva",
      "servico": "Corte de Cabelo",
      "data": "2024-04-20",
      "horario": "14:00",
      "telefone": null,
      "status": "agendado",
      "usuario_id": 3
    }
  ]
}
```

**Sem sessão (Status 401):**
```json
{ "sucesso": false, "erro": "Login necessário." }
```

Frontend: `listarMeusAgendamentos()` em `js/api.js` (usado pela página de perfil).

---

### 3 BUSCAR AGENDAMENTO POR ID

**Método:** `GET`

**URL:** `http://localhost:3000/agendamentos/1`

**Resposta (Status 200):**
```json
{
  "id": 1,
  "nome_cliente": "João Silva",
  "servico": "Corte de Cabelo",
  "data": "2024-04-20",
  "horario": "14:00",
  "telefone": "(11) 98765-4321",
  "status": "agendado"
}
```

**Resposta Erro (Status 404):**
```json
{
  "erro": "Agendamento não encontrado"
}
```

---

### 4 BUSCAR AGENDAMENTOS POR DATA

**Método:** `GET`

**URL:** `http://localhost:3000/agendamentos/data/2024-04-20`

**Resposta (Status 200):**
```json
{
  "mensagem": "Agendamentos para 2024-04-20",
  "total": 1,
  "agendamentos": [
    {
      "id": 1,
      "nome_cliente": "João Silva",
      "servico": "Corte de Cabelo",
      "data": "2024-04-20",
      "horario": "14:00",
      "telefone": "(11) 98765-4321",
      "status": "agendado"
    }
  ]
}
```

---

### 5 ATUALIZAR AGENDAMENTO 🔒 (exige login)

**Método:** `PUT`

**URL:** `http://localhost:3000/agendamentos/1`

> Passado só pode mudar de `status` (ex.: concluir); trocar data/hora passada dá `400`. `status` é salvo em minúsculas.

**Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "nome_cliente": "João Silva",
  "servico": "Corte de Cabelo",
  "data": "2024-04-22",
  "horario": "15:00",
  "telefone": "(11) 98765-4321",
  "status": "confirmado"
}
```

**Resposta (Status 200):**
```json
{
  "mensagem": " Agendamento atualizado com sucesso!",
  "detalhes": {
    "id": 1,
    "nome_cliente": "João Silva",
    "data": "2024-04-22",
    "horario": "15:00",
    "status": "confirmado"
  }
}
```

---

### 6 DELETAR AGENDAMENTO 🔒 (exige login)

**Método:** `DELETE`

**URL:** `http://localhost:3000/agendamentos/1`

**Resposta (Status 200):**
```json
{
  "mensagem": " Agendamento deletado com sucesso!",
  "id_deletado": 1
}
```

**Resposta Erro (Status 404):**
```json
{
  "erro": "Agendamento não encontrado"
}
```

---

##  AUTENTICAÇÃO (`/api/auth`)

Sessão em cookie `saops_token` (`HttpOnly`, 7 dias). Como o frontend é servido pela mesma origem, o cookie vai sozinho no `fetch` — sem header manual.

| Método | Rota | Body | Resposta |
|---|---|---|---|
| POST | `/api/auth/cadastro` | `{nome, email, senha(8–72), telefone?, tipo?, categoria?, endereco?}` | `200 + {sucesso, usuario}` / `400` / `409` e-mail em uso |
| POST | `/api/auth/login` | `{email, senha}` (empresa aceita nome do negócio) | `200` / `401` |
| POST | `/api/auth/oauth` | `{provider: 'google', credential}` | `200` / `401` (`id_token` validado) |
| POST | `/api/auth/logout` | — | `200` |
| GET | `/api/auth/eu` | — | `200 + usuario` / `401` |
| GET | `/api/auth/config` | — | `{googleClientId}` |
| PUT | `/api/auth/negocio` 🔒 | `{nome, categoria?, endereco?, bio?, anos_experiencia?, instagram?, disponibilidade?}` | `200 + {usuario}` / `403` se não for empresa |

Padrão do frontend (`ui.js`): `exigirLogin('login-cliente.html')` guarda `saops_voltar` e redireciona; após entrar, `voltarAposLogin(padrão)` devolve. As funções de escrita de `api.js` retornam `naoAutenticado: true` no `401`.

---

##  TAREFAS (`/api/tarefas`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/tarefas` (`?data=`, `?concluido=0\|1`) | 🔒 | Lista ordenada por data/hora |
| GET | `/api/tarefas/:id` | 🔒 | Detalhe do dono |
| POST | `/api/tarefas` | 🔒 | `{titulo, data, hora?, categoria?}` → `201` |
| PUT | `/api/tarefas/:id` | 🔒 | Parcial (só envia o que muda; `concluido` estrito) |
| DELETE | `/api/tarefas/:id` | 🔒 | Remove |

Categorias: `pessoal casa trabalho estudos saude outro`.

---

##  SERVIÇOS (`/servicos`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/servicos` | — | Vitrine (com `prestador`) |
| GET | `/servicos/meus` | 🔒 | Do dono logado |
| POST | `/servicos` | 🔒 | `{nome*, descricao?, preco?≥0, duracao_min?int>0}` → `201` |
| PUT | `/servicos/:id` | 🔒 | Só o dono (alheio → `404`) |
| DELETE | `/servicos/:id` | 🔒 | Só o dono |

---

##  PRESTADORES (`/api/prestadores`)

**Método:** `GET` — público (sem login). É a base da página de busca e do fluxo de agendamento: devolve cada prestador com o perfil e a lista de serviços dele.

**URL:** `http://localhost:3000/api/prestadores`

**Resposta (Status 200):**
```json
{
  "total": 1,
  "prestadores": [
    {
      "id": 7,
      "nome": "Barbearia Central",
      "categoria": "barbearia",
      "endereco": "Rua A, 123",
      "bio": "Cortes clássicos e modernos.",
      "anos_experiencia": 5,
      "instagram": "barbearia.central",
      "disponibilidade": { "intervalo_min": 30, "seg": { "ativo": true, "inicio": "09:00", "fim": "17:00" } },
      "servicos": [
        { "id": 12, "nome": "Corte de Cabelo", "descricao": null, "preco": 45, "duracao_min": 30 }
      ]
    }
  ]
}
```

---

##  VALIDAÇÕES QUE A API FAZ

### 1. Data Não Pode ser no Passado

```
POST /agendamentos

Body:
{
  "nome_cliente": "Teste",
  "servico": "Teste",
  "data": "2020-01-01",
  "horario": "10:00"
}

Resposta:
{
  "erro": "Não é possível agendar em datas passadas"
}
```

---

### 2. Não Pode Ter Horários Duplicados (conflito por prestador)

```
POST /agendamentos

1º Body:
{
  "nome_cliente": "João",
  "servico": "Corte",
  "data": "2024-04-20",
  "horario": "14:00"
}

Resposta: Sucesso! ID: 1

2º Body (MESMO HORÁRIO):
{
  "nome_cliente": "Maria",
  "servico": "Manicure",
  "data": "2024-04-20",
  "horario": "14:00"
}

Resposta (409):
{
  "erro": "Esse horário conflita com outro atendimento em 2024-04-20. Escolha outro horário."
}
```

Também dão `400` (antes do conflito):
- `prestador_id` ausente/inválido → "Escolha um prestador válido."
- prestador não existe → `404` "Prestador não encontrado."
- serviço não é dele → "Escolha um serviço deste prestador."
- dia desativado no expediente → "O prestador não atende nesse dia."
- fora do expediente/intervalo → "Escolha um horário dentro do expediente do prestador."

---

### 3. Campos Obrigatórios

Se faltar algum campo obrigatório:

```json
{
  "erro": "Campos obrigatórios: nome_cliente, servico, data, horario"
}
```

---

### 4. Formato de Data Inválido

```
Data deve estar em formato: YYYY-MM-DD
Exemplo correto: 2024-04-20

Resposta de erro:
{
  "erro": "Formato de data inválido. Use YYYY-MM-DD (ex: 2024-03-20)"
}
```

---

### 5. Formato de Horário Inválido

```
Hora deve estar em formato: HH:MM
Exemplo correto: 14:30

Resposta de erro:
{
  "erro": "Formato de horário inválido. Use HH:MM (ex: 14:30)"
}
```

---

### 6. Telefone Inválido

```
Telefone deve ter entre 10 e 11 dígitos

Resposta de erro:
{
  "erro": "Telefone inválido. Deve ter entre 10 e 11 dígitos"
}
```

---

### 7. Status Válidos

Os status permitidos são:

- `agendado` (padrão)
- `confirmado`
- `cancelado`
- `concluido`

Se enviar outro status:
```json
{
  "erro": "Status inválido. Use: agendado, confirmado, cancelado, concluido"
}
```

---

## 🔄 HTTP STATUS CODES

| Código | Significado | Quando ocorre |
|--------|-------------|---------------|
| 200 | OK | GET, PUT, DELETE com sucesso |
| 201 | Created | POST com sucesso (criado novo) |
| 400 | Bad Request | Validação falhou (campos inválidos) |
| 401 | Unauthorized | Escrita sem sessão (`Login necessário.`) |
| 404 | Not Found | ID não encontrado (ou serviço de outro dono) |
| 409 | Conflict | Horário ocupado / e-mail já cadastrado |
| 500 | Server Error | Erro interno (genérico, detalhes só no log) |

---

##  EXEMPLOS EM JAVASCRIPT (para o Frontend)

> Mesma origem = cookies automáticos. Em escrita, trate o `401` chamando `exigirLogin()` (ver `ui.js`).

### Entrar e escrever logado

```javascript
const r = await entrarConta(email, senha); // POST /api/auth/login
if (!r.sucesso) { erroBox.textContent = r.erro; return; }
salvarSessaoLocal(r.usuario);
window.location.href = voltarAposLogin('busca.html');

const ag = await criarAgendamento(dados); // POST /agendamentos (🔒)
if (ag.naoAutenticado) { exigirLogin('login-cliente.html'); return; }
```

---

### Criar Agendamento

```javascript
const criarAgendamento = async (dados) => {
  try {
    const response = await fetch('http://localhost:3000/agendamentos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(' Sucesso:', result.mensagem);
      return result;
    } else {
      console.error(' Erro:', result.erro);
      return null;
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
  }
};

// Uso:
criarAgendamento({
  nome_cliente: "João Silva",
  servico: "Corte de Cabelo",
  data: "2024-04-20",
  horario: "14:00",
  telefone: "(11) 98765-4321"
});
```

---

### Listar Agendamentos

```javascript
const listarAgendamentos = async () => {
  try {
    const response = await fetch('http://localhost:3000/agendamentos');
    const data = await response.json();

    if (response.ok) {
      console.log(`Total: ${data.total} agendamentos`);
      console.log(data.agendamentos);
      return data.agendamentos;
    }
  } catch (error) {
    console.error('Erro:', error);
  }
};
```

---

### Atualizar Agendamento

```javascript
const atualizarAgendamento = async (id, dados) => {
  try {
    const response = await fetch(`http://localhost:3000/agendamentos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(' Atualizado:', result.mensagem);
    } else {
      console.error(' Erro:', result.erro);
    }
  } catch (error) {
    console.error('Erro:', error);
  }
};
```

---

### Deletar Agendamento

```javascript
const deletarAgendamento = async (id) => {
  try {
    const response = await fetch(`http://localhost:3000/agendamentos/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (response.ok) {
      console.log(' Deletado:', result.mensagem);
    } else {
      console.error(' Erro:', result.erro);
    }
  } catch (error) {
    console.error('Erro:', error);
  }
};
```

---

##  TESTANDO COM POSTMAN

1. Abra o Postman
2. Use os exemplos acima (copie a URL e o Body)
3. Configure o método (POST, GET, PUT, DELETE)
4. Mude o Content-Type para JSON
5. Clique em Send
6. Veja a resposta

---

##  CHECKLIST 

- [ ] API está rodando (`PORT=3000 node Backend/server.js`)
- [ ] Escrita sem login dá 401; com login funciona
- [ ] Consegue listar agendamentos (GET /agendamentos)
- [ ] Consegue criar agendamento (POST /agendamentos)
- [ ] Consegue atualizar agendamento (PUT /agendamentos/:id)
- [ ] Consegue deletar agendamento (DELETE /agendamentos/:id)
- [ ] Validações estão funcionando
- [ ] Interface conecta na API
- [ ] Dados aparecem na tabela
- [ ] Botões de editar e deletar funcionam

---

##  Erros e como resolver

### "Erro: Cannot fetch from localhost:3000"
- Verifique se o servidor está rodando
- Execute: `PORT=3000 node Backend/server.js`

### "erro: Login necessário." (401)
- A rota de escrita exige sessão: chame `exigirLogin()` antes ou faça login

### Conflito de horário (409)
- `Já existe um agendamento...` → ofereça outro horário (não é erro de código)

### "erro: Não é possível agendar em datas passadas"
- Use uma data no futuro
- Formato: YYYY-MM-DD (ex: 2024-04-25)

### "erro: Já existe um agendamento para..."
- Escolha outro horário
- Ou escolha outro dia
- Não pode ter 2 agendamentos no mesmo dia e hora

### "erro: Campos obrigatórios..."
- Preencha todos os campos (nome, serviço, data, horário)
- Telefone é opcional

---