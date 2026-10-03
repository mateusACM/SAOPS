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
        endereco: u.endereco || null
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

    if (!nome || !nome.trim()) return res.status(400).json({ sucesso: false, erro: 'Informe seu nome.' });
    if (!EMAIL_REGEX.test(emailNorm)) return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (!senha || senha.length < 8) return res.status(400).json({ sucesso: false, erro: 'A senha deve ter ao menos 8 caracteres.' });
    if (senha.length > 72) return res.status(400).json({ sucesso: false, erro: 'A senha deve ter no máximo 72 caracteres.' });
    if (telefone && !validarTelefoneLocal(telefone)) return res.status(400).json({ sucesso: false, erro: 'Telefone inválido. Deve ter entre 10 e 11 dígitos.' });

    const tipoFinal = tipo === 'empresa' ? 'empresa' : 'cliente';
    const categoriaFinal = String(categoria || '').trim().slice(0, 60) || null;
    const enderecoFinal = String(endereco || '').trim().slice(0, 200) || null;

    try {
        const existe = await qGet('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
        if (existe) return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com este e-mail.' });

        const hash = await bcrypt.hash(senha, 10);
        // e-mail já é UNIQUE no banco: corrida aqui vira 409
        const novo = await q(
            'INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo, categoria, endereco) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [nome.trim(), emailNorm, hash, telefone || null, tipoFinal, categoriaFinal, enderecoFinal]
        );
        criarSessao(req, res, novo.rows[0]);
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
    const { nome, categoria, endereco } = req.body || {};
    const nomeFinal = String(nome || '').trim();
    const categoriaFinal = String(categoria || '').trim().slice(0, 60) || null;
    const enderecoFinal = String(endereco || '').trim().slice(0, 200) || null;
    if (!nomeFinal) return res.status(400).json({ sucesso: false, erro: 'Informe o nome do negócio.' });
    if (nomeFinal.length > 120) return res.status(400).json({ sucesso: false, erro: 'Nome muito longo (máx. 120).' });
    try {
        const novo = await q(
            'UPDATE usuarios SET nome = $1, categoria = $2, endereco = $3 WHERE id = $4 RETURNING *',
            [nomeFinal, categoriaFinal, enderecoFinal, req.usuario.id]
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
