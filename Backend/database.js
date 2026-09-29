// Importa a biblioteca do SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Usa caminho absoluto para não criar 2 bancos (raiz vs Backend/)
const dbPath = path.join(__dirname, 'agendamento.db');

// Cria/conecta no banco de dados (arquivo agendamento.db)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(' Erro ao conectar no banco:', err.message);
    } else {
        console.log(' Conectado ao banco de dados SQLite');
        // Chaves estrangeiras precisam deste PRAGMA por conexão
        db.run('PRAGMA foreign_keys = ON');
    }
});

// Cria as tabelas (se não existirem)
const tabelas = `
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_cliente TEXT NOT NULL,
        servico TEXT NOT NULL,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        telefone TEXT,
        status TEXT DEFAULT 'agendado'
    )
`;

const tabelaTarefas = `
    CREATE TABLE IF NOT EXISTS tarefas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        data TEXT NOT NULL,
        hora TEXT,
        categoria TEXT DEFAULT 'pessoal',
        concluido INTEGER DEFAULT 0
    )
`;

const tabelaUsuarios = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT,
        telefone TEXT,
        tipo TEXT NOT NULL DEFAULT 'cliente',
        provider TEXT NOT NULL DEFAULT 'local',
        provider_id TEXT,
        foto TEXT,
        criado_em TEXT DEFAULT (datetime('now'))
    )
`;

const tabelaSessoes = `
    CREATE TABLE IF NOT EXISTS sessoes (
        token TEXT PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        criado_em TEXT DEFAULT (datetime('now')),
        expira_em TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE)
`;

const tabelaServicos = `
    CREATE TABLE IF NOT EXISTS servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL,
        duracao_min INTEGER,
        criado_em TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE)
`;

db.serialize(() => {
    db.run(tabelas, (err) => {
        if (err) console.error(' Erro ao criar tabela:', err.message);
        else console.log(' Tabela "agendamentos" pronta!');
    });
    db.run(tabelaTarefas, (err) => {
        if (err) console.error(' Erro ao criar tabela:', err.message);
        else console.log(' Tabela "tarefas" pronta!');
    });
    db.run(tabelaUsuarios, (err) => {
        if (err) console.error(' Erro ao criar tabela:', err.message);
        else console.log(' Tabela "usuarios" pronta!');
    });
    db.run(tabelaSessoes, (err) => {
        if (err) console.error(' Erro ao criar tabela:', err.message);
        else {
            console.log(' Tabela "sessoes" pronta!');
            // Limpa sessões expiradas
            db.run("DELETE FROM sessoes WHERE expira_em < datetime('now')");
        }
    });
    db.run(tabelaServicos, (err) => {
        if (err) console.error(' Erro ao criar tabela:', err.message);
        else console.log(' Tabela "servicos" pronta!');
    });
    // Impede double-booking mesmo em escritas concorrentes (vale para
    // bancos já existentes; se houver duplicatas antigas, só avisa)
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_ag_data_horario ON agendamentos(data, horario)', (err) => {
        if (err) console.error(' Aviso: índice único data+horario não criado:', err.message);
        else console.log(' Índice único data+horario pronto!');
    });
    db.run('CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id)');
});

// Limpa sessões expiradas a cada hora (não só no boot)
setInterval(() => {
    db.run("DELETE FROM sessoes WHERE expira_em < datetime('now')");
}, 60 * 60 * 1000);

// Exporta o banco para usar em outros arquivos
module.exports = db;