const store = getStore({
  name: 'push-subscriptions',
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_API_TOKEN
});
const key = Buffer.from(endpoint).toString('base64').slice(0, 200);
await store.delete(key);

return { statusCode: 200, body: JSON.stringify({ ok: true }) };
