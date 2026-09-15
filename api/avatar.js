// GET /api/avatar?h=Cupseyy → the account's X profile image bytes (proxied, cached a day). Fallback for browsers that block pbs.twimg.com.
export default async function handler(req, res) {
  const h = String(req.query.h || '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return res.status(400).end();
  try {
    const r = await fetch(`https://api.fxtwitter.com/${h}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; callbot/1.0)' } });
    const j = r.ok ? await r.json() : null; let url = j?.user?.avatar_url; if (!url) return res.status(404).end();
    url = url.replace('_normal', '_400x400');
    let im = await fetch(url); if (!im.ok) im = await fetch(url.replace('_400x400', '_normal')); if (!im.ok) return res.status(404).end();
    const buf = Buffer.from(await im.arrayBuffer());
    res.setHeader('Content-Type', im.headers.get('content-type') || 'image/jpeg'); res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    return res.status(200).send(buf);
  } catch (e) { return res.status(502).end(); }
}
