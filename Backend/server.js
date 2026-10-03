// Importa as bibliotecas
// variáveis de Backend/.env (local) — no Render vêm do dashboard
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { q, qGet, qAll } = require('./database'); // helpers do PostgreSQL
const rateLimit = require('express-rate-limit');
const { exigirLogin } = require('./auth'); // escrita exige sessão (401 senão)

// Id de rota precisa ser numérico (no SQLite não achava e dava 404;
// no PostgreSQL um valor não numérico daria erro de tipo -> guardamos antes)
const idInvalido = (v) => !/^\d{1,18}$/.test(String(v));

// Resposta única de erro interno (nunca vaza o detalhe do banco)
const erro500 = (res, e) => {
    console.error('Erro interno:', e.message);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
};

// Freio contra força bruta no login/cadastro/OAuth (100 tentativas / 15 min por IP)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { sucesso: false, erro: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

// Cria o aplicativo Express
const app = express();
const PORT = process.env.PORT || 3000; // Porta onde o servidor vai rodar

// Confia no proxy do Render (para req.secure / cookies secure)
app.set('trust proxy', 1);

// Libera CORS para o frontend (Live Server, file://, outras portas)
app.use(cors());

// Configura o Express para entender JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve o frontend estático (Frontend/Paginas como raiz + /js e /CSS)
app.use(express.static(path.join(__dirname, '..', 'Frontend', 'Paginas')));
app.use('/js', express.static(path.join(__dirname, '..', 'Frontend', 'js')));
app.use('/CSS', express.static(path.join(__dirname, '..', 'Frontend', 'CSS')));
app.use('/img', express.static(path.join(__dirname, '..', 'Frontend', 'img')));


// ========================================
// FUNÇÕES DE VALIDAÇÃO
// ========================================

// Status aceitos em todo o sistema
const STATUS_VALIDOS = ['agendado', 'confirmado', 'cancelado', 'concluido'];

// Valida formato de data (YYYY-MM-DD) e rejeita datas impossíveis (ex: 2024-02-30)
function validarData(data) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(data)) return false;

    const [ano, mes, dia] = data.split('-').map(Number);
    const date = new Date(ano, mes - 1, dia);
    return date.getFullYear() === ano && date.getMonth() === mes - 1 && date.getDate() === dia;
}

// Converte YYYY-MM-DD em data local (evita o parse UTC que quebra o "hoje" no Brasil)
function parseDataLocal(data) {
    const [ano, mes, dia] = data.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
}

// Valida formato de horário (HH:MM)
function validarHorario(horario) {
    const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    return regex.test(horario);
}

// Valida se data+hora não estão no passado (fuso local do servidor)
function validarDataHoraFutura(data, horario) {
    const [a, m, d] = data.split('-').map(Number);
    const [h, mi] = horario.split(':').map(Number);
    return new Date(a, m - 1, d, h, mi) >= new Date();
}

// Valida se a data não é no passado (comparação em datas locais)
function validarDataFutura(data) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera as horas para comparar só a data

    return parseDataLocal(data) >= hoje;
}

// Valida telefone (mínimo 10 dígitos)
function validarTelefone(telefone) {
    if (!telefone) return true; // Telefone é opcional
    
    const numeros = telefone.replace(/\D/g, ''); // Remove tudo que não é número
    return numeros.length >= 10 && numeros.length <= 11;
}

// ========================================
// ROTAS DO CRUD
// ========================================

// ROTA DE SAÚDE (JSON) — o "/" serve o index.html estático,
// então o teste da API fica aqui
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', mensagem: 'SAOPS ativo.' });
});

