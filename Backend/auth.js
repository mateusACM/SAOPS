// ==========================================
// AUTH.JS - cadastro, login, sessão e OAuth
// (Google e Microsoft) via /api/auth/*
// ==========================================
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { q, qGet, AGORA_SQL } = require('./database');

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
        foto: u.foto || null
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
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        microsoftClientId: process.env.MICROSOFT_CLIENT_ID || ''
    });
});

router.post('/cadastro', async (req, res) => {
    const { nome, email, senha, telefone, tipo } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();

    if (!nome || !nome.trim()) return res.status(400).json({ sucesso: false, erro: 'Informe seu nome.' });
    if (!EMAIL_REGEX.test(emailNorm)) return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (!senha || senha.length < 8) return res.status(400).json({ sucesso: false, erro: 'A senha deve ter ao menos 8 caracteres.' });
    if (senha.length > 72) return res.status(400).json({ sucesso: false, erro: 'A senha deve ter no máximo 72 caracteres.' });
    if (telefone && !validarTelefoneLocal(telefone)) return res.status(400).json({ sucesso: false, erro: 'Telefone inválido. Deve ter entre 10 e 11 dígitos.' });

    const tipoFinal = tipo === 'empresa' ? 'empresa' : 'cliente';

    try {
        const existe = await qGet('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
        if (existe) return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com este e-mail.' });

        const hash = await bcrypt.hash(senha, 10);
        // e-mail já é UNIQUE no banco: corrida aqui vira 409
        const novo = await q(
            'INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nome.trim(), emailNorm, hash, telefone || null, tipoFinal]
        );
        criarSessao(req, res, novo.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com este e-mail.' });
        console.error('Erro interno:', e.message);
        res.status(500).json({ sucesso: false, erro: 'Erro ao criar conta' });
    }
});

router.post('/login', async (req, res) => {
    const { email, senha } = req.body || {};
    const identificador = String(email || '').trim().toLowerCase();

    try {
        // Cliente entra com e-mail; prestador também aceita o nome do negócio
        const u = await qGet(
            `SELECT * FROM usuarios
             WHERE provider = 'local' AND tipo = 'empresa'
               AND (email = $1 OR lower(nome) = $2)
             UNION
             SELECT * FROM usuarios
             WHERE provider = 'local' AND tipo = 'cliente' AND email = $3
             LIMIT 1`,
            [identificador, identificador, identificador]
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

// ---------- OAuth (Google + Microsoft) ----------

router.post('/oauth', async (req, res) => {
    const { provider, credential, nonce } = req.body || {};

    // 1) Valida a credencial no provedor (erros aqui = 401)
    let dados;
    try {
        if (provider === 'google') dados = await verificarGoogle(credential);
        else if (provider === 'microsoft') dados = await verificarMicrosoft(credential, nonce);
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
            'INSERT INTO usuarios (nome, email, provider, provider_id, foto) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [dados.nome, dados.email, provider, dados.id, dados.foto || null]
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

// JWKS da Microsoft com cache de 1h + timeout (evita 1 HTTP por login)
let JWKS_CACHE = { chaves: [], expira: 0 };

async function buscarJWKS() {
    if (JWKS_CACHE.chaves.length && Date.now() < JWKS_CACHE.expira) return JWKS_CACHE.chaves;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
        const r = await fetch('https://login.microsoftonline.com/common/discovery/v2.0/keys', { signal: ctrl.signal });
        if (!r.ok) throw new Error('Falha ao consultar as chaves da Microsoft.');
        const jwks = await r.json();
        JWKS_CACHE = { chaves: jwks.keys || [], expira: Date.now() + 60 * 60 * 1000 };
        return JWKS_CACHE.chaves;
    } finally {
        clearTimeout(t);
    }
}

function fetchComTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Microsoft: valida assinatura RS256 do id_token via JWKS oficial + aud/iss/exp/nonce
async function verificarMicrosoft(token, nonceEsperado) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) throw new Error('Login com Microsoft não configurado no servidor.');
    if (!token) throw new Error('Credencial ausente.');

    const partes = token.split('.');
    if (partes.length !== 3) throw new Error('Token da Microsoft inválido.');

    const b64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    let header, payload;
    try {
        header = JSON.parse(b64url(partes[0]).toString());
        payload = JSON.parse(b64url(partes[1]).toString());
    } catch (e) {
        throw new Error('Token da Microsoft malformado.');
    }

    if (payload.aud !== clientId) throw new Error('Audiência inválida.');
    if (!/^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/.test(payload.iss || '')) {
        throw new Error('Emissor inválido.');
    }
    if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token expirado.');
    if (nonceEsperado && payload.nonce !== nonceEsperado) throw new Error('Nonce inválido.');

    // Busca as chaves públicas da Microsoft e confere a assinatura
    if (header.alg !== 'RS256') throw new Error('Algoritmo do token inválido.');
    const chaves = await buscarJWKS();
    const jwk = (chaves || []).find((k) => k.kid === header.kid);
    if (!jwk) throw new Error('Chave do token não encontrada.');

    const chave = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const ok = crypto.verify(
        'RSA-SHA256',
        Buffer.from(partes[0] + '.' + partes[1]),
        chave,
        b64url(partes[2])
    );
    if (!ok) throw new Error('Assinatura inválida.');

    const email = (payload.preferred_username || payload.email || '').toLowerCase();
    if (!email) throw new Error('Microsoft não retornou o e-mail.');

    return {
        id: payload.oid || payload.sub,
        email,
        nome: payload.name || email,
        foto: null,
        nonce: payload.nonce || null,
        // Conta autenticada pelo próprio IdP: identidade verificada
        emailVerificado: true
    };
}

module.exports = router;
module.exports.exigirLogin = exigirLogin;
