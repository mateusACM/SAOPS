// ==========================================
// LEMBRETES.JS - avisa quando faltar pouco pro horário
// Requer api.js (listarAgendamentos) e toast.js.
// Chaves: saops_lembretes (on/off), saops_lembrete_antecedencia (min),
//         saops_lembretes_vistos (ids já avisados)
// ==========================================

(function () {
  const CHAVE_ON = 'saops_lembretes';
  const CHAVE_ANT = 'saops_lembrete_antecedencia';
  const CHAVE_VISTOS = 'saops_lembretes_vistos';
  const JANELAS = [15, 30, 60];

  function ligado() {
    try { return localStorage.getItem(CHAVE_ON) === 'on'; } catch (e) { return false; }
  }

  function antecedenciaMin() {
    try {
      const v = parseInt(localStorage.getItem(CHAVE_ANT), 10);
      return JANELAS.indexOf(v) >= 0 ? v : 60;
    } catch (e) { return 60; }
  }

  function vistos() {
    try {
      const l = JSON.parse(localStorage.getItem(CHAVE_VISTOS));
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }

  async function verificar() {
    if (!ligado()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof listarAgendamentos !== 'function') return;

    let r;
    try { r = await listarAgendamentos(); } catch (e) { return; }
    if (!r || !r.sucesso || !Array.isArray(r.dados)) return;

    const agora = Date.now();
    const janelaMs = antecedenciaMin() * 60000;
    const jaVistos = vistos();
    const novos = jaVistos.slice();
    let mudou = false;

    r.dados.forEach((a) => {
      if (a.status !== 'agendado' && a.status !== 'confirmado') return;
      if (jaVistos.indexOf(a.id) >= 0) return;

      const quando = new Date(a.data + 'T' + a.horario + ':00').getTime();
      if (isNaN(quando)) return;
      const resta = quando - agora;
      if (resta <= 0 || resta > janelaMs) return;

      const mins = Math.max(1, Math.round(resta / 60000));
      const titulo = 'Seu horário é em ' + mins + ' min';
      const corpo = a.servico + ' às ' + a.horario + ' (' + a.nome_cliente + ')';

      try { new Notification(titulo, { body: corpo }); } catch (e) { /* sem permissão da aba */ }
      if (typeof toast === 'function') toast(titulo + ' — ' + corpo, 'info');

      novos.push(a.id);
      mudou = true;
    });

    if (mudou) {
      try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify(novos.slice(-50))); } catch (e) { /* cheio */ }
    }
  }

  function iniciar() {
    if (typeof API_URL === 'undefined') return;
    verificar();
    setInterval(verificar, 60000);
  }

  if (document.readyState === 'complete') iniciar();
  else window.addEventListener('load', iniciar);
})();
