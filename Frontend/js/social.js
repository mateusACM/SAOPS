// ==========================================
// SOCIAL.JS - login com Google
// Uso: iniciarLoginSocial({ destino: 'busca.html' })
// Requer: api.js (chamarAuth/entrarSocial/salvarSessaoLocal),
//         toast.js e o script do Google em gsi/client
// ==========================================

let CONFIG_SOCIAL = { googleClientId: '' };

async function iniciarLoginSocial({ destino, tipo = 'cliente' }) {
  try {
    const r = await chamarAuth('config');
    if (r.sucesso) CONFIG_SOCIAL = r; // {sucesso, googleClientId}
  } catch (e) { /* mantém vazio */ }

  montarBotaoGoogle(destino, tipo);
}

// ---------- Google (Google Identity Services) ----------

function montarBotaoGoogle(destino, tipo) {
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
        const r = await entrarSocial('google', resp.credential, null, tipo);
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

// ---------- entrada comum ----------

async function aoEntrar(r, destino) {
  if (r.sucesso && r.usuario) {
    salvarSessaoLocal(r.usuario);
    toast('Bem-vindo(a), ' + r.usuario.nome + '!', 'sucesso');
    const destinoPerfil = r.usuario.tipo === 'empresa' ? 'painel-prestador.html' : destino;
    setTimeout(() => { window.location.href = voltarAposLogin(destinoPerfil); }, 400);
  } else {
    toast(r.erro || 'Não foi possível entrar.', 'erro');
  }
}
