const RESEND_URL = 'https://api.resend.com/emails';

function escaparHtml(valor) {
    return String(valor || '').replace(/[&<>"']/g, (caractere) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

async function enviarBoasVindas(usuario) {
    const apiKey = process.env.RESEND_API_KEY;
    const remetente = process.env.RESEND_FROM;
    if (!apiKey || !remetente) {
        console.info('Resend não configurado: boas-vindas por e-mail ignoradas.');
        return { enviado: false, motivo: 'nao_configurado' };
    }

    const nome = escaparHtml(usuario.nome);
    const prestador = usuario.tipo === 'empresa';
    const destino = prestador ? 'meu-negocio.html' : 'busca.html';
    const acao = prestador ? 'Configure seu negócio e publique seus serviços.' : 'Encontre um prestador e marque seu próximo horário.';
    const urlBase = (process.env.SAOPS_PUBLIC_URL || 'https://saops-zjyx.onrender.com').replace(/\/$/, '');
    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f7fc;font-family:Arial,sans-serif;color:#191d31"><div style="max-width:560px;margin:36px auto;padding:36px;background:#fff;border:1px solid #e2e5ef;border-radius:20px"><p style="color:#5756d9;font-weight:bold;letter-spacing:2px">SAOPS</p><h1 style="font-size:26px">Olá, ${nome}!</h1><p>Sua conta foi criada. ${acao}</p><a href="${escaparHtml(urlBase)}/${destino}" style="display:inline-block;margin-top:12px;padding:13px 20px;border-radius:10px;background:#5756d9;color:#fff;text-decoration:none;font-weight:bold">Acessar o SAOPS</a><p style="margin-top:32px;color:#697089;font-size:13px">Você recebeu este e-mail porque criou uma conta no SAOPS.</p></div></body></html>`;

    const resposta = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: remetente, to: [usuario.email], subject: 'Bem-vindo ao SAOPS', html })
    });
    if (!resposta.ok) {
        const detalhe = await resposta.text();
        throw new Error(`Resend respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`);
    }
    return { enviado: true };
}

module.exports = { enviarBoasVindas };
