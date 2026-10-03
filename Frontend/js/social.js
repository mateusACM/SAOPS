// ==========================================
// SOCIAL.JS - login com Google e Microsoft
// Uso: iniciarLoginSocial({ destino: 'busca.html' })
// Requer: api.js (chamarAuth/entrarSocial/salvarSessaoLocal),
//         toast.js e o script do Google em gsi/client
// ==========================================

let CONFIG_SOCIAL = { googleClientId: '', microsoftClientId: '' };

async function iniciarLoginSocial({ destino }) {
  try {
    const r = await chamarAuth('config');
    if (r.sucesso) CONFIG_SOCIAL = r; // {sucesso, googleClientId, microsoftClientId}
  } catch (e) { /* mantém vazio */ }

  montarBotaoGoogle(destino);

  const btnMs = document.getElementById('ms_btn');
  if (btnMs) btnMs.onclick = () => abrirMicrosoft(destino);
}

// ---------- Google (Google Identity Services) ----------

function montarBotaoGoogle(destino) {
  const alvo = document.getElementById('google_btn');
  if (!alvo) return;

  const tentar = () => {
    if (!window.google || !google.accounts || !google.accounts.id) return false;
    if (!CONFIG_SOCIAL.googleClientId) {
      alvo.innerHTML = '<button type="button" class="social-btn google-btn">G&nbsp; Entrar com Google</button>';
      alvo.querySelector('button').onclick = () =>
        toast('Login com Google ainda não foi configurado no servidor.', 'erro');
      return true;
    }
    google.accounts.id.initialize({
      client_id: CONFIG_SOCIAL.googleClientId,
      callback: async (resp) => {
        const r = await entrarSocial('google', resp.credential);
        aoEntrar(r, destino);
      }
    });
    google.accounts.id.renderButton(alvo, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'continue_with',
      width: 260
    });
    return true;
  };

  if (!tentar()) window.addEventListener('load', tentar);
}

// ---------- Microsoft (fluxo popup id_token) ----------

function abrirMicrosoft(destino) {
  if (!CONFIG_SOCIAL.microsoftClientId) {
    toast('Login com Microsoft ainda não foi configurado no servidor.', 'erro');
    return;
  }
  const nonce = crypto.randomUUID();
  sessionStorage.setItem('saops_ms_nonce', nonce);
  sessionStorage.setItem('saops_ms_destino', destino);

  const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
    new URLSearchParams({
      client_id: CONFIG_SOCIAL.microsoftClientId,
      response_type: 'id_token',
      scope: 'openid profile email',
      redirect_uri: location.origin + '/auth-callback.html',
      response_mode: 'fragment',
      nonce
    });

  const pop = window.open(url, 'ms_login', 'width=520,height=640');
  if (!pop) toast('Permita pop-ups para entrar com Microsoft.', 'erro');
}

// auth-callback.html (popup) devolve o id_token via postMessage
window.addEventListener('message', async (ev) => {
  if (ev.origin !== location.origin) return;
  const d = ev.data || {};

  if (d.tipo === 'ms_id_token') {
    const nonce = sessionStorage.getItem('saops_ms_nonce');
    const destino = sessionStorage.getItem('saops_ms_destino') || 'busca.html';
    const r = await entrarSocial('microsoft', d.token, nonce);
    aoEntrar(r, destino);
  } else if (d.tipo === 'ms_erro') {
    toast(d.erro || 'Login com Microsoft cancelado.', 'erro');
  }
});

// ---------- entrada comum ----------

async function aoEntrar(r, destino) {
  if (r.sucesso && r.usuario) {
    salvarSessaoLocal(r.usuario);
    toast('Bem-vindo(a), ' + r.usuario.nome + '!', 'sucesso');
    setTimeout(() => { window.location.href = voltarAposLogin(destino); }, 400);
  } else {
    toast(r.erro || 'Não foi possível entrar.', 'erro');
  }
}
