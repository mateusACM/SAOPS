// ==========================================
// AUTH.JS - cadastro, login, sessão e OAuth
// (Google) via /api/auth/*
// ==========================================
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { q, qGet, qAll, AGORA_SQL } = require('./database');

const router = express.Router();

const COOKIE = 'saops_token';
const SESSAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DISPONIBILIDADE_PADRAO = {
    intervalo_min: 30,
    dom: { ativo: false, inicio: '09:00', fim: '17:00' },
    seg: { ativo: true, inicio: '09:00', fim: '17:00' },
    ter: { ativo: true, inicio: '09:00', fim: '17:00' },
    qua: { ativo: true, inicio: '09:00', fim: '17:00' },
    qui: { ativo: true, inicio: '09:00', fim: '17:00' },
    sex: { ativo: true, inicio: '09:00', fim: '17:00' },
    sab: { ativo: false, inicio: '09:00', fim: '17:00' }
};

function normalizarDisponibilidade(valor) {
    if (!valor || typeof valor !== 'object') return { sucesso: true, dados: DISPONIBILIDADE_PADRAO };
    const intervalo = Number(valor.intervalo_min);
    if (![15, 30, 60].includes(intervalo)) return { sucesso: false, erro: 'Escolha um intervalo de 15, 30 ou 60 minutos.' };
    const saida = { intervalo_min: intervalo };
    for (const dia of DIAS_SEMANA) {
        const item = valor[dia] || {};
        if (typeof item.ativo !== 'boolean') return { sucesso: false, erro: 'Marque quais dias da semana atendem.' };
        const inicio = String(item.inicio || '09:00');
        const fim = String(item.fim || '17:00');
        const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(inicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(fim)) return { sucesso: false, erro: 'Confira os horários de abertura e encerramento.' };
        if (item.ativo && minutos(fim) <= minutos(inicio)) return { sucesso: false, erro: 'O encerramento precisa ser depois da abertura.' };
        saida[dia] = { ativo: Boolean(item.ativo), inicio, fim };
    }
    return { sucesso: true, dados: saida };
}

// Telefone opcional com 10 ou 11 dígitos (mesma regra dos agendamentos)
function validarTelefoneLocal(tel) {
    if (!tel) return true;
    const numeros = String(tel).replace(/\D/g, '');
    return numeros.length >= 10 && numeros.length <= 11;
}

// ---------- helpers ----------

function lerCookies(req) {
    const out = {};
    (req.headers.cookie || '').split(';').forEach((p) => {
        const i = p.indexOf('=');
        if (i <= 0) return;
        try {
            out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
        } catch (e) { /* cookie malformado: ignora */ }
    });
    return out;
}

async function criarSessao(req, res, usuario) {
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const expira = new Date(Date.now() + SESSAO_MS).toISOString();
        await q('INSERT INTO sessoes (token, usuario_id, expira_em) VALUES ($1, $2, $3)', [token, usuario.id, expira]);
        res.cookie(COOKIE, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: req.secure,
            maxAge: SESSAO_MS
        });
        res.json({ sucesso: true, usuario: publico(usuario) });
    } catch (e) {
        console.error('Erro interno:', e.message);
        res.status(500).json({ sucesso: false, erro: 'Falha ao criar sessão' });
    }
}

// Nunca devolve a senha para o cliente
function publico(u) {
    return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        tipo: u.tipo,
        provider: u.provider,
        foto: u.foto || null,
        categoria: u.categoria || null,
        endereco: u.endereco || null,
        bio: u.bio || null,
        anos_experiencia: u.anos_experiencia ?? null,
        instagram: u.instagram || null,
        disponibilidade: u.disponibilidade || DISPONIBILIDADE_PADRAO,
    };
}

async function usuarioAtual(req) {
    const token = lerCookies(req)[COOKIE];
    if (!token) return null;
    try {
        const row = await qGet(
            `SELECT u.* FROM sessoes s
             JOIN usuarios u ON u.id = s.usuario_id
             WHERE s.token = $1 AND s.expira_em > ${AGORA_SQL}`,
            [token]
        );
        return row || null;
    } catch (e) {
        console.error('Erro interno:', e.message);
        return null;
    }
}

// Middleware: escrita (POST/PUT/DELETE) exige sessão válida (401 senão)
async function exigirLogin(req, res, next) {
    const u = await usuarioAtual(req);
    if (!u) return res.status(401).json({ sucesso: false, erro: 'Login necessário.' });
    req.usuario = u;
    next();
}

// ---------- rotas locais ----------

