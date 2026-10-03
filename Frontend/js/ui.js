// ==========================================
// UI.JS - avatar no header e item de nav ativo
// ==========================================

(function () {
  // Marca o link da nav correspondente à página atual
  const atual = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.topnav a').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino && destino.split('?')[0] === atual) a.classList.add('nav-ativa');
  });

  // Preenche os avatares (foto salva ou iniciais do nome)
  let foto = '', nome = '';
  try {
    foto = localStorage.getItem('saops_foto') || '';
    nome = localStorage.getItem('nome_cliente') || localStorage.getItem('email_cliente') || '';
  } catch (e) { /* sem armazenamento: usa iniciais padrão */ }
  const iniciais = nome
    ? nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')
    : 'P';

  document.querySelectorAll('[data-avatar]').forEach((el) => {
    if (foto) {
      el.style.backgroundImage = 'url(' + foto + ')';
      el.textContent = '';
    } else {
      el.textContent = iniciais.toUpperCase();
    }
  });

  // Complementa nome/foto pela sessão do servidor (quando logado e
  // o localStorage está vazio). Roda após o carregamento, quando o
  // api.js (com API_URL) já está disponível.
  window.addEventListener('load', async () => {
    if (typeof API_URL === 'undefined') return;
    try {
      const r = await fetch(API_URL + '/api/auth/eu', { credentials: 'same-origin' });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.sucesso || !d.usuario) return;

      let mudou = false;
      if (!localStorage.getItem('nome_cliente') && d.usuario.nome) {
        localStorage.setItem('nome_cliente', d.usuario.nome);
        mudou = true;
      }
      if (!localStorage.getItem('email_cliente') && d.usuario.email) {
        localStorage.setItem('email_cliente', d.usuario.email);
        mudou = true;
      }
      if (d.usuario.foto && !localStorage.getItem('saops_foto')) {
        localStorage.setItem('saops_foto', d.usuario.foto);
        mudou = true;
      }
      if (!mudou) return;

      const novaFoto = localStorage.getItem('saops_foto') || '';
      const novoNome = localStorage.getItem('nome_cliente') || '';
      const ini = novoNome
        ? novoNome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
        : 'P';
      document.querySelectorAll('[data-avatar]').forEach((el) => {
        if (novaFoto) {
          el.style.backgroundImage = 'url(' + novaFoto + ')';
          el.textContent = '';
        } else {
          el.style.backgroundImage = '';
          el.textContent = ini;
        }
      });
    } catch (e) { /* offline ou sem backend: ignora */ }
  });
})();

// ==========================================
// Skeletons de carregamento (globais)
// Uso: lista.innerHTML = esqueleto(3)
//      box.innerHTML = esqueletoCard('sk-full')
// ==========================================

function esqueleto(n = 3) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<li class="sk">' +
      '<div class="sk-linha larga"></div>' +
      '<div class="sk-linha media"></div>' +
      '</li>';
  }
  return html;
}

function esqueletoCard(classeExtra = '') {
  return '<div class="sk-card' + (classeExtra ? ' ' + classeExtra : '') + '">' +
    '<div class="sk-linha larga"></div>' +
    '<div class="sk-linha media"></div>' +
    '<div class="sk-linha curta"></div>' +
    '</div>';
}

// ==========================================
// Chips de status de agendamento (filtros)
// Uso: const ativos = new Set(STATUS_AGENDAMENTO);
//      montarChipsStatus(el, ativos, () => aplicar())
// ==========================================

const STATUS_AGENDAMENTO = ['agendado', 'confirmado', 'concluido', 'cancelado'];

function montarChipsStatus(el, ativos, aoMudar) {
  if (!el) return;
  el.innerHTML = '';
  STATUS_AGENDAMENTO.forEach((st) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-status' + (ativos.has(st) ? ' ativo' : '');
    b.dataset.status = st;
    b.textContent = st;
    b.onclick = () => {
      if (ativos.has(st)) ativos.delete(st); else ativos.add(st);
      b.classList.toggle('ativo', ativos.has(st));
      aoMudar();
    };
    el.appendChild(b);
  });
}

// ==========================================
// Escape de HTML (anti-XSS)
// Uso: '<p>' + esc(a.nome_cliente) + '</p>'
// ==========================================

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==========================================
// Guarda de escrita: exige login
// Uso: if (!(await exigirLogin('login-cliente.html'))) return;
// Após o login, voltarAposLogin('busca.html') devolve pra página guardada
// ==========================================

const CHAVE_VOLTAR = 'saops_voltar';

async function exigirLogin(paginaLogin = 'login-cliente.html') {
  try {
    const r = await usuarioAtual();
    if (r && r.sucesso) return true;
  } catch (e) { /* sem backend: segue para o fluxo normal de erro */ }
  try {
    const aqui = location.pathname.split('/').pop() + location.search;
    localStorage.setItem(CHAVE_VOLTAR, aqui);
  } catch (e) { /* sem armazenamento */ }
  if (typeof toast === 'function') toast('Entre na sua conta para continuar.', 'info');
  setTimeout(() => { window.location.href = paginaLogin; }, 600);
  return false;
}

function voltarAposLogin(padrao) {
  let v = null;
  try {
    v = localStorage.getItem(CHAVE_VOLTAR);
    localStorage.removeItem(CHAVE_VOLTAR);
  } catch (e) { /* sem armazenamento */ }
  // Só volta para páginas .html locais (sem protocolo, sem barras extras)
  if (v && /^[a-z0-9-]+\.html(\?.*)?$/i.test(v)) return v;
  return padrao;
}
