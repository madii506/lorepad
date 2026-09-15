// GET /api/coin?ca=0x…  → { ca, name, symbol, holders, supply, price, marketCap, liquidity, volume24, feeIncome24, holderYield, chart, pair, exists }
// Sources: Robinhood Chain Blockscout (holders/supply) + Dexscreener (price/mcap/volume). No invented numbers.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const ca = String(req.query.ca || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(ca)) return res.status(400).json({ error: 'bad address' });
  const out = { ca, exists: null, name: null, symbol: null, holders: null, supply: null, price: null, marketCap: null,
    liquidity: null, volume24: null, feeIncome24: null, holderYield: null, chart: null, pair: null, src: [] };
  try {
    const r = await fetch(`https://robinhoodchain.blockscout.com/api/v2/tokens/${ca}`, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' } });
    out.bs = r.status;
    if (r.status === 404) out.exists = false;
    if (r.ok) { const j = await r.json(); out.exists = true; out.name = j.name; out.symbol = j.symbol;
      out.holders = j.holders_count != null ? +j.holders_count : (j.holders != null ? +j.holders : null);
      out.supply = j.total_supply && j.decimals ? Number(j.total_supply) / 10 ** Number(j.decimals) : null; out.src.push('blockscout'); }
  } catch (e) {}
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { headers: { accept: 'application/json' } });
    if (r.ok) { const j = await r.json(); const pairs = (j.pairs || []).filter(p => !p.chainId || /robinhood/i.test(p.chainId) || true);
      pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      const p = pairs[0];
      if (p) { out.exists = true; out.name = out.name || p.baseToken?.name; out.symbol = out.symbol || p.baseToken?.symbol;
        out.price = p.priceUsd ? +p.priceUsd : null; out.marketCap = p.marketCap ?? p.fdv ?? null; out.liquidity = p.liquidity?.usd ?? null;
        out.volume24 = p.volume?.h24 ?? null; out.chart = p.url; out.pair = p.pairAddress; out.chain = p.chainId; out.logo = p.info?.imageUrl || null;
        if (out.volume24 != null) out.feeIncome24 = +(out.volume24 * 0.007).toFixed(2);           // 70% creator share of the 1% Pons fee
        if (out.feeIncome24 != null && out.marketCap) out.holderYield = +((out.feeIncome24 * 365 / out.marketCap) * 100).toFixed(2); // % APY
        out.src.push('dexscreener'); }
    }
  } catch (e) {}
  return res.status(200).json(out);
}