// Config pública dos botões sociais (client IDs não são segredos)
router.get('/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});

router.post('/cadastro', async (req, res) => {
    const { nome, email, senha, telefone, tipo, categoria, endereco } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();
    const nomeFinal = String(nome || '').trim();

    if (!nomeFinal) return res.status(400).json({ sucesso: false, erro: 'Informe seu nome.' });
    if (nomeFinal.length > 120) return res.status(400).json({ sucesso: false, erro: 'O nome deve ter no máximo 120 caracteres.' });
    if (!EMAIL_REGEX.test(emailNorm)) return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (emailNorm.length > 254) return res.status(400).json({ sucesso: false, erro: 'O e-mail deve ter no máximo 254 caracteres.' });
    if (!senha || senha.length < 8) return res.status(400).json({ sucesso: false, erro: 'A senha deve ter ao menos 8 caracteres.' });
    if (Buffer.byteLength(String(senha), 'utf8') > 72) return res.status(400).json({ sucesso: false, erro: 'A senha deve ter no máximo 72 bytes.' });
    if (telefone && !validarTelefoneLocal(telefone)) return res.status(400).json({ sucesso: false, erro: 'Telefone inválido. Deve ter entre 10 e 11 dígitos.' });

    const tipoFinal = tipo === 'empresa' ? 'empresa' : 'cliente';
    const categoriaFinal = String(categoria || '').trim().slice(0, 60) || null;
    const enderecoFinal = String(endereco || '').trim().slice(0, 200) || null;
    if (tipoFinal === 'empresa') {
        if (!['barbearia', 'salao', 'clinica', 'outro'].includes(categoriaFinal)) return res.status(400).json({ sucesso: false, erro: 'Escolha uma categoria válida para o negócio.' });
        if (!enderecoFinal) return res.status(400).json({ sucesso: false, erro: 'Informe o endereço do negócio.' });
    }

    try {
        const existe = await qGet('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
        if (existe) return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com este e-mail.' });

        const hash = await bcrypt.hash(senha, 10);
        // e-mail já é UNIQUE no banco: corrida aqui vira 409
        const novo = await q(
            'INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo, categoria, endereco, disponibilidade) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [nomeFinal, emailNorm, hash, telefone ? String(telefone).trim() : null, tipoFinal, categoriaFinal, enderecoFinal, DISPONIBILIDADE_PADRAO]
        );
        return criarSessao(req, res, novo.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com este e-mail.' });
        console.error('Erro interno:', e.message);
        res.status(500).json({ sucesso: false, erro: 'Erro ao criar conta' });
    }
});

router.post('/login', async (req, res) => {
    const { email, senha, tipo } = req.body || {};
    const tipoConta = tipo === 'empresa' ? 'empresa' : 'cliente';
    const identificador = String(email || '').trim().toLowerCase();

    try {
        // Cliente entra com e-mail; prestador também pode usar o nome do negócio.
        const u = await qGet(
            `SELECT * FROM usuarios
             WHERE provider = 'local' AND tipo = $1
               AND (email = $2 OR ($1 = 'empresa' AND lower(nome) = $3))
             LIMIT 1`,
            [tipoConta, identificador, identificador]
        );
        if (!u || !u.senha_hash) return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });

        const ok = await bcrypt.compare(String(senha || ''), u.senha_hash);
        if (!ok) return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
        criarSessao(req, res, u);
    } catch (e) {
        console.error('Erro interno:', e.message);
        res.status(500).json({ sucesso: false, erro: 'Erro interno' });
    }
});

router.post('/logout', async (req, res) => {
    const token = lerCookies(req)[COOKIE];
    const limpar = () => {
        res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure });
        res.json({ sucesso: true });
    };
    if (token) {
        try { await q('DELETE FROM sessoes WHERE token = $1', [token]); } catch (e) { console.error('Erro interno:', e.message); }
    }
    limpar();
});

router.get('/eu', async (req, res) => {
    const u = await usuarioAtual(req);
    if (!u) return res.status(401).json({ sucesso: false, erro: 'Não autenticado' });
    res.json({ sucesso: true, usuario: publico(u) });
});

