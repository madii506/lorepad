// GET /api/handle?h=MrBeast  → { handle, name, followers, verified, avatar, exists, src }
// Source: FxTwitter public API (no auth). Fallback: X syndication timeline HTML.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  const h = String(req.query.h || '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return res.status(400).json({ error: 'bad handle' });
  const UA = { 'user-agent': 'Mozilla/5.0 (compatible; callbot/1.0)' };
  try {
    const r = await fetch(`https://api.fxtwitter.com/${h}`, { headers: UA });
    if (r.status === 404) return res.status(200).json({ handle: h, exists: false, src: 'fxtwitter' });
    if (r.ok) {
      const j = await r.json();
      const u = j.user || {};
      if (u.screen_name) {
        return res.status(200).json({
          handle: u.screen_name, name: u.name || h, followers: u.followers ?? null,
          following: u.following ?? null, tweets: u.tweets ?? null,
          verified: !!(u.verified || u.is_blue_verified),
          avatar: (u.avatar_url || '').replace('_normal', '_400x400'),
          banner: u.banner_url || null, description: u.description || '',
          joined: u.joined || null, exists: true, src: 'fxtwitter'
        });
      }
    }
  } catch (e) {}
  try {
    const r = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${h}`, { headers: UA });
    const html = await r.text();
    const m = html.match(/"followers_count":(\d+)/); const n = html.match(/"name":"([^"]{1,60})","normal_followers/);
    const a = html.match(/"profile_image_url_https":"([^"]+)"/);
    if (m) return res.status(200).json({ handle: h, name: n ? n[1] : h, followers: +m[1], verified: /"verified":true/.test(html),
      avatar: a ? a[1].replace('_normal', '_400x400') : null, exists: true, src: 'syndication' });
    if (r.status === 404 || /doesn.t exist|Nothing here/i.test(html)) return res.status(200).json({ handle: h, exists: false, src: 'syndication' });
  } catch (e) {}
  return res.status(200).json({ handle: h, exists: null, src: 'none' });
}
