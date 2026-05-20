const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@superglazka.ru';

function loadTemplate(name, replacements) {
  const templatePath = path.join(__dirname, '..', 'templates', name + '.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp('{{' + key + '}}', 'g'), value);
  }
  return html;
}

async function sendNewEpisodeNotification(to, episodeTitle, episodeNumber, episodeUrl) {
  const html = loadTemplate('new-episode', {
    episodeTitle: episodeTitle || 'Новый эпизод',
    episodeNumber: String(episodeNumber || ''),
    episodeUrl: episodeUrl || '#',
    year: String(new Date().getFullYear())
  });

  const result = await resend.emails.send({
    from: 'Superglazka <' + FROM_EMAIL + '>',
    to: [to],
    subject: '\uD83C\uDF1F Новый эпизод Суперглазки: ' + (episodeTitle || 'Эпизод ' + episodeNumber),
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

module.exports = { sendNewEpisodeNotification, sendBulkNewEpisode };
