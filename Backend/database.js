// Banco PostgreSQL (Supabase) — troca o SQLite efêmero do Render
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool, types } = require('pg');

// BIGINT (ids) volta como número nas respostas JSON, igual ao SQLite
types.setTypeParser(20, (v) => parseInt(v, 10));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error(' Faltou DATABASE_URL (PostgreSQL/Supabase). Configure em Backend/.env (local) e no Render.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10
});

pool.on('error', (e) => console.error(' Erro no pool PostgreSQL:', e.message));

// Helpers async — mesma semântica das antigas get/all/run do sqlite3
async function q(sql, params = []) {
    return pool.query(sql, params); // .rows / .rowCount (INSERT/UPDATE/DELETE com RETURNING devolve rows)
}

async function qGet(sql, params = []) {
    const r = await pool.query(sql, params);
    return r.rows[0]; // undefined quando não achou (igual ao db.get)
}

async function qAll(sql, params = []) {
    const r = await pool.query(sql, params);
    return r.rows;
}

// "Agora" em UTC no mesmo formato do antigo datetime('now') do SQLite
const AGORA_SQL = `to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS')`;

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS agendamentos (
        id BIGSERIAL PRIMARY KEY,
        nome_cliente TEXT NOT NULL,
        servico TEXT NOT NULL,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        telefone TEXT,
        status TEXT DEFAULT 'agendado'
    )`,
    `CREATE TABLE IF NOT EXISTS tarefas (
        id BIGSERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        data TEXT NOT NULL,
        hora TEXT,
        categoria TEXT DEFAULT 'pessoal',
        concluido INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS usuarios (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT,
        telefone TEXT,
        tipo TEXT NOT NULL DEFAULT 'cliente',
        provider TEXT NOT NULL DEFAULT 'local',
        provider_id TEXT,
        foto TEXT,
        criado_em TEXT DEFAULT (to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS'))
    )`,
    `CREATE TABLE IF NOT EXISTS sessoes (
        token TEXT PRIMARY KEY,
        usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        criado_em TEXT DEFAULT (to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS')),
        expira_em TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS servicos (
        id BIGSERIAL PRIMARY KEY,
        usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco DOUBLE PRECISION,
        duracao_min INTEGER,
        criado_em TEXT DEFAULT (to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS'))
    )`,
    // Impede double-booking mesmo em escritas concorrentes
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ag_data_horario ON agendamentos(data, horario)`,
    `CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em)`,
    `CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id)`
];

async function limparSessoes() {
    try {
        await q(`DELETE FROM sessoes WHERE expira_em < ${AGORA_SQL}`);
    } catch (e) {
        console.error(' Erro ao limpar sessões expiradas:', e.message);
    }
}

async function iniciar() {
    try {
        await pool.query(`SELECT 1`); // teste de conexão (falha rápido se a URL estiver errada)
        for (const sql of SCHEMA) await pool.query(sql);
        console.log(' Conectado ao PostgreSQL (Supabase)');
        console.log(' Tabelas e índices prontos!');
        await limparSessoes();
        setInterval(limparSessoes, 60 * 60 * 1000); // limpa sessões expiradas de hora em hora
    } catch (e) {
        console.error(' Erro ao iniciar o PostgreSQL:', e.message);
        process.exit(1);
    }
}

iniciar();

module.exports = { q, qGet, qAll, pool, AGORA_SQL };
