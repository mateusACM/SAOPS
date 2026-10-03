(() => {
  const tipo = document.body.dataset.cadastro;
  const empresa = tipo === 'empresa';
  const byId = (id) => document.getElementById(id);
  const form = byId(empresa ? 'form_cadastro_empresa' : 'form_cadastro_cliente');
  const passo1 = form.querySelector('[data-etapa="1"]');
  const passo2 = form.querySelector('[data-etapa="2"]');
  const email = byId(empresa ? 'txt_email_cadastro_empresa' : 'txt_email_cadastro_cliente');
  const senha = byId(empresa ? 'txt_senha_cadastro_empresa' : 'txt_senha_cadastro_cliente');
  const proximaUrl = voltarAposLogin(empresa ? 'painel-prestador.html' : 'busca.html');

  function atualizarEtapa(etapa) {
    passo1.hidden = etapa !== 1;
    passo2.hidden = etapa !== 2;
    document.querySelectorAll('[data-etapa-status]').forEach((item) => {
      const numero = Number(item.dataset.etapaStatus);
      item.classList.toggle('atual', numero === etapa);
      item.classList.toggle('concluida', numero < etapa);
    });
    (etapa === 1 ? passo1 : passo2).querySelector('input,select')?.focus();
  }

  document.querySelector('[data-proxima]').addEventListener('click', () => {
    const invalido = [...passo1.querySelectorAll('input,select')].find((campo) => !campo.checkValidity());
    if (invalido) invalido.reportValidity(); else atualizarEtapa(2);
  });
  document.querySelector('[data-voltar]').addEventListener('click', () => atualizarEtapa(1));

  if (!empresa) {
    byId('txt_telefone_cadastro_cliente').addEventListener('input', (evento) => {
      const digitos = evento.target.value.replace(/\D/g, '').slice(0, 11);
      if (!digitos) { evento.target.value = ''; return; }
      const ddd = digitos.slice(0, 2);
      const resto = digitos.slice(2);
      const corte = digitos.length > 10 ? 5 : 4;
      evento.target.value = `(${ddd})${resto ? ` ${resto.slice(0, corte)}${resto.length > corte ? `-${resto.slice(corte)}` : ''}` : ''}`;
    });
  }

  senha.addEventListener('input', () => {
    const valor = senha.value;
    const nivel = [valor.length >= 8, /[A-Za-z]/.test(valor) && /\d/.test(valor), /[^A-Za-z0-9]/.test(valor)].filter(Boolean).length;
    byId(empresa ? 'forca_senha_empresa' : 'forca_senha_cliente').dataset.nivel = String(nivel);
    byId(empresa ? 'dica_senha_empresa' : 'dica_senha_cliente').textContent = !valor ? 'Use 8 ou mais caracteres e combine letras e números.' : ['Senha muito curta', 'Adicione letras e números', 'Boa senha', 'Senha forte'][nivel];
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const erro = byId('erro_cadastro');
    erro.hidden = true;
    if (!passo2.querySelector('input').checkValidity()) { atualizarEtapa(2); return; }
    if (new TextEncoder().encode(senha.value).length > 72) {
      erro.textContent = 'A senha é longa demais. Use até 72 bytes.'; erro.hidden = false; return;
    }
    if (!empresa && senha.value !== byId('txt_confirmar_senha_cadastro_cliente').value) {
      erro.textContent = 'As senhas não conferem. Digite a mesma senha nos dois campos.'; erro.hidden = false; return;
    }
    const dados = empresa ? {
      nome: byId('txt_nome_negocio_cadastro_empresa').value.trim(),
      categoria: byId('txt_categoria_cadastro_empresa').value,
      endereco: byId('txt_endereco_cadastro_empresa').value.trim(),
      email: email.value.trim().toLowerCase(), senha: senha.value, tipo
    } : {
      nome: byId('txt_nome_cadastro_cliente').value.trim(),
      email: email.value.trim().toLowerCase(),
      telefone: byId('txt_telefone_cadastro_cliente').value.trim(), senha: senha.value, tipo
    };
    const botao = byId(empresa ? 'btn_cadastrar_negocio' : 'btn_criar_conta_cliente');
    const textoOriginal = botao.textContent;
    botao.disabled = true; botao.textContent = 'Criando sua conta…';
    const resposta = await cadastrarConta(dados);
    botao.disabled = false; botao.textContent = textoOriginal;
    if (!resposta.sucesso) { erro.textContent = resposta.erro || 'Não foi possível criar sua conta.'; erro.hidden = false; return; }
    salvarSessaoLocal(resposta.usuario);
    toast('Conta criada! Bem-vindo ao SAOPS.', 'sucesso');
    setTimeout(() => { window.location.href = proximaUrl; }, 600);
  });
})();
