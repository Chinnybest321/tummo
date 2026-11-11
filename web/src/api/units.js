export const YOCTO = 10n ** 24n;
export const TUMMO = 10n ** 18n;

export const BASE_PRICE = YOCTO / 1000n;
export const PRICE_STEP = YOCTO / 10_000_000n;
export const SECONDS_PER_TUMMO = 600;
export const MAX_AHEAD = 72 * 3600;
export const EGG_LIFE = 24 * 3600;
export const RESCUE_WINDOW = 6 * 3600;
export const DRIP_BPS_PER_DAY = 300n;
export const FEAST_FEEDERS = 10;
export const FEAST_MIN_FEED = 25;
export const FEAST_MIN_AGE = 3600;
export const LEVEL_UNIT = 250n;
export const FEAST_BONUS = 12 * 3600;

export const nowS = () => Math.floor(Date.now() / 1000);

export function isqrt(n) {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
export const levelOf = (eaten) => Number(isqrt(BigInt(eaten) / LEVEL_UNIT));
export const secondsPerTummo = (level) => Math.max(10, Math.floor(SECONDS_PER_TUMMO / (1 + level)));

export function cost(minted, count) {
  const n = BigInt(count), m = BigInt(minted);
  return n * BASE_PRICE + PRICE_STEP * (n * m + (n * (n > 0n ? n - 1n : 0n)) / 2n);
}

export function mood(pet, now) {
  if (!pet) return "ok";
  const left = pet.life.deadline - now;
  if (left <= 0) return "dead";
  if (BigInt(pet.life.eaten) === 0n) return "egg";
  if (left <= RESCUE_WINDOW) return "starving";
  if (left <= 12 * 3600) return "hungry";
  if (left >= 48 * 3600) return "happy";
  return "ok";
}

export function near(raw, dp = 3) {
  const v = BigInt(raw || 0);
  const whole = v / YOCTO;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, dp);
  return dp ? `${whole.toLocaleString("en-US")}.${frac}` : whole.toLocaleString("en-US");
}

// "1.5" NEAR -> yoctoNEAR; null if it isn't a plain positive decimal
export function toYocto(s) {
  const m = /^(\d+)(?:\.(\d{0,24}))?$/.exec(String(s).trim());
  return m ? BigInt(m[1]) * YOCTO + BigInt((m[2] || "").padEnd(24, "0")) : null;
}
// named (alice.testnet) or implicit (64 hex) account, per NEAR's account-id rules
export const isAccountId = (a) => a.length >= 2 && a.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a);
// left behind on a withdraw: pays the account's storage and the transfer's gas
export const WITHDRAW_KEEP = YOCTO / 100n;

export const tummos = (raw) => Number(BigInt(raw || 0) / TUMMO).toLocaleString("en-US");

export function span(s) {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${p(h)}h ${p(m)}m`;
  if (h > 0) return `${h}h ${p(m)}m ${p(x)}s`;
  return `${m}m ${p(x)}s`;
}

export function short(a) {
  if (!a) return "";
  return a.length > 18 ? `${a.slice(0, 7)}…${a.slice(-6)}` : a;
}

export function ago(t) {
  const d = Math.max(0, nowS() - t);
  if (d < 60) return `${Math.max(1, d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export function age(born, until) {
  const s = Math.max(0, until - born);
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m`;
}

