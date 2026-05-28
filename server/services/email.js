const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@vidial-media.ru';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadTemplate(name, replacements) {
  const templatePath = path.join(__dirname, '..', 'templates', name + '.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp('{{' + key + '}}', 'g'), escapeHtml(value));
  }
  return html;
}

async function sendNewEpisodeNotification(to, episodeTitle, episodeNumber, episodeUrl) {
  const html = loadTemplate('new-episode', {
    episodeTitle: episodeTitle || 'Новая глава',
    episodeNumber: String(episodeNumber || ''),
    episodeUrl: episodeUrl || '#',
    year: String(new Date().getFullYear())
  });

  const result = await resend.emails.send({
    from: 'Superglazka <' + FROM_EMAIL + '>',
    to: [to],
    subject: '\uD83C\uDF1F Новая глава Суперглазки: ' + (episodeTitle || 'Глава ' + episodeNumber),
    html: html
  });

  return result;
}

async function sendBulkNewEpisode(subscribers, episodeTitle, episodeNumber, episodeUrl) {
  const results = [];
  for (const sub of subscribers) {
    try {
      const result = await sendNewEpisodeNotification(sub.email, episodeTitle, episodeNumber, episodeUrl);
      results.push({ email: sub.email, status: 'sent', id: result.data?.id });
    } catch (err) {
      results.push({ email: sub.email, status: 'error', error: err.message });
    }
  }
  return results;
}

async function sendConfirmationEmail(to, confirmToken) {
  const confirmUrl = (process.env.FRONTEND_URL || 'https://vidial-media.ru') + '/api/subscribe/confirm/' + confirmToken;
  const html = loadTemplate('confirm-email', {
    confirmUrl: confirmUrl,
    year: String(new Date().getFullYear())
  });

  const result = await resend.emails.send({
    from: 'Superglazka <' + FROM_EMAIL + '>',
    to: [to],
    subject: 'Подтвердите подписку на Суперглазку',
    html: html
  });

  return result;
}

async function sendVerificationEmail(to, token) {
  const verifyUrl = (process.env.FRONTEND_URL || 'https://vidial-media.ru') + '/?verify=' + encodeURIComponent(token);
  const html = loadTemplate('verify-email', {
    verifyUrl: verifyUrl,
    year: String(new Date().getFullYear())
  });

  const result = await resend.emails.send({
    from: 'Superglazka <' + FROM_EMAIL + '>',
    to: [to],
    subject: 'Подтвердите email для Суперглазки',
    html: html
  });

  return result;
}

async function sendPasswordResetEmail(to, token) {
  const resetUrl = (process.env.FRONTEND_URL || 'https://vidial-media.ru') + '/?reset=' + encodeURIComponent(token);
  const html = loadTemplate('reset-password', {
    resetUrl: resetUrl,
    year: String(new Date().getFullYear())
  });

  const result = await resend.emails.send({
    from: 'Superglazka <' + FROM_EMAIL + '>',
    to: [to],
    subject: 'Сброс пароля в Суперглазке',
    html: html
  });

  return result;
}

module.exports = { sendNewEpisodeNotification, sendBulkNewEpisode, sendConfirmationEmail, sendVerificationEmail, sendPasswordResetEmail };
