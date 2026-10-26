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
  // Atualiza avatares via sessão quando logado (usa credentials: 'include' para enviar cookie HttpOnly)
  window.addEventListener('load', async () => {
    if (typeof API_URL === 'undefined') return;
    try {
      const r = await fetch(API_URL + '/api/auth/eu', { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.sucesso || !d.usuario) return;
      const usuario = d.usuario;

      let mudou = false;
      if (!localStorage.getItem('nome_cliente') && usuario.nome) {
        localStorage.setItem('nome_cliente', usuario.nome);
        mudou = true;
      }
      if (!localStorage.getItem('email_cliente') && usuario.email) {
        localStorage.setItem('email_cliente', usuario.email);
        mudou = true;
      }
      if (usuario.foto && !localStorage.getItem('saops_foto')) {
        localStorage.setItem('saops_foto', usuario.foto);
        mudou = true;
      }
      if (mudou) {
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
      }

      // Exclusivo de prestador logado: menu de atalhos no topnav e
      // banner do negócio atrás do avatar na página de perfil.
      if (usuario.tipo === 'empresa') {
        injetarMenuPrestador();
        // Banner só se vier como data URL de imagem (o backend valida,
        // mas o frontend defende até nos atas).
        if (typeof usuario.banner === 'string' && /^data:image\//.test(usuario.banner)) {
          aplicarBannerPerfil(usuario.banner);
        }
      }
    } catch (e) { /* offline ou sem backend: ignora */ }
  });

  // ---------- Menu de atalhos do prestador (topnav) ----------
  // Injeta um botão compacto + dropdown ("Meu negócio" e "Painel") no
  // .topnav de qualquer página. Só roda depois de /eu responder com
  // tipo 'empresa' — nada de renderizar antes e esconder depois.
  // Guard null-safe: páginas sem .topnav não fazem nada.
  function injetarMenuPrestador() {
    const nav = document.querySelector('.topnav');
    if (!nav || nav.querySelector('.nav-prestador')) return;
    // Páginas de acesso (.auth-page) têm .topnav no HTML, mas ela fica
    // display:none — ali não há atalho: o botão sairia da nav escondida
    // e apareceria solto ao lado do h1 da tela de login.
    if (document.body.classList.contains('auth-page')) return;

    const item = document.createElement('div');
    item.className = 'nav-prestador';

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'nav-prestador-botao';
    botao.setAttribute('aria-haspopup', 'true');
    botao.setAttribute('aria-expanded', 'false');
    botao.textContent = 'Prestador';
    const caret = document.createElement('span');
    caret.className = 'nav-prestador-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    botao.appendChild(caret);

    // Links estáticos via createElement: sem innerHTML com dados (anti-XSS)
    const menu = document.createElement('div');
    menu.className = 'nav-prestador-menu';
    menu.hidden = true;
    [['meu-negocio.html', 'Meu negócio'], ['painel-prestador.html', 'Painel']].forEach(([href, texto]) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = texto;
      // Marca como ativo quando um dos atalhos é a página atual
      const atual = location.pathname.split('/').pop() || 'index.html';
      if (href === atual) a.classList.add('nav-ativa');
      menu.appendChild(a);
    });

    function abrir() {
      menu.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
    }
    function fechar(focar) {
      if (menu.hidden) return;
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
      if (focar) botao.focus();
    }

    botao.addEventListener('click', () => {
      if (menu.hidden) abrir(); else fechar();
    });
    // Fecha ao clicar fora (o clique no próprio botão é tratado acima)
    document.addEventListener('click', (e) => {
      if (!item.contains(e.target)) fechar();
    });
    // Fecha com Escape devolvendo o foco ao botão
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fechar(true);
    });
    // Fecha quando o foco sai do conjunto botão+menu (Tab via teclado)
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) fechar();
    });

    item.appendChild(botao);
    item.appendChild(menu);

    // Posição: ao lado do <h1> do header (antes da .topnav), o mesmo
    // título que nomeia a página. Sem <h1> no header, cai no fim da
    // .topnav como antes — e como o .topnav usa margin-left:auto, os
    // atalhos ficam sempre puxados pra direita de qualquer jeito.
    const cabecalho = nav.closest('header');
    const titulo = cabecalho && cabecalho.querySelector('h1');
    if (titulo) {
      titulo.insertAdjacentElement('afterend', item);
    } else {
      nav.appendChild(item);
    }
  }

  // ---------- Banner do negócio no perfil ----------
  // Coloca o banner (data URL já validado por regex) como faixa decorativa
  // atrás do avatar, no card do topo da página de perfil. Só roda quando
  // existe .perfil-topo; cliente não tem banner e não sofre mudança visual.
  function aplicarBannerPerfil(banner) {
    const topo = document.querySelector('.perfil-topo');
    if (!topo) return; // não é a página de perfil
    const secao = topo.closest('section');
    if (!secao || secao.querySelector('.perfil-banner')) return;
    const faixa = document.createElement('div');
    faixa.className = 'perfil-banner';
    faixa.setAttribute('aria-hidden', 'true'); // decorativo
    faixa.style.backgroundImage = 'url(' + banner + ')';
    secao.classList.add('tem-banner-perfil');
    secao.insertBefore(faixa, secao.firstChild);
  }
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

