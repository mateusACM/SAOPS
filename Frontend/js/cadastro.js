(() => {
  const tipo = document.body.dataset.cadastro;
  const empresa = tipo === 'empresa';
  const byId = (id) => document.getElementById(id);
  const formCadastro = byId(empresa ? 'form_cadastro_empresa' : 'form_cadastro_cliente');
  const formCodigo = byId('form_verificar_email');
  const painelCodigo = byId('painel_verificacao');
  const passo1 = formCadastro.querySelector('[data-etapa="1"]');
  const passo2 = formCadastro.querySelector('[data-etapa="2"]');
  const campoEmail = byId(empresa ? 'txt_email_cadastro_empresa' : 'txt_email_cadastro_cliente');
  const campoSenha = byId(empresa ? 'txt_senha_cadastro_empresa' : 'txt_senha_cadastro_cliente');
  const proximaUrl = voltarAposLogin(empresa ? 'painel-prestador.html' : 'busca.html');
  let emailPendente = '';
  let timerReenvio = null;

  function atualizarEtapa(etapa) {
    passo1.hidden = etapa !== 1;
    passo2.hidden = etapa !== 2;
    document.querySelectorAll('[data-etapa-status]').forEach((item) => {
      const numero = Number(item.dataset.etapaStatus);
      item.classList.toggle('atual', numero === etapa);
      item.classList.toggle('concluida', numero < etapa);
    });
    if (etapa === 1) passo1.querySelector('input,select')?.focus();
    if (etapa === 2) campoSenha.focus();
  }

  function validarEtapaAtual() {
    const campoInvalido = [...passo1.querySelectorAll('input,select')].find((campo) => !campo.checkValidity());
    if (campoInvalido) { campoInvalido.reportValidity(); return false; }
    return true;
  }

  function mostrarPainelCodigo(email, envioFalhou = false) {
    emailPendente = email.trim().toLowerCase();
    byId('email_verificacao').textContent = emailPendente;
    byId('erro_cadastro').hidden = true;
    formCadastro.hidden = true;
    painelCodigo.hidden = false;
    document.querySelectorAll('[data-etapa-status]').forEach((item) => {
      const numero = Number(item.dataset.etapaStatus);
      item.classList.toggle('atual', numero === 3);
      item.classList.toggle('concluida', numero < 3);
    });
    if (envioFalhou) {
      byId('erro_verificacao').textContent = 'A conta está salva, mas o código não saiu. Confira o serviço de e-mail e aguarde um minuto para reenviar.';
      byId('erro_verificacao').hidden = false;
      iniciarTimerReenvio(60);
    } else {
      iniciarTimerReenvio(60);
      byId('codigo_verificacao').focus();
    }
  }

  function iniciarTimerReenvio(segundos) {
    if (timerReenvio) clearInterval(timerReenvio);
    const botao = byId('btn_reenviar_codigo');
    let restante = segundos;
    const atualizar = () => {
      botao.disabled = restante > 0;
      botao.textContent = restante > 0 ? `Reenviar em ${restante}s` : 'Reenviar código';
      if (restante <= 0 && timerReenvio) { clearInterval(timerReenvio); timerReenvio = null; }
      restante -= 1;
    };
    atualizar();
    if (segundos > 0) timerReenvio = setInterval(atualizar, 1000);
  }

  document.querySelector('[data-proxima]').addEventListener('click', () => {
    if (validarEtapaAtual()) atualizarEtapa(2);
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

  campoSenha.addEventListener('input', () => {
    const valor = campoSenha.value;
    const nivel = [valor.length >= 8, /[A-Za-z]/.test(valor) && /\d/.test(valor), /[^A-Za-z0-9]/.test(valor)].filter(Boolean).length;
    byId(empresa ? 'forca_senha_empresa' : 'forca_senha_cliente').dataset.nivel = String(nivel);
    byId(empresa ? 'dica_senha_empresa' : 'dica_senha_cliente').textContent = !valor ? 'Use 8 ou mais caracteres e combine letras e números.' : ['Senha muito curta', 'Adicione letras e números', 'Boa senha', 'Senha forte'][nivel];
  });

  formCadastro.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!validarEtapaAtual()) return;
    const erro = byId('erro_cadastro');
    erro.hidden = true;
    const senha = campoSenha.value;
    if (new TextEncoder().encode(senha).length > 72) {
      erro.textContent = 'A senha é longa demais. Use até 72 bytes.'; erro.hidden = false; return;
    }
    if (!empresa && senha !== byId('txt_confirmar_senha_cadastro_cliente').value) {
      erro.textContent = 'As senhas não conferem. Digite a mesma senha nos dois campos.'; erro.hidden = false; return;
    }
    const dados = empresa ? {
      nome: byId('txt_nome_negocio_cadastro_empresa').value.trim(),
      categoria: byId('txt_categoria_cadastro_empresa').value,
      endereco: byId('txt_endereco_cadastro_empresa').value.trim(),
      email: campoEmail.value.trim().toLowerCase(), senha, tipo
    } : {
      nome: byId('txt_nome_cadastro_cliente').value.trim(),
      email: campoEmail.value.trim().toLowerCase(),
      telefone: byId('txt_telefone_cadastro_cliente').value.trim(), senha, tipo
    };
    const botao = byId(empresa ? 'btn_cadastrar_negocio' : 'btn_criar_conta_cliente');
    const textoOriginal = botao.textContent;
    botao.disabled = true; botao.textContent = 'Enviando código…';
    const resposta = await cadastrarConta(dados);
    botao.disabled = false; botao.textContent = textoOriginal;
    if (resposta.requerVerificacao) {
      mostrarPainelCodigo(resposta.email || dados.email, !resposta.sucesso);
      formCadastro.reset();
      if (!resposta.sucesso) return;
      toast('Código enviado. Confira sua caixa de entrada.', 'sucesso');
      return;
    }
    if (!resposta.sucesso) { erro.textContent = resposta.erro || 'Não foi possível criar sua conta.'; erro.hidden = false; return; }
  });

  byId('btn_reenviar_codigo').addEventListener('click', async () => {
    const botao = byId('btn_reenviar_codigo');
    botao.disabled = true;
    const resposta = await chamarAuth('reenviar-verificacao', { metodo: 'POST', dados: { email: emailPendente } });
    const erro = byId('erro_verificacao');
    erro.hidden = false;
    erro.textContent = resposta.sucesso ? 'Se a conta estiver aguardando confirmação, o novo código chegará em instantes.' : (resposta.erro || 'Não foi possível reenviar agora.');
    if (resposta.sucesso) iniciarTimerReenvio(60); else botao.disabled = false;
  });

  byId('codigo_verificacao').addEventListener('input', (evento) => { evento.target.value = evento.target.value.replace(/\D/g, '').slice(0, 6); });
  formCodigo.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const erro = byId('erro_verificacao');
    erro.hidden = true;
    const botao = byId('btn_verificar_email');
    botao.disabled = true; botao.textContent = 'Confirmando…';
    const resposta = await chamarAuth('verificar-email', { metodo: 'POST', dados: { email: emailPendente, codigo: byId('codigo_verificacao').value } });
    botao.disabled = false; botao.textContent = 'Confirmar e entrar';
    if (!resposta.sucesso) { erro.textContent = resposta.erro || 'Confira o código e tente novamente.'; erro.hidden = false; return; }
    salvarSessaoLocal(resposta.usuario);
    painelCodigo.classList.add('verificado');
    byId('titulo_verificacao').textContent = 'E-mail confirmado!';
    byId('texto_verificacao').textContent = 'Sua conta está pronta. Estamos preparando sua agenda.';
    formCodigo.hidden = true;
    document.querySelector('.resend-copy').hidden = true;
    setTimeout(() => { window.location.href = proximaUrl; }, 1100);
  });

  const emailQuery = new URLSearchParams(location.search).get('verificar');
  if (emailQuery) mostrarPainelCodigo(emailQuery);
})();
