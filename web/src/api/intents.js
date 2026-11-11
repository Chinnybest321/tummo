// NEAR Intents 1Click: fund a NEAR wallet from any chain.
const API = "https://1click.chaindefuser.com/v0";
const KEY = import.meta.env.VITE_ONECLICK_KEY;
const headers = { "Content-Type": "application/json", ...(KEY ? { "X-API-Key": KEY } : {}) };

export const WNEAR = "nep141:wrap.near";

export async function tokens() {
  const r = await fetch(`${API}/tokens`, { headers });
  if (!r.ok) throw new Error(`tokens ${r.status}`);
  const list = await r.json();
  const want = ["usdc", "usdt", "eth", "sol", "btc"];
  return list
    .filter((t) => want.includes(t.symbol.toLowerCase()) && t.assetId !== WNEAR)
    .sort((a, b) => want.indexOf(a.symbol.toLowerCase()) - want.indexOf(b.symbol.toLowerCase()));
}

export async function quote({ token, amount, refundTo, recipient, dry }) {
  const base = BigInt(Math.round(Number(amount) * 1e6)) * 10n ** BigInt(token.decimals) / 1000000n;
  const r = await fetch(`${API}/quote`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      dry,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: token.assetId,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: WNEAR,
      amount: base.toString(),
      refundTo: refundTo || recipient,
      refundType: "ORIGIN_CHAIN",
      recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      referral: "tick",
    }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.message || `quote ${r.status}`);
  return json.quote;
}

export async function status(depositAddress) {
  const r = await fetch(`${API}/status?depositAddress=${encodeURIComponent(depositAddress)}`, { headers });
  return (await r.json()).status;
}
