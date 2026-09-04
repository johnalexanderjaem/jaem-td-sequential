// netlify/functions/unsubscribe.js
// Elimina una suscripción push guardada (cuando el usuario desactiva las alertas).

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { endpoint } = JSON.parse(event.body);
    if (!endpoint) return { statusCode: 400, body: 'Falta endpoint' };

    const store = getStore('push-subscriptions');
    const key = Buffer.from(endpoint).toString('base64').slice(0, 200);
    await store.delete(key);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('unsubscribe error', err);
    return { statusCode: 500, body: 'Error eliminando la suscripción' };
  }
};
