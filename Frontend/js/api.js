// ==========================================
// API.JS - Funções para chamar a API REST
// ==========================================

// Quando o frontend é servido pelo próprio backend (qualquer porta,
// mesma origem), usa URL relativa. No Live Server ou file://,
// cai para o backend local na porta 3000.
const API_URL = (() => {
  const { protocol, hostname, port } = window.location;
  if (protocol.startsWith('http') && (port === '' || port === '3000')) return '';
  if (protocol.startsWith('http') && hostname) return `http://${hostname}:3000`;
  return 'http://localhost:3000';
})();

// ==========================================
// CRIAR AGENDAMENTO
// ==========================================

async function criarAgendamento(dados) {
    try {
        const response = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Agendamento criado:', result);
            return { sucesso: true, dados: result };
        } else {
            console.error('❌ Erro:', result.erro);
            return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// LISTAR AGENDAMENTOS
// ==========================================

async function listarAgendamentos() {
    try {
        const response = await fetch(`${API_URL}/agendamentos`);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Agendamentos listados:', data);
            return { sucesso: true, dados: data.agendamentos };
        } else {
            console.error('❌ Erro:', data.erro);
            return { sucesso: false, erro: data.erro };
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// BUSCAR AGENDAMENTO POR ID
// ==========================================

async function buscarAgendamentoPorId(id) {
    try {
        const response = await fetch(`${API_URL}/agendamentos/${id}`);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Agendamento encontrado:', data);
            return { sucesso: true, dados: data };
        } else {
            console.error('❌ Erro:', data.erro);
            return { sucesso: false, erro: data.erro };
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// BUSCAR AGENDAMENTOS POR DATA
// ==========================================

async function buscarAgendamentosPorData(data) {
    try {
        const response = await fetch(`${API_URL}/agendamentos/data/${data}`);
        const result = await response.json();

        if (response.ok) {
            console.log('✅ Agendamentos da data:', result);
            return { sucesso: true, dados: result.agendamentos };
        } else {
            console.error('❌ Erro:', result.erro);
            return { sucesso: false, erro: result.erro };
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// ATUALIZAR AGENDAMENTO
// ==========================================

async function atualizarAgendamento(id, dados) {
    try {
        const response = await fetch(`${API_URL}/agendamentos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Agendamento atualizado:', result);
            return { sucesso: true, dados: result };
        } else {
            console.error('❌ Erro:', result.erro);
            return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// DELETAR AGENDAMENTO
// ==========================================

async function deletarAgendamento(id) {
    try {
        const response = await fetch(`${API_URL}/agendamentos/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Agendamento deletado:', result);
            return { sucesso: true, dados: result };
        } else {
            console.error('❌ Erro:', result.erro);
            return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// TAREFAS DO DIA A DIA
// ==========================================

async function listarTarefas(filtro = {}) {
    try {
        const params = new URLSearchParams();
        if (filtro.data) params.set('data', filtro.data);
        if (filtro.concluido !== undefined && filtro.concluido !== null) params.set('concluido', filtro.concluido);
        const qs = params.toString();
        const response = await fetch(`${API_URL}/tarefas${qs ? '?' + qs : ''}`);
        const result = await response.json();

        if (response.ok) {
            return { sucesso: true, dados: result.tarefas };
        } else {
            return { sucesso: false, erro: result.erro };
        }
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function criarTarefa(dados) {
    try {
        const response = await fetch(`${API_URL}/tarefas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function atualizarTarefa(id, dados) {
    try {
        const response = await fetch(`${API_URL}/tarefas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function deletarTarefa(id) {
    try {
        const response = await fetch(`${API_URL}/tarefas/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

// ==========================================
// AUTENTICAÇÃO (/api/auth/*)
// ==========================================

async function chamarAuth(rota, opcoes = {}) {
    try {
        const response = await fetch(`${API_URL}/api/auth/${rota}`, {
            method: opcoes.metodo || 'GET',
            headers: opcoes.dados ? { 'Content-Type': 'application/json' } : undefined,
            body: opcoes.dados ? JSON.stringify(opcoes.dados) : undefined,
            credentials: 'same-origin'
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) return Object.assign({ sucesso: true }, result);
        return { sucesso: false, erro: result.erro || 'Falha na autenticação.' };
    } catch (error) {
        return { sucesso: false, erro: 'Sem conexão com o servidor.' };
    }
}

function cadastrarConta(dados) {
    return chamarAuth('cadastro', { metodo: 'POST', dados });
}

function entrarConta(email, senha) {
    return chamarAuth('login', { metodo: 'POST', dados: { email, senha } });
}

function entrarSocial(provider, credential, nonce) {
    return chamarAuth('oauth', { metodo: 'POST', dados: { provider, credential, nonce } });
}

function sairConta() {
    return chamarAuth('logout', { metodo: 'POST' });
}

function usuarioAtual() {
    return chamarAuth('eu');
}

function configAuth() {
    return chamarAuth('config');
}

// Mantém as chaves de localStorage que o resto do sistema já usa
function salvarSessaoLocal(usuario) {
    try {
        localStorage.setItem('saops_usuario', JSON.stringify({ tipo: usuario.tipo || 'cliente', email: usuario.email }));
        localStorage.setItem('nome_cliente', usuario.nome || '');
        localStorage.setItem('email_cliente', usuario.email || '');
        if (usuario.telefone) localStorage.setItem('telefone', usuario.telefone);
    } catch (e) { /* modo privado/cota cheia: segue sem salvar */ }
}

// ==========================================
// SERVIÇOS DO PRESTADOR (/servicos)
// ==========================================

async function listarServicos() {
    try {
        const response = await fetch(`${API_URL}/servicos`);
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result.servicos };
        return { sucesso: false, erro: result.erro };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function meusServicos() {
    try {
        const response = await fetch(`${API_URL}/servicos/meus`);
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result.servicos };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function criarServico(dados) {
    try {
        const response = await fetch(`${API_URL}/servicos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function atualizarServico(id, dados) {
    try {
        const response = await fetch(`${API_URL}/servicos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}

async function deletarServico(id) {
    try {
        const response = await fetch(`${API_URL}/servicos/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) return { sucesso: true, dados: result };
        return { sucesso: false, erro: result.erro, naoAutenticado: response.status === 401 };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
}
