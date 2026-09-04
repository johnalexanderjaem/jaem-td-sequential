// netlify/functions/subscribe.js
// Recibe la suscripción push del navegador y la guarda en Netlify Blobs.

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const subscription = JSON.parse(event.body);
    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: 'Suscripción inválida' };
    }

    const store = getStore('push-subscriptions');
    const key = Buffer.from(subscription.endpoint).toString('base64').slice(0, 200);
    await store.setJSON(key, subscription);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('subscribe error', err);
    return { statusCode: 500, body: 'Error guardando la suscripción' };
  }
};