// ========================================
// CREATE - Criar novo agendamento (COM VALIDAÇÕES!)
// ========================================
app.post('/agendamentos', exigirLogin, async (req, res) => {
    const { nome_cliente, servico, data, horario, telefone, status } = req.body;

    // VALIDAÇÃO 1: Campos obrigatórios
    if (!nome_cliente || !servico || !data || !horario) {
        return res.status(400).json({ 
            erro: 'Campos obrigatórios: nome_cliente, servico, data, horario' 
        });
    }

    // VALIDAÇÃO 2: Formato da data
    if (!validarData(data)) {
        return res.status(400).json({ 
            erro: 'Formato de data inválido. Use YYYY-MM-DD (ex: 2024-03-20)' 
        });
    }

    // VALIDAÇÃO 3: Formato do horário
    if (!validarHorario(horario)) {
        return res.status(400).json({ 
            erro: 'Formato de horário inválido. Use HH:MM (ex: 14:30)' 
        });
    }

    // VALIDAÇÃO 4: Não permitir agendamento no passado (data + hora)
    if (!validarDataHoraFutura(data, horario)) {
        return res.status(400).json({
            erro: 'Não é possível agendar em data/horário passados'
        });
    }

    // VALIDAÇÃO 4b: Tamanho máximo (evita strings gigantes no banco)
    if (String(nome_cliente).length > 120 || String(servico).length > 200) {
        return res.status(400).json({
            erro: 'Nome (máx. 120) ou serviço (máx. 200) muito longos'
        });
    }

    // VALIDAÇÃO 5: Telefone (se fornecido)
    if (!validarTelefone(telefone)) {
        return res.status(400).json({ 
            erro: 'Telefone inválido. Deve ter entre 10 e 11 dígitos' 
        });
    }

    // VALIDAÇÃO 6: Status válido (se fornecido)
    const statusFinal = (status || 'agendado').toLowerCase();
    if (!STATUS_VALIDOS.includes(statusFinal)) {
        return res.status(400).json({
            erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}`
        });
    }

    // VALIDAÇÃO 7: Verificar se já existe agendamento no mesmo horário
    try {
        const existente = await qGet('SELECT * FROM agendamentos WHERE data = $1 AND horario = $2', [data, horario]);

        if (existente) {
            return res.status(409).json({
                erro: `Já existe um agendamento para ${data} às ${horario}. Escolha outro horário.`
            });
        }

        // Se passou em todas as validações, insere no banco
        const sql = `INSERT INTO agendamentos (nome_cliente, servico, data, horario, telefone, status, usuario_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;

        const criado = await q(sql, [String(nome_cliente).trim(), String(servico).trim(), data, horario, telefone || null, statusFinal, req.usuario.id]);
        res.status(201).json({ 
            mensagem: ' Agendamento criado com sucesso!',
            id: criado.rows[0].id,
            detalhes: {
                nome_cliente,
                servico,
                data,
                horario,
                status: statusFinal
            }
        });
    } catch (e) {
        if (e.code === '23505') { // corrida: outro request pegou o horário primeiro
            return res.status(409).json({
                erro: `Já existe um agendamento para ${data} às ${horario}. Escolha outro horário.`
            });
        }
        erro500(res, e);
    }
});


// READ - Listar todos os agendamentos

app.get('/agendamentos', async (req, res) => {
    // PEGAR OS PARÂMETROS DA URL
    const sort = req.query.sort || 'id';      // Padrão: ordenar por ID
    const order = req.query.order || 'asc';   // Padrão: crescente

    // VALIDAR O CAMPO DE ORDENAÇÃO
    const campos_permitidos = ['id', 'nome_cliente', 'data', 'horario', 'servico', 'status'];
    
    if (!campos_permitidos.includes(sort)) {
        return res.status(400).json({ 
            erro: 'Campo de ordenação inválido. Permitidos: ' + campos_permitidos.join(', ')
        });
    }

    // VALIDAR A DIREÇÃO DE ORDENAÇÃO
    if (order !== 'asc' && order !== 'desc') {
        return res.status(400).json({ 
            erro: 'Order deve ser "asc" (crescente) ou "desc" (decrescente)'
        });
    }

    // MONTAR A QUERY COM ORDENAÇÃO
    const query = `SELECT * FROM agendamentos ORDER BY ${sort} ${order.toUpperCase()}`;

    // EXECUTAR A QUERY
    try {
        const rows = await qAll(query);
        res.json({
            mensagem: ' Lista de agendamentos',
            total: rows.length,
            ordenado_por: sort,
            ordem: order,
            agendamentos: rows
        });
    } catch (e) { erro500(res, e); }
});

// ROTA NOVA: Ordenação por parâmetros na URL 
app.get('/agendamentos/sorted/:field/:order', async (req, res) => {
    // PEGAR OS PARÂMETROS DA URL
    const field = req.params.field;    // Ex: horario, nome_cliente, data
    const order = req.params.order;    // Ex: asc, desc

    // VALIDAR O CAMPO DE ORDENAÇÃO
    const campos_permitidos = ['id', 'nome_cliente', 'data', 'horario', 'servico', 'status'];
    
    if (!campos_permitidos.includes(field)) {
        return res.status(400).json({ 
            erro: 'Campo inválido. Permitidos: ' + campos_permitidos.join(', ')
        });
    }

    // VALIDAR A DIREÇÃO DE ORDENAÇÃO
    if (order !== 'asc' && order !== 'desc') {
        return res.status(400).json({ 
            erro: 'Ordem deve ser "asc" ou "desc"'
        });
    }

    // MONTAR A QUERY COM ORDENAÇÃO
    const query = `SELECT * FROM agendamentos ORDER BY ${field} ${order.toUpperCase()}`;

    // EXECUTAR A QUERY
    try {
        const rows = await qAll(query);
        res.json({
            mensagem: ' Lista ordenada de agendamentos',
            total: rows.length,
            campo: field,
            ordem: order,
            agendamentos: rows
        });
    } catch (e) { erro500(res, e); }
});

// READ - Meus agendamentos (só os da conta logada)
// Precisa vir ANTES de /agendamentos/:id senão "meus" vira um id

app.get('/agendamentos/meus', exigirLogin, async (req, res) => {
    try {
        const nome = String(req.usuario.nome || '').trim();
        const rows = await qAll(
            `SELECT * FROM agendamentos
             WHERE usuario_id = $1 OR lower(nome_cliente) = lower($2)
             ORDER BY data, horario`,
            [req.usuario.id, nome]
        );
        res.json({
            mensagem: ' Meus agendamentos',
            total: rows.length,
            agendamentos: rows
        });
    } catch (e) { erro500(res, e); }
});

// READ - Buscar agendamento por ID

app.get('/agendamentos/:id', async (req, res) => {
    const { id } = req.params;
    if (idInvalido(id)) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    try {
        const row = await qGet('SELECT * FROM agendamentos WHERE id = $1', [id]);
        if (!row) {
            return res.status(404).json({ erro: 'Agendamento não encontrado' });
        }
        res.json(row);
    } catch (e) { erro500(res, e); }
});

// READ - Buscar agendamentos por data

app.get('/agendamentos/data/:data', async (req, res) => {
    const { data } = req.params;
    
    // Valida formato da data
    if (!validarData(data)) {
        return res.status(400).json({ 
            erro: 'Formato de data inválido. Use YYYY-MM-DD' 
        });
    }
    
    try {
        const rows = await qAll('SELECT * FROM agendamentos WHERE data = $1 ORDER BY horario', [data]);
        res.json({
            mensagem: ` Agendamentos para ${data}`,
            total: rows.length,
            agendamentos: rows
        });
    } catch (e) { erro500(res, e); }
});


// UPDATE - Atualizar agendamento 


app.put('/agendamentos/:id', exigirLogin, async (req, res) => {
    const { id } = req.params;
    const { nome_cliente, servico, data, horario, telefone, status } = req.body;
    if (idInvalido(id)) return res.status(404).json({ erro: 'Agendamento não encontrado' });

    // VALIDAÇÃO 1: Campos obrigatórios
    if (!nome_cliente || !servico || !data || !horario) {
        return res.status(400).json({
            erro: 'Campos obrigatórios: nome_cliente, servico, data, horario'
        });
    }

    // VALIDAÇÃO 2: Formato da data
    if (!validarData(data)) {
        return res.status(400).json({
            erro: 'Formato de data inválido. Use YYYY-MM-DD'
        });
    }

    // VALIDAÇÃO 3: Formato do horário
    if (!validarHorario(horario)) {
        return res.status(400).json({
            erro: 'Formato de horário inválido. Use HH:MM'
        });
    }

    // VALIDAÇÃO 4: Telefone
    if (!validarTelefone(telefone)) {
        return res.status(400).json({
            erro: 'Telefone inválido. Deve ter entre 10 e 11 dígitos'
        });
    }

    // VALIDAÇÃO 5: Status válido (normalizado em minúsculas)
    const statusFinal = (status || 'agendado').toLowerCase();
    if (!STATUS_VALIDOS.includes(statusFinal)) {
        return res.status(400).json({
            erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}`
        });
    }

    // Busca o registro atual: data passada só pode mudar de status,
    // e a checagem de conflito só importa se dia/horário mudaram
    try {
        const atual = await qGet('SELECT data, horario FROM agendamentos WHERE id = $1', [id]);
        if (!atual) {
            return res.status(404).json({ erro: 'Agendamento não encontrado' });
        }

        const mudouQuando = data !== atual.data || horario !== atual.horario;
        if (mudouQuando && !validarDataHoraFutura(data, horario)) {
            return res.status(400).json({
                erro: 'Não é possível reagendar para data/horário passados'
            });
        }

        // Verifica se já existe outro agendamento no mesmo horário (exceto o próprio)
        if (mudouQuando) {
            const conflito = await qGet(
                'SELECT * FROM agendamentos WHERE data = $1 AND horario = $2 AND id != $3',
                [data, horario, id]
            );
            if (conflito) {
                return res.status(409).json({
                    erro: `Já existe outro agendamento para ${data} às ${horario}`
                });
            }
        }

        const sql = `UPDATE agendamentos
                     SET nome_cliente = $1, servico = $2, data = $3, horario = $4, telefone = $5, status = $6
                     WHERE id = $7`;

        await q(sql, [nome_cliente, servico, data, horario, telefone || null, statusFinal, id]);
        res.json({
            mensagem: ' Agendamento atualizado com sucesso!',
            detalhes: {
                id,
                nome_cliente,
                data,
                horario,
                status: statusFinal
            }
        });
    } catch (e) {
        if (e.code === '23505') { // corrida no índice único data+horario
            return res.status(409).json({
                erro: `Já existe outro agendamento para ${data} às ${horario}`
            });
        }
        erro500(res, e);
    }
});

// DELETE - Deletar agendamento

app.delete('/agendamentos/:id', exigirLogin, async (req, res) => {
    const { id } = req.params;
    if (idInvalido(id)) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    try {
        const r = await q('DELETE FROM agendamentos WHERE id = $1', [id]);
        if (r.rowCount === 0) {
            return res.status(404).json({ erro: 'Agendamento não encontrado' });
        }
        res.json({ 
            mensagem: ' Agendamento deletado com sucesso!',
            id_deletado: id
        });
    } catch (e) { erro500(res, e); }
});


// ========================================
// TAREFAS DO DIA A DIA
// ========================================

const CATEGORIAS_TAREFA = ['pessoal', 'casa', 'trabalho', 'estudos', 'saude', 'outro'];

// LISTAR tarefas (opcional ?data= e ?concluido=0|1)
app.get('/tarefas', async (req, res) => {
    const { data, concluido } = req.query;
    if (data && !validarData(data)) {
        return res.status(400).json({ erro: 'Formato de data inválido. Use YYYY-MM-DD' });
    }

    const filtros = [];
    const params = [];
    if (data) { filtros.push(`data = $${params.length + 1}`); params.push(data); }
    if (concluido === '0' || concluido === '1') { filtros.push(`concluido = $${params.length + 1}`); params.push(Number(concluido)); }

    const where = filtros.length ? ' WHERE ' + filtros.join(' AND ') : '';
    const sql = `SELECT * FROM tarefas${where} ORDER BY data ASC,
                 CASE WHEN hora IS NULL OR hora = '' THEN 1 ELSE 0 END, hora ASC`;

    try {
        const rows = await qAll(sql, params);
        res.json({ mensagem: ' Lista de tarefas', total: rows.length, tarefas: rows });
    } catch (e) { erro500(res, e); }
});

// BUSCAR tarefa por ID
app.get('/tarefas/:id', async (req, res) => {
    if (idInvalido(req.params.id)) return res.status(404).json({ erro: 'Tarefa não encontrada' });
    try {
        const row = await qGet('SELECT * FROM tarefas WHERE id = $1', [req.params.id]);
        if (!row) return res.status(404).json({ erro: 'Tarefa não encontrada' });
        res.json(row);
    } catch (e) { erro500(res, e); }
});

// CRIAR tarefa
app.post('/tarefas', exigirLogin, async (req, res) => {
    const { titulo, data, hora, categoria } = req.body;

    if (!titulo || !String(titulo).trim()) {
        return res.status(400).json({ erro: 'Campo obrigatório: titulo' });
    }
    if (!data) {
        return res.status(400).json({ erro: 'Campo obrigatório: data' });
    }
    if (!validarData(data)) {
        return res.status(400).json({ erro: 'Formato de data inválido. Use YYYY-MM-DD' });
    }
    if (hora && !validarHorario(hora)) {
        return res.status(400).json({ erro: 'Formato de horário inválido. Use HH:MM' });
    }
    const cat = (categoria || 'pessoal').toLowerCase();
    if (!CATEGORIAS_TAREFA.includes(cat)) {
        return res.status(400).json({ erro: `Categoria inválida. Use: ${CATEGORIAS_TAREFA.join(', ')}` });
    }

    const sql = 'INSERT INTO tarefas (titulo, data, hora, categoria) VALUES ($1, $2, $3, $4) RETURNING id';
    try {
        const criado = await q(sql, [String(titulo).trim(), data, hora || null, cat]);
        res.status(201).json({
            mensagem: ' Tarefa criada com sucesso!',
            id: criado.rows[0].id,
            detalhes: { titulo: String(titulo).trim(), data, hora: hora || null, categoria: cat }
        });
    } catch (e) { erro500(res, e); }
});

// ATUALIZAR tarefa (título, data, hora, categoria, concluido)
app.put('/tarefas/:id', exigirLogin, async (req, res) => {
    const { id } = req.params;
    const { titulo, data, hora, categoria, concluido } = req.body;
    if (idInvalido(id)) return res.status(404).json({ erro: 'Tarefa não encontrada' });

    try {
        const row = await qGet('SELECT * FROM tarefas WHERE id = $1', [id]);
        if (!row) return res.status(404).json({ erro: 'Tarefa não encontrada' });

        const novoTitulo = titulo === undefined ? row.titulo : String(titulo).trim();
        const novaData = data === undefined ? row.data : data;
        const novaHora = hora === undefined ? row.hora : (hora || null);
        const novaCat = categoria === undefined ? row.categoria : String(categoria).toLowerCase();
        const novoConcluido = concluido === undefined ? row.concluido : ((concluido === 1 || concluido === true || concluido === '1') ? 1 : 0);

        if (!novoTitulo) return res.status(400).json({ erro: 'Título não pode ficar vazio' });
        if (!validarData(novaData)) return res.status(400).json({ erro: 'Formato de data inválido. Use YYYY-MM-DD' });
        if (novaHora && !validarHorario(novaHora)) return res.status(400).json({ erro: 'Formato de horário inválido. Use HH:MM' });
        if (!CATEGORIAS_TAREFA.includes(novaCat)) {
            return res.status(400).json({ erro: `Categoria inválida. Use: ${CATEGORIAS_TAREFA.join(', ')}` });
        }

        const sql = `UPDATE tarefas SET titulo = $1, data = $2, hora = $3, categoria = $4, concluido = $5 WHERE id = $6`;
        await q(sql, [novoTitulo, novaData, novaHora, novaCat, novoConcluido, id]);
        res.json({
            mensagem: ' Tarefa atualizada com sucesso!',
            detalhes: { id, titulo: novoTitulo, data: novaData, hora: novaHora, categoria: novaCat, concluido: novoConcluido }
        });
    } catch (e) { erro500(res, e); }
});

// DELETAR tarefa (escrita exige login, como as demais)
app.delete('/tarefas/:id', exigirLogin, async (req, res) => {
    if (idInvalido(req.params.id)) return res.status(404).json({ erro: 'Tarefa não encontrada' });
    try {
        const r = await q('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ erro: 'Tarefa não encontrada' });
        res.json({ mensagem: ' Tarefa excluída com sucesso!', id_deletado: req.params.id });
    } catch (e) { erro500(res, e); }
});


// ========================================
// SERVIÇOS DO PRESTADOR
// ========================================

function validarServico({ nome, descricao, preco, duracao_min }) {
    if (!nome || !String(nome).trim()) return 'Campo obrigatório: nome';
    if (String(nome).trim().length > 120) return 'Nome muito longo (máx. 120 caracteres)';
    if (descricao && String(descricao).length > 500) return 'Descrição muito longa (máx. 500 caracteres)';
    if (preco !== undefined && preco !== null && preco !== '') {
        const p = Number(preco);
        if (!Number.isFinite(p) || p < 0) return 'Preço inválido (deve ser um número ≥ 0)';
    }
    if (duracao_min !== undefined && duracao_min !== null && duracao_min !== '') {
        const d = Number(duracao_min);
        if (!Number.isInteger(d) || d <= 0) return 'Duração inválida (minutos inteiros > 0)';
    }
    return null;
}

function normalizarServico({ nome, descricao, preco, duracao_min }) {
    const nuloSeVazio = (v) => (v === undefined || v === null || v === '' ? null : v);
    return {
        nome: String(nome).trim(),
        descricao: descricao ? String(descricao).trim() : null,
        preco: nuloSeVazio(preco) === null ? null : Number(preco),
        duracao_min: nuloSeVazio(duracao_min) === null ? null : Number(duracao_min)
    };
}

// LISTAR todos (público — vitrine)
app.get('/servicos', async (req, res) => {
    try {
        const rows = await qAll('SELECT s.*, u.nome AS prestador FROM servicos s JOIN usuarios u ON u.id = s.usuario_id ORDER BY s.nome');
        res.json({ mensagem: ' Lista de serviços', total: rows.length, servicos: rows });
    } catch (e) { erro500(res, e); }
});

// LISTAR os meus (dono logado)
app.get('/servicos/meus', exigirLogin, async (req, res) => {
    try {
        const rows = await qAll('SELECT * FROM servicos WHERE usuario_id = $1 ORDER BY nome', [req.usuario.id]);
        res.json({ mensagem: ' Meus serviços', total: rows.length, servicos: rows });
    } catch (e) { erro500(res, e); }
});

// CRIAR (dono = usuário logado)
app.post('/servicos', exigirLogin, async (req, res) => {
    const erro = validarServico(req.body || {});
    if (erro) return res.status(400).json({ erro });
    const n = normalizarServico(req.body);
    try {
        const criado = await q(
            'INSERT INTO servicos (usuario_id, nome, descricao, preco, duracao_min) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [req.usuario.id, n.nome, n.descricao, n.preco, n.duracao_min]
        );
        res.status(201).json({
            mensagem: ' Serviço criado com sucesso!',
            id: criado.rows[0].id,
            detalhes: { id: criado.rows[0].id, ...n }
        });
    } catch (e) { erro500(res, e); }
});

// ATUALIZAR (só o dono; de outro dono dá 404 para não revelar existência)
app.put('/servicos/:id', exigirLogin, async (req, res) => {
    if (idInvalido(req.params.id)) return res.status(404).json({ erro: 'Serviço não encontrado' });
    const erro = validarServico(req.body || {});
    if (erro) return res.status(400).json({ erro });
    const n = normalizarServico(req.body);
    try {
        const r = await q(
            'UPDATE servicos SET nome = $1, descricao = $2, preco = $3, duracao_min = $4 WHERE id = $5 AND usuario_id = $6',
            [n.nome, n.descricao, n.preco, n.duracao_min, req.params.id, req.usuario.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ erro: 'Serviço não encontrado' });
        res.json({ mensagem: ' Serviço atualizado com sucesso!', detalhes: { id: Number(req.params.id), ...n } });
    } catch (e) { erro500(res, e); }
});

// DELETAR (só o dono)
app.delete('/servicos/:id', exigirLogin, async (req, res) => {
    if (idInvalido(req.params.id)) return res.status(404).json({ erro: 'Serviço não encontrado' });
    try {
        const r = await q('DELETE FROM servicos WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
        if (r.rowCount === 0) return res.status(404).json({ erro: 'Serviço não encontrado' });
        res.json({ mensagem: ' Serviço excluído com sucesso!', id_deletado: req.params.id });
    } catch (e) { erro500(res, e); }
});


// Autenticação (cadastro/login/sessão/OAuth) — precisa vir antes das
// rotas amigáveis e do 404 de /api
app.use('/api/auth', authLimiter, require('./auth'));

// URLs amigáveis sem .html (ex: /calendario -> calendario.html)
// Fica DEPOIS das rotas da API para não conflitar com elas
app.get('/:pagina', (req, res, next) => {
    const nome = req.params.pagina;
    if (!/^[a-z0-9-]+$/i.test(nome)) return next();
    const arquivo = path.join(__dirname, '..', 'Frontend', 'Paginas', `${nome}.html`);
    res.sendFile(arquivo, (err) => {
        if (err) {
            // Página inexistente: serve o erro.html com status 404 real (SEO)
            const erroPage = path.join(__dirname, '..', 'Frontend', 'Paginas', 'erro.html');
            res.status(404).sendFile(erroPage, (e2) => { if (e2) next(); });
        }
    });
});

// 404 JSON para rotas da API não encontradas
app.use('/agendamentos', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use('/tarefas', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

// 404 JSON para rotas de serviços desconhecidas
app.use('/servicos', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

// 404 JSON para /api/* desconhecidas
app.use('/api', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

// 404 HTML para qualquer outra rota inexistente (ex: /qualquer/coisa)
app.use((req, res, next) => {
    const erroPage = path.join(__dirname, '..', 'Frontend', 'Paginas', 'erro.html');
    res.status(404).sendFile(erroPage, (e) => { if (e) next(e); });
});

// Middleware genérico de erro (nunca expõe stack ao cliente)
app.use((err, req, res, next) => {
    console.error('Erro interno:', err);
    const status = err.status || err.statusCode || 500;
    if (status >= 400 && status < 500) {
        return res.status(status).json({ erro: err.message || 'Requisição inválida' });
    }
    res.status(500).json({ erro: 'Erro interno do servidor' });
});


// Inicia o servidor

app.listen(PORT, () => {
    console.log(` Servidor rodando em http://localhost:${PORT}`);
    console.log(` Acesse http://localhost:${PORT}/agendamentos para ver os dados`);
    console.log(` Sistema com validações ativadas!`);
});
