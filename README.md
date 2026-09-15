# LOREPAD

No lore, no launch.

A launchpad on Robinhood Chain where every coin ships with lore: written once, before the first trade, sealed to the contract, and never edited.

- `index.html` — the pad: write the lore, seal it, read the chain, model the split
- `docs.html` — the seal algorithm, the fee split, live endpoint runners
- `api/handle.js` — X account lookup (FxTwitter, syndication fallback)
- `api/avatar.js` — profile image proxy
- `api/coin.js` — holders from Robinhood Chain Blockscout, price/mcap/volume from Dexscreener
- `api/price.js` — paired stock prices (Yahoo, Stooq, Nasdaq, Coinbase, Dexscreener)

The seal is FNV-1a over `TICKER|handle|lore`. Anyone can compute it; nobody has to trust us.

No contract address yet. Anyone posting one before it appears on the pad is scamming you.
