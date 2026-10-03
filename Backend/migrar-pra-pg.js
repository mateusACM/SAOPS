/* Migra dados do SQLite local para o PostgreSQL (Supabase). Uso único (requer sqlite3: npm i sqlite3 --no-save):
   DATABASE_URL='postgresql://...' node Backend/migrar-pra-pg.js
   Copia tabelas existentes preservando valores; cria schema + índices. */
const sqlite3 = require('sqlite3');
const path = require('path');
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL no ambiente.'); process.exit(1); }

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agendamentos (
  id BIGSERIAL PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  servico TEXT NOT NULL,
  data TEXT NOT NULL,
  horario TEXT NOT NULL,
  telefone TEXT,
  status TEXT DEFAULT 'agendado'
);
CREATE TABLE IF NOT EXISTS tarefas (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  data TEXT NOT NULL,
  hora TEXT,
  categoria TEXT DEFAULT 'pessoal',
  concluido INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS usuarios (
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
);
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TEXT DEFAULT (to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS')),
  expira_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS servicos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DOUBLE PRECISION,
  duracao_min INTEGER,
  criado_em TEXT DEFAULT (to_char((now() at time zone 'utc'), 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ag_data_horario ON agendamentos(data, horario);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
`;

const TABELAS = ['usuarios', 'sessoes', 'agendamentos', 'tarefas', 'servicos'];

function lerSQLite() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path.join(__dirname, 'agendamento.db'), sqlite3.OPEN_READONLY);
    const dados = {};
    let pend = TABELAS.length;
    TABELAS.forEach((t) => {
      db.all(`SELECT * FROM ${t}`, (err, rows) => {
        if (err) return reject(new Error(`${t}: ${err.message}`));
        dados[t] = rows || [];
        if (--pend === 0) { db.close(); resolve(dados); }
      });
    });
  });
}

async function copiar(dados) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of TABELAS) {
      const rows = dados[t];
      if (!rows.length) { console.log(`  ${t}: 0 linhas (nada a copiar)`); continue; }
      const cols = Object.keys(rows[0]);
      const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`;
      for (const r of rows) {
        await client.query(sql, cols.map((c) => (r[c] === undefined ? null : r[c])));
      }
      console.log(`  ${t}: ${rows.length} linhas copiadas`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const dados = await lerSQLite();
  const c = await pool.connect();
  try {
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await c.query(stmt);
    console.log('Schema + índices criados.');
  } finally { c.release(); }

  await copiar(dados);

  const v = await pool.query(`SELECT (SELECT COUNT(*) FROM usuarios) u, (SELECT COUNT(*) FROM sessoes) s, (SELECT COUNT(*) FROM agendamentos) a, (SELECT COUNT(*) FROM tarefas) t, (SELECT COUNT(*) FROM servicos) sv`);
  const r = v.rows[0];
  console.log('Verificação:', `usuarios=${r.u} sessoes=${r.s} agendamentos=${r.a} tarefas=${r.t} servicos=${r.sv}`);
  const ok = +r.u === dados.usuarios.length && +r.s === dados.sessoes.length &&
             +r.a === dados.agendamentos.length && +r.t === dados.tarefas.length &&
             +r.sv === dados.servicos.length;
  console.log(ok ? 'OK: contagens batem.' : 'ERRO: contagens divergem!');
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
