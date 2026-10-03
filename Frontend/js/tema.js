// ==========================================
// TEMA.JS - alterna tema claro/escuro (SAOPS)
// O tema inicial é aplicado no <head> (script inline) para não piscar;
// aqui só ficam o botão e a troca. Chave: saops_tema
// ==========================================

(function () {
  const CHAVE = 'saops_tema';
  const raiz = document.documentElement;

  const ICONE_SOL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"></circle>' +
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>' +
    '</svg>';

  const ICONE_LUA =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>' +
    '</svg>';

  function temaAtual() {
    return raiz.dataset.tema === 'escuro' ? 'escuro' : 'claro';
  }

  function pintar(botao) {
    const escuro = temaAtual() === 'escuro';
    botao.innerHTML = escuro ? ICONE_SOL : ICONE_LUA;
    botao.title = escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    botao.setAttribute('aria-label', botao.title);
  }

  function montar() {
    const nav = document.querySelector('.topnav');
    if (!nav || document.getElementById('btn_tema')) return;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.id = 'btn_tema';
    botao.className = 'btn-tema';
    pintar(botao);

    botao.onclick = () => {
      const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
      raiz.dataset.tema = novo;
      try { localStorage.setItem(CHAVE, novo); } catch (e) { /* sem armazenamento */ }
      pintar(botao);
    };

    nav.appendChild(botao);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();
