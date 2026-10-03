const RESEND_URL = 'https://api.resend.com/emails';

function escaparHtml(valor) {
    return String(valor || '').replace(/[&<>"']/g, (caractere) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

async function enviarCodigoVerificacao(usuario, codigo) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Resend não está configurado no servidor.');
    const remetente = process.env.RESEND_FROM || 'SAOPS <onboarding@resend.dev>';
    const nome = escaparHtml(usuario.nome);
    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f7fc;font-family:Arial,sans-serif;color:#191d31"><div style="max-width:560px;margin:36px auto;padding:36px;background:#fff;border:1px solid #e2e5ef;border-radius:20px"><p style="color:#5756d9;font-weight:bold;letter-spacing:2px">SAOPS</p><p style="color:#697089">Confirmação de conta</p><h1 style="font-size:25px">Olá, ${nome}.</h1><p>Use o código abaixo para confirmar seu e-mail e ativar sua conta:</p><div style="margin:26px 0;padding:18px;border-radius:14px;background:#f0f1ff;color:#4544bd;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px">${escaparHtml(codigo)}</div><p>O código expira em 10 minutos. Se você não criou uma conta no SAOPS, ignore esta mensagem.</p></div></body></html>`;
    const resposta = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: remetente,
            to: [usuario.email],
            subject: `${codigo} é seu código de verificação do SAOPS`,
            html
        })
    });
    if (!resposta.ok) {
        const detalhe = await resposta.text();
        throw new Error(`Resend respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`);
    }
    return true;
}

module.exports = { enviarCodigoVerificacao };