// Perfil do negócio: o prestador logado edita os próprios dados
router.put('/negocio', exigirLogin, async (req, res) => {
    if (req.usuario.tipo !== 'empresa') {
        return res.status(403).json({ sucesso: false, erro: 'Só prestadores têm perfil de negócio.' });
    }
    const { nome, categoria, endereco, bio, anos_experiencia, instagram } = req.body || {};
    const nomeFinal = String(nome || '').trim();
    const categoriaFinal = String(categoria || '').trim().slice(0, 60) || null;
    const enderecoFinal = String(endereco || '').trim().slice(0, 200) || null;
    const bioFinal = String(bio || '').trim();
    const experienciaFinal = anos_experiencia === '' || anos_experiencia == null ? null : Number(anos_experiencia);
    const instagramFinal = String(instagram || '').trim().replace(/^@/, '').toLowerCase() || null;
    if (!nomeFinal) return res.status(400).json({ sucesso: false, erro: 'Informe o nome do negócio.' });
    if (nomeFinal.length > 120) return res.status(400).json({ sucesso: false, erro: 'Nome muito longo (máx. 120).' });
    if (bioFinal.length > 800) return res.status(400).json({ sucesso: false, erro: 'A apresentação deve ter no máximo 800 caracteres.' });
    if (experienciaFinal !== null && (!Number.isInteger(experienciaFinal) || experienciaFinal < 0 || experienciaFinal > 80)) return res.status(400).json({ sucesso: false, erro: 'Informe anos de experiência entre 0 e 80.' });
    if (instagramFinal && !/^[a-z0-9._]{1,30}$/.test(instagramFinal)) return res.status(400).json({ sucesso: false, erro: 'Informe apenas o usuário do Instagram (até 30 letras, números, pontos ou _).' });
    const horario = req.body?.disponibilidade === undefined
        ? { sucesso: true, dados: req.usuario.disponibilidade || DISPONIBILIDADE_PADRAO }
        : normalizarDisponibilidade(req.body.disponibilidade);
    if (!horario.sucesso) return res.status(400).json({ sucesso: false, erro: horario.erro });
    try {
        const novo = await q(
            'UPDATE usuarios SET nome = $1, categoria = $2, endereco = $3, bio = $4, anos_experiencia = $5, instagram = $6, disponibilidade = $7 WHERE id = $8 RETURNING *',
            [nomeFinal, categoriaFinal, enderecoFinal, bioFinal || null, experienciaFinal, instagramFinal, horario.dados, req.usuario.id]
        );
        res.json({ sucesso: true, usuario: publico(novo.rows[0]) });
    } catch (e) {
        console.error('Erro interno:', e.message);
        res.status(500).json({ sucesso: false, erro: 'Erro interno' });
    }
});

// ---------- OAuth (Google) ----------

router.post('/oauth', async (req, res) => {
    const { provider, credential, nonce, tipo } = req.body || {};

    // 1) Valida a credencial no provedor (erros aqui = 401)
    let dados;
    try {
        if (provider === 'google') dados = await verificarGoogle(credential);
        else return res.status(400).json({ sucesso: false, erro: 'Provedor inválido.' });

        if (nonce && dados.nonce && nonce !== dados.nonce) {
            return res.status(401).json({ sucesso: false, erro: 'Nonce inválido.' });
        }
    } catch (e) {
        return res.status(401).json({ sucesso: false, erro: e.message || 'Falha ao validar o login social.' });
    }

    // 2) Procura por provider+id, depois por e-mail (vincula conta existente)
    try {
        const porProvider = await qGet('SELECT * FROM usuarios WHERE provider = $1 AND provider_id = $2', [provider, dados.id]);
        if (porProvider) return criarSessao(req, res, porProvider);

        const existente = await qGet('SELECT * FROM usuarios WHERE email = $1', [dados.email]);
        if (existente && !dados.emailVerificado) {
            return res.status(403).json({ sucesso: false, erro: 'E-mail já cadastrado. Entre com sua senha para vincular.' });
        }

        if (existente) {
            // Vincula a conta existente ao provedor
            await q(
                'UPDATE usuarios SET provider = $1, provider_id = $2, foto = COALESCE($3, foto) WHERE id = $4',
                [provider, dados.id, dados.foto || null, existente.id]
            );
            return criarSessao(req, res, { ...existente, provider, provider_id: dados.id, foto: dados.foto || existente.foto });
        }

        // Cria conta nova sem senha
        const novo = await q(
            'INSERT INTO usuarios (nome, email, provider, provider_id, foto, tipo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [dados.nome, dados.email, provider, dados.id, dados.foto || null, tipo === 'empresa' ? 'empresa' : 'cliente']
        );
        criarSessao(req, res, novo.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com este e-mail.' });
        console.error('Erro interno:', e.message);
        res.status(500).json({ sucesso: false, erro: 'Erro interno' });
    }
});

// Google: valida o JWT no endpoint oficial e confere a audiência
async function verificarGoogle(idToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('Login com Google não configurado no servidor.');
    if (!idToken) throw new Error('Credencial ausente.');

    const r = await fetchComTimeout('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!r.ok) throw new Error('Credencial do Google inválida ou expirada.');
    const info = await r.json();
    if (info.aud !== clientId) throw new Error('Audiência inválida.');
    if (info.iss !== 'https://accounts.google.com' && info.iss !== 'accounts.google.com') {
        throw new Error('Emissor inválido.');
    }
    if (!info.email) throw new Error('Google não retornou o e-mail.');
    // Só vincula contas com e-mail verificado (evita takeover por e-mail não confirmado)
    if (info.email_verified !== 'true' && info.email_verified !== true) {
        throw new Error('E-mail do Google não verificado.');
    }

    return {
        id: info.sub,
        email: info.email.toLowerCase(),
        emailVerificado: true,
        nome: info.name || info.email,
        foto: info.picture || null,
        nonce: info.nonce || null
    };
}

function fetchComTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

module.exports = router;
module.exports.exigirLogin = exigirLogin;
