const nodemailer = require('nodemailer');

function configurado() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function enviar({ para, assunto, html }) {
  if (!configurado()) return false;
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({ from: process.env.EMAIL_FROM || `NexusGov <${process.env.SMTP_USER}>`, to: para, subject: assunto, html });
    return true;
  } catch (e) {
    console.error('email:', e.message);
    return false;
  }
}

const moldura = (titulo, corpo) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#0b1220;color:#e5e7eb;border-radius:14px">
<h2 style="margin:0 0 14px;color:#60a5fa">${titulo}</h2>${corpo}
<p style="margin-top:28px;color:#64748b;font-size:12px">NexusGov — controle de vendas para governo</p></div>`;

module.exports = { enviar, configurado, moldura };
