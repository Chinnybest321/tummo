import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { actionCreators } from "@near-js/transactions";
import "@near-wallet-selector/modal-ui/styles.css";
import { privy, onPrivy } from "../auth/bridge.js";

const NETWORK = import.meta.env.VITE_NETWORK || "testnet";
const CONTRACT = import.meta.env.VITE_CONTRACT_ID;
if (!CONTRACT) throw new Error("VITE_CONTRACT_ID is not set. Put the deployed contract account in web/.env");
// free public RPCs throttle per IP, each on its own; rotate to the next one when one refuses
const RPCS = NETWORK === "mainnet" ? ["https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"] : ["https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"];
let rpcI = 0;
const GAS = 100_000_000_000_000n;
export const EXPLORER = `https://${NETWORK === "mainnet" ? "" : "testnet."}nearblocks.io/address/${CONTRACT}`;

async function rpc(method, params, tries = 4) {
  let r;
  const url = RPCS[rpcI];
  try {
    r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "tummo", method, params }) });
    if (r.status === 429) throw new Error("rate limited");
  } catch (e) {
    // public RPC throttles bursts; its 429s lack CORS headers so they surface as fetch errors
    if (tries <= 1) throw e;
    if (RPCS[rpcI] === url) rpcI = (rpcI + 1) % RPCS.length;
    await new Promise((ok) => setTimeout(ok, 300 * (5 - tries) + Math.random() * 300));
    return rpc(method, params, tries - 1);
  }
  const j = await r.json();
  if (j.error) throw new Error(j.error.data || j.error.message);
  if (j.result?.error) throw new Error(j.result.error);
  return j.result;
}
async function view(method, args = {}) {
  const r = await rpc("query", { request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
}

let selP, cfgP, lockP;
let current = null;
const listeners = new Set();
function selector() {
  selP ??= setupWalletSelector({ network: NETWORK, modules: [setupMeteorWallet(), setupMyNearWallet(), setupHereWallet()] }).then((sel) => {
    // the store emits often; only wake listeners when the signed-in account changes
    const sync = (st) => {
      const next = st.accounts.find((a) => a.active)?.accountId || null;
      if (next === current) return;
      current = next;
      listeners.forEach((f) => f());
    };
    sync(sel.store.getState());
    sel.store.observable.subscribe(sync);
    return { sel, modal: setupModal(sel, { contractId: CONTRACT }) };
  });
  return selP;
}
// Who is signed in: an X login (Privy) wins over a wallet.
const who = () => privy.address || current;

async function send(method, args = {}, deposit = 0n) {
  if (privy.account) {
    return privy.account.callFunction({ contractId: CONTRACT, methodName: method, args, deposit, gas: GAS });
  }
  const { sel } = await selector();
  return (await sel.wallet()).signAndSendTransaction({ receiverId: CONTRACT, actions: [actionCreators.functionCall(method, args, GAS, deposit)] });
}

export const chain = {
  mode: "chain",
  network: NETWORK,
  subscribe(f) {
    listeners.add(f);
    selector();
    const off = onPrivy(f);
    const id = setInterval(f, 6000); // free public RPC throttles; keep polling light
    return () => {
      listeners.delete(f);
      off();
      clearInterval(id);
    };
  },
  async account() {
    await selector();
    return who();
  },
  // a new X account is an implicit account: it only exists once it holds NEAR
  async balance() {
    if (!who()) return "0";
    try {
      return (await rpc("query", { request_type: "view_account", finality: "optimistic", account_id: who() })).amount;
    } catch {
      return "0";
    }
  },
  identity: () => (privy.address ? { via: "x", handle: privy.handle, address: privy.address } : current ? { via: "wallet", address: current } : null),
  xEnabled: () => privy.enabled,
  connectX: () => privy.loginX?.(),
  connect: async () => (await selector()).modal.show(),
  async disconnect() {
    if (privy.address) return privy.logout?.();
    const { sel } = await selector();
    await (await sel.wallet()).signOut();
  },
  async pet() {
    const p = await view("get_pet");
    return { ...p, top: p.top };
  },
  feeder: (who) => view("get_feeder", { account_id: who }),
  // config never changes and the lock rarely does: fetch once per page load (retry if it failed)
  config: () => (cfgP ??= view("get_config").catch((e) => ((cfgP = null), Promise.reject(e)))),
  // a locked coin has no access keys, so nobody can redeploy or touch its funds
  locked: () =>
    (lockP ??= rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: CONTRACT })
      .then((r) => ({ locked: r.keys.length === 0, keys: r.keys.length, explorer: EXPLORER }))
      .catch((e) => ((lockP = null), Promise.reject(e)))),
  graves: () => view("get_graves", { limit: 20 }),
  activity: () => view("get_activity", { limit: 40 }),
  quote: (n) => view("quote", { count: n }),
  async buy(n) {
    const q = BigInt(await view("quote", { count: n }));
    return send("buy", { count: n }, q + q / 50n); // headroom; extra is refunded on-chain
  },
  feed: (n) => send("feed", { count: n }),
  claim: () => send("claim"),
  sellQuote: (n) => view("sell_quote", { count: n }),
  // Sell TUMMO to the treasury. A wallet gets the NEAR directly; an X account can
  // forward exactly what the sale brought in to another address.
  async sell(n, to) {
    if (!to) return send("sell", { count: n });
    if (!privy.account) throw new Error("Only X accounts can forward to another address");
    const before = BigInt(await chain.balance());
    await send("sell", { count: n });
    let got = 0n;
    for (let i = 0; i < 8 && got <= 0n; i++) {
      await new Promise((ok) => setTimeout(ok, 1000)); // the payout lands a block or two after the sale
      got = BigInt(await chain.balance()) - before;
    }
    if (got <= 0n) throw new Error("Sold, but the NEAR hasn't arrived yet. Use the NEAR tab to send it.");
    return privy.account.transfer({ receiverId: to, amount: got });
  },
  // X accounts only: wallet users already hold their own keys and send from their wallet
  withdraw(to, yocto) {
    if (!privy.account) throw new Error("Withdraw is for X accounts. Send from your wallet instead.");
    return privy.account.transfer({ receiverId: to, amount: yocto });
  },
  bury: () => send("bury"),
};
