// ==========================================
// TOAST.JS - mensagens flutuantes no lugar de alert()
// Uso: toast('Mensagem', 'sucesso' | 'erro' | 'info')
// ==========================================

function toast(mensagem, tipo = 'info') {
  let area = document.getElementById('toast_area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'toast_area';
    area.className = 'toast-area';
    document.body.appendChild(area);
  }
  const item = document.createElement('div');
  item.className = 'toast toast-' + tipo;
  item.textContent = mensagem;
  area.appendChild(item);
  requestAnimationFrame(() => item.classList.add('toast-entra'));
  setTimeout(() => {
    item.classList.remove('toast-entra');
    setTimeout(() => item.remove(), 300);
  }, 3500);
}
