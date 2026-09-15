// GET /api/price?sym=TSLA[&at=1757500000]  → { sym, yahoo, name, price, currency, atPrice, at, change, src }
// Stocks and majors via Yahoo Finance chart (no key). Crypto tickers get "-USD". Memecoins fall back to Dexscreener search (no history → atPrice null).
const CRYPTO = new Set(['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','DOT','TRX','TON','SHIB','PEPE','SUI','APT','ARB','OP','LTC','BCH','UNI','AAVE','HYPE','WIF','BONK','NEAR','ATOM','INJ','TIA','SEI','JUP','ENA','ONDO','RENDER','FET','TAO','KAS','XLM','HBAR','ALGO','FIL','ICP','ETC','MKR','LDO','CRV','PENDLE','VIRTUAL','FARTCOIN','TRUMP','PENGU','POPCAT','MOODENG','GOAT','PNUT','ACT','AI16Z','BERA','IP','KAITO','S']);
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const sym = String(req.query.sym || '').replace(/^\$/, '').toUpperCase().trim();
  const at = Number(req.query.at || 0) || null;
  if (!/^[A-Z0-9.\-]{1,12}$/.test(sym)) return res.status(400).json({ error: 'bad symbol' });
  const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36', accept: 'application/json' };
  const tryYahoo = async (y, host = 'query2') => {
    const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=3mo&interval=1d`, { headers: UA });
    if (!r.ok) return null; const j = await r.json(); const c = j.chart?.result?.[0]; if (!c || !c.meta) return null;
    const ts = c.timestamp || []; const cl = c.indicators?.quote?.[0]?.close || [];
    let atPrice = null;
    if (at && ts.length) { let best = -1; for (let i = 0; i < ts.length; i++) if (ts[i] <= at && cl[i] != null) best = i; if (best < 0) for (let i = 0; i < ts.length; i++) if (cl[i] != null) { best = i; break; } atPrice = best >= 0 ? cl[best] : null; }
    const price = c.meta.regularMarketPrice ?? null;
    return { sym, yahoo: y, name: c.meta.longName || c.meta.shortName || y, price, currency: c.meta.currency || 'USD', atPrice, at,
      exchange: c.meta.exchangeName || null, src: 'yahoo' };
  };
  const pick = (ts, cl) => { let atPrice = null; if (at && ts.length) { let best = -1; for (let i = 0; i < ts.length; i++) if (ts[i] <= at && cl[i] != null) best = i; if (best < 0) for (let i = 0; i < ts.length; i++) if (cl[i] != null) { best = i; break; } atPrice = best >= 0 ? cl[best] : null; } return atPrice; };
  const done = (o) => res.status(200).json({ ...o, change: (o.atPrice && o.price) ? +(((o.price / o.atPrice) - 1) * 100).toFixed(2) : null });
  try {
    const order = CRYPTO.has(sym) ? [`${sym}-USD`, sym] : [sym, `${sym}-USD`];
    for (const host of ['query2', 'query1']) for (const y of order) { try { const out = await tryYahoo(y, host); if (out && out.price != null) return done(out); } catch (e) { } }
  } catch (e) {}
  // Stooq daily CSV (stocks): Date,Open,High,Low,Close,Volume
  if (!CRYPTO.has(sym)) try {
    const r = await fetch(`https://stooq.com/q/d/l/?s=${sym.toLowerCase()}.us&i=d`, { headers: UA });
    if (r.ok) { const txt = await r.text(); const rows = txt.trim().split(/\r?\n/).slice(1).map(l => l.split(/[,;]/)).filter(a => a.length >= 5 && !isNaN(+a[4]));
      if (rows.length) { const ts = rows.map(a => Math.floor(Date.parse(a[0] + 'T21:00:00Z') / 1000)); const cl = rows.map(a => +a[4]);
        return done({ sym, yahoo: null, name: sym, price: cl[cl.length - 1], currency: 'USD', atPrice: pick(ts, cl), at, exchange: 'stooq', src: 'stooq' }); } }
  } catch (e) { }
  // Nasdaq historical (stocks): rows newest first, close like "$412.50"
  if (!CRYPTO.has(sym)) try {
    const d0 = new Date(Date.now() - 120 * 86400e3).toISOString().slice(0, 10), d1 = new Date().toISOString().slice(0, 10);
    const r = await fetch(`https://api.nasdaq.com/api/quote/${sym}/historical?assetclass=stocks&fromdate=${d0}&todate=${d1}&limit=9999`, { headers: { ...UA, accept: 'application/json, text/plain, */*', 'accept-language': 'en-US,en;q=0.9', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' } });
    if (r.ok) { const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch (e) {} const rows = (j?.data?.tradesTable?.rows || []).map(x => ({ t: Math.floor(Date.parse(x.date + ' 21:00:00 UTC') / 1000), c: +String(x.close).replace(/[$,]/g, '') })).filter(x => x.t && x.c).sort((a, b) => a.t - b.t);
      if (rows.length) { const ts = rows.map(x => x.t), cl = rows.map(x => x.c); let name = sym; try { const q = await fetch(`https://api.nasdaq.com/api/quote/${sym}/info?assetclass=stocks`, { headers: { ...UA, accept: 'application/json', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' } }); if (q.ok) { const qj = await q.json(); name = qj?.data?.companyName || sym; const lp = +String(qj?.data?.primaryData?.lastSalePrice || '').replace(/[$,]/g, ''); if (lp) cl.push(lp), ts.push(Math.floor(Date.now() / 1000)); } } catch (e) {}
        return done({ sym, yahoo: null, name, price: cl[cl.length - 1], currency: 'USD', atPrice: pick(ts, cl), at, exchange: 'nasdaq', src: 'nasdaq' }); } }
  } catch (e) { }
  // Coinbase daily candles (crypto): [time, low, high, open, close, volume], newest first
  try {
    const r = await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=86400`, { headers: UA });
    if (r.ok) { const c = (await r.json()); if (Array.isArray(c) && c.length) { c.sort((a, b) => a[0] - b[0]); const ts = c.map(a => a[0]); const cl = c.map(a => a[4]);
      return done({ sym, yahoo: null, name: sym, price: cl[cl.length - 1], currency: 'USD', atPrice: pick(ts, cl), at, exchange: 'coinbase', src: 'coinbase' }); } }
  } catch (e) { }
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`, { headers: { accept: 'application/json' } });
    if (r.ok) { const j = await r.json(); const ps = (j.pairs || []).filter(p => (p.baseToken?.symbol || '').toUpperCase() === sym).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      const p = ps[0]; if (p) return res.status(200).json({ sym, yahoo: null, name: p.baseToken?.name, price: +p.priceUsd, currency: 'USD', atPrice: null, at, change: null, chain: p.chainId, chart: p.url, src: 'dexscreener' }); }
  } catch (e) {}
  return res.status(200).json({ sym, price: null, exists: false, src: 'none' });
}
