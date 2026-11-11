// Shared state between the Privy React tree and the non-React chain API.
const listeners = new Set();
export const privy = {
  enabled: false, // true once PrivyRoot mounts
  ready: false,
  address: null, // NEAR implicit account created for the X login
  handle: null, // @username from X
  account: null, // near-api-js Account that signs with Privy
  loginX: null,
  logout: null,
};
export function setPrivy(patch) {
  // Privy hooks hand back new functions/Account objects every render; only real state changes should refetch
  const changed = Object.entries(patch).some(([k, v]) => typeof v !== "function" && k !== "account" && privy[k] !== v);
  Object.assign(privy, patch);
  if (changed) listeners.forEach((f) => f());
}
export function onPrivy(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}