// ==========================================
// Bloco amigável quando uma lista da área logada não carrega
// (sessão ausente/expirada, servidor fora do ar ou outro erro da API).
// Uso: blocoSemAcesso(lista, r, 'suas tarefas', 'login-cliente.html')
// ==========================================

function blocoSemAcesso(alvo, r, oQue, paginaLogin) {
  if (!alvo) return;

  // 1) Sem sessão (401): convite para logar. Se já havia registro de
  //    login no localStorage (gravado por salvarSessaoLocal e removido no
  //    sair), a sessão do servidor expirou — pedimos para entrar de novo.
  if (r && r.naoAutenticado) {
    let expirou = false;
    try { expirou = !!localStorage.getItem('saops_usuario'); } catch (e) { /* sem armazenamento */ }
    alvo.innerHTML = '<div class="vazio">' +
      '<span class="vazio-ico" aria-hidden="true">🔒</span>' +
      '<p class="vazio-titulo">' + (expirou ? 'Sua sessão expirou.' : 'Você precisa estar logado.') + '</p>' +
      '<p class="vazio-texto">Entre na sua conta para ver ' + esc(oQue || 'seus dados') + '.</p>' +
      '<button type="button" class="vazio-botao">Fazer login</button>' +
      '</div>';
    // O clique passa pelo exigirLogin, que salva a página atual e redireciona;
    // após o login, voltarAposLogin devolve o usuário para cá.
    const botao = alvo.querySelector('.vazio-botao');
    if (botao && typeof exigirLogin === 'function') {
      botao.addEventListener('click', () => exigirLogin(paginaLogin || 'login-cliente.html'));
    }
    return;
  }

  // 2) Falha de rede de verdade (fetch não chegou ao servidor).
  if (r && r.semConexao) {
    alvo.innerHTML = '<div class="vazio">' +
      '<span class="vazio-ico" aria-hidden="true">📡</span>' +
      '<p class="vazio-titulo">Não foi possível conectar ao servidor.</p>' +
      '<p class="vazio-texto">Verifique sua conexão com a internet e tente novamente em instantes.</p>' +
      '</div>';
    return;
  }

  // 3) Outro erro da API (500, validação): motivo neutro, sem culpar o backend.
  alvo.innerHTML = '<div class="vazio">' +
    '<span class="vazio-ico" aria-hidden="true">⚠️</span>' +
    '<p class="vazio-titulo">Não foi possível carregar ' + esc(oQue || 'os dados') + '.</p>' +
    (r && r.erro ? '<p class="vazio-texto">' + esc(r.erro) + '</p>' : '') +
    '</div>';
}

// ==========================================
// Mostrar/ocultar senha (ícone de olho)
// Injeta, em todo <input type="password"> da página, um botão dentro de um
// wrapper (.senha-wrap) — o input é movido para dentro dele no boot, então
// este init precisa rodar cedo (DOMContentLoaded) antes do usuário digitar.
// Uso: initMostrarOcultarSenha()  (já roda automático no DOMContentLoaded)
// ==========================================

function initMostrarOcultarSenha(raiz = document) {
  // SVG inline em vez de emoji (ex.: 👁): o emoji dependia de fonte de
  // fallback do sistema e, em alguns SOs/plataformas, ficava invisível.
  const ICONE_OLHO =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
    '<circle cx="12" cy="12" r="3"></circle>' +
    '</svg>';
  const ICONE_OLHO_CORTADO =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>' +
    '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>' +
    '<line x1="1" y1="1" x2="23" y2="23"></line>' +
    '</svg>';

  raiz.querySelectorAll('input[type="password"]').forEach((campo) => {
    // Evita aplicar duas vezes no mesmo campo
    if (campo.dataset.senhaToggle === '1') return;
    campo.dataset.senhaToggle = '1';

    const wrap = document.createElement('span');
    wrap.className = 'senha-wrap';
    campo.parentNode.insertBefore(wrap, campo);
    wrap.appendChild(campo);

    const botao = document.createElement('button');
    botao.type = 'button'; // não dispara submit caso o form seja enviado com Enter
    botao.className = 'senha-toggle';
    // aria-label + aria-pressed: leitores de tela anunciam a ação do botão
    // e o seu estado (pressionado = senha visível) — acessibilidade WCAG.
    botao.setAttribute('aria-label', 'Mostrar senha');
    botao.setAttribute('aria-pressed', 'false');
    botao.title = 'Mostrar senha';
    botao.innerHTML = ICONE_OLHO;
    wrap.appendChild(botao);

    botao.addEventListener('click', () => {
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      botao.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
      botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
      botao.title = mostrar ? 'Ocultar senha' : 'Mostrar senha';
      botao.innerHTML = mostrar ? ICONE_OLHO_CORTADO : ICONE_OLHO;
      botao.classList.toggle('ativo', mostrar);
    });
  });
}

// Roda sozinho após o HTML carregar (sem depender da ordem dos <script>).
document.addEventListener('DOMContentLoaded', () => initMostrarOcultarSenha());
