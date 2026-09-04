// netlify/functions/check-signals.js
// Función programada (cron) que revisa señales TD Sequential y envía push
// a todas las suscripciones guardadas cuando aparece una señal nueva.

const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['1h', '4h', '1d']; // agrega '1w' / '1M' si quieres cubrir más plazos
const TF_LABEL = { '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W', '1M': '1M' };

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function computeTD(closes) {
  let buyCount = 0, sellCount = 0;
  const out = [];
  for (let i = 0; i < closes.length; i++) {
    let signal = null;
    if (i >= 4) {
      if (closes[i] < closes[i - 4]) { buyCount += 1; sellCount = 0; }
      else if (closes[i] > closes[i - 4]) { sellCount += 1; buyCount = 0; }
      else { buyCount = 0; sellCount = 0; }
      if (buyCount === 9) { signal = 'BUY'; buyCount = 0; }
      if (sellCount === 9) { signal = 'SELL'; sellCount = 0; }
    }
    out.push({ signal });
  }
  return out;
}

async function fetchKlines(symbol, interval, limit) {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status} for ${symbol} ${interval}`);
  const data = await res.json();
  return data.map(k => ({ close: parseFloat(k[4]), closeTime: k[6] }));
}

async function getAllSubscriptions(subStore) {
  const list = await subStore.list();
  const subs = [];
  for (const item of list.blobs) {
    const sub = await subStore.get(item.key, { type: 'json' });
    if (sub) subs.push({ key: item.key, sub });
  }
  return subs;
}

exports.handler = async () => {
  const stateStore = getStore('signal-state');
  const subStore = getStore('push-subscriptions');

  const subscriptions = await getAllSubscriptions(subStore);
  if (subscriptions.length === 0) {
    return { statusCode: 200, body: 'Sin suscripciones activas, nada que enviar.' };
  }

  const results = [];

  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      try {
        const candles = await fetchKlines(symbol, tf, 30);
        const closes = candles.map(c => c.close);
        const td = computeTD(closes);
        const last = td[td.length - 1];
        if (!last.signal) continue;

        const barTime = candles[candles.length - 1].closeTime;
        const stateKey = `${symbol}_${tf}`;
        const prevState = await stateStore.get(stateKey, { type: 'json' });

        if (prevState && prevState.lastBarTime === barTime) {
          continue; // ya se avisó esta vela, evita duplicados
        }

        await stateStore.setJSON(stateKey, { lastBarTime: barTime, signal: last.signal });

        const isBuy = last.signal === 'BUY';
        const label = symbol.replace('USDT', '/USDT');
        const payload = JSON.stringify({
          title: 'JAEM · TD Sequential',
          body: `${isBuy ? '▲' : '▼'} ${isBuy ? 'COMPRA' : 'VENTA'} 9 en ${label} · ${TF_LABEL[tf]}`,
          signal: last.signal,
          tag: `td-${symbol}-${tf}`
        });

        for (const { key, sub } of subscriptions) {
          try {
            await webpush.sendNotification(sub, payload);
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              // suscripción caducada o inválida: la eliminamos
              await subStore.delete(key);
            } else {
              console.error('push send error', symbol, tf, err.message);
            }
          }
        }

        results.push(`${symbol} ${tf}: ${last.signal}`);
      } catch (err) {
        console.error('check-signals error', symbol, tf, err.message);
      }
    }
  }

  return {
    statusCode: 200,
    body: results.length ? `Señales enviadas: ${results.join(', ')}` : 'Sin señales nuevas.'
  };
};
