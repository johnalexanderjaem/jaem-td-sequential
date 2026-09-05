// netlify/functions/test-push.js
// Envía una notificación push de PRUEBA a todas las suscripciones guardadas.
// Útil para verificar sonido/vibración sin esperar una señal real.

const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const BLOBS_CONFIG = {
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_API_TOKEN
};

exports.handler = async () => {
  const subStore = getStore({ name: 'push-subscriptions', ...BLOBS_CONFIG });
  const list = await subStore.list();

  if (!list.blobs.length) {
    return { statusCode: 200, body: 'No hay suscripciones guardadas todavía.' };
  }

  const payload = JSON.stringify({
    title: 'JAEM · TD Sequential',
    body: '🔔 Esta es una alerta de prueba. Si la escuchaste, las notificaciones funcionan.',
    signal: 'BUY',
    tag: 'jaem-td-test'
  });

  let sent = 0, failed = 0;

  for (const item of list.blobs) {
    try {
      const sub = await subStore.get(item.key, { type: 'json' });
      if (!sub) continue;
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      failed++;
      console.error('test-push error', err.message);
    }
  }

  return { statusCode: 200, body: `Prueba enviada. Éxito: ${sent}, fallidas: ${failed}` };
};
