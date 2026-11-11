import { useEffect, useRef, useState } from "react";
import { getApi, useLive, useAccount, useNow } from "./api/index.js";
import { toYocto, isAccountId, WITHDRAW_KEEP, mood as moodOf, span, near, tummos, short, ago, age, levelOf, secondsPerTummo, RESCUE_WINDOW, FEAST_FEEDERS, cost } from "./api/units.js";
import Pet from "./ui/Pet.jsx";
import { Wordmark, FeastDots, Bubble, Tomb, Crumbs } from "./ui/Doodles.jsx";
import Onboarding, { isNewPlayer } from "./ui/Onboarding.jsx";
import Landing from "./ui/Landing.jsx";

const SAYS = { egg: "…", happy: "so full", ok: "hi", hungry: "hungry", starving: "help", munch: "nom nom", dead: "" };
const FEED_STEPS = [1, 5, 20, 100];
const BUY_STEPS = [10, 50, 200, 1000];

export default function App() {
  const now = useNow();
  const account = useAccount();
  const [pet] = useLive((api) => api.pet(), []);
  const [me] = useLive((api) => (account ? api.feeder(account) : Promise.resolve(null)), [account]);
  const [graves] = useLive((api) => api.graves(), []);
  const [log] = useLive((api) => api.activity(), []);
  const [cfg] = useLive((api) => api.config(), []);
  const [lock] = useLive((api) => api.locked(), []);
  const [bal, setBal] = useState("0");
  const [mode, setMode] = useState("feed");
  const [feedN, setFeedN] = useState(5);
  const [buyN, setBuyN] = useState(50);
  const [tab, setTab] = useState("feeders");
  const [busy, setBusy] = useState("");
  const [munch, setMunch] = useState(false);
  const [fed, setFed] = useState(0);
  const [toast, setToast] = useState(null);
  const [how, setHow] = useState(false);
  const [intro, setIntro] = useState(false); // opened from "How it works"
  const [, seen] = useState(0);
  const [signIn, setSignIn] = useState(false);
  const [ident, setIdent] = useState(null);
  const [xOn, setXOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [wd, setWd] = useState(null); // cash-out form: { kind: "tummo" | "near", to, amt }
  const [sq, setSq] = useState(null); // NEAR a TUMMO sale would pay
  const tRef = useRef();

  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    getApi().then((api) => {
      if (!alive) return;
      const f = () => {
        api.account().then(() => setReady(true));
        api.balance().then(setBal).catch(() => {});
        setIdent(api.identity?.() || null);
        setXOn(!!api.xEnabled?.());
      };
      f();
      unsub = api.subscribe(f);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [account]);

  const say = (msg, bad) => {
    clearTimeout(tRef.current);
    setToast({ msg, bad });
    tRef.current = setTimeout(() => setToast(null), 2600);
  };
  async function act(label, fn, ok) {
    setBusy(label);
    try {
      await fn(await getApi());
      if (ok) say(ok);
      return true;
    } catch (e) {
      say(e.message || String(e), true);
      return false;
    } finally {
      setBusy("");
    }
  }
  const connect = () => setSignIn(true);
  const viaWallet = async () => {
    setSignIn(false);
    (await getApi()).connect();
  };
  const viaX = async () => {
    setSignIn(false);
    try {
      await (await getApi()).connectX();
    } catch (e) {
      say(`X sign-in failed: ${e?.message || e}`, true);
    }
  };
  const signInSheet = signIn && (
        <div className="sheet-bg" onClick={() => setSignIn(false)}>
          <div className="sheet signin" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}>
            <Pet mood="happy" level={2} size={150} />
            <h2>Join Tummo</h2>
            {xOn && (
              <button className="solid lg wide xbtn" onClick={viaX}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58l11.09 14.47Z" /></svg>
                Continue with X
              </button>
            )}
            <button className={`${xOn ? "ghost" : "solid"} lg wide`} onClick={viaWallet}>Use a NEAR wallet</button>
            {xOn && <p className="signin-note">Signing in with X creates a NEAR account for you.</p>}
          </div>
        </div>
      );
  const signOut = async () => (await getApi()).disconnect();

  const needsFunds = account && bal === "0";

  const left = pet ? pet.life.deadline - now : 0;
  const base = moodOf(pet, now);
  const mood = munch && base !== "dead" ? "munch" : base;
  const lvl = pet ? levelOf(pet.life.eaten) : 0;
  const rescue = base === "starving";
  const myTummo = me ? BigInt(me.tummo) / 10n ** 18n : 0n;
  const feedable = Math.max(1, Number(feedN) || 1);
  // ---- cash out: sell TUMMO for NEAR (everyone), or send NEAR out (X accounts) ----
  const isX = ident?.via === "x";
  const sellN = wd?.kind === "tummo" ? Number(wd.amt) || 0 : 0;
  useEffect(() => {
    let ok = true;
    const id = setTimeout(() => (sellN ? getApi().then((a) => a.sellQuote(sellN)).then((q) => ok && setSq(q)).catch(() => ok && setSq(null)) : setSq(null)), 300);
    return () => {
      ok = false;
      clearTimeout(id);
    };
  }, [sellN]);
  const wdMax = BigInt(bal || 0) > WITHDRAW_KEEP ? BigInt(bal) - WITHDRAW_KEEP : 0n;
  const wdTo = wd?.to.trim().toLowerCase() || "";
  const wdYocto = wd?.kind === "near" ? toYocto(wd.amt) : null;
  const toErr = !wdTo ? "Enter an address" : !isAccountId(wdTo) ? "That isn't a NEAR address" : wdTo === account ? "That's this account" : "";
  const wdErr = !wd
    ? ""
    : wd.kind === "tummo"
      ? !sellN ? "Enter how many TUMMO" : BigInt(sellN) > myTummo ? `You have ${myTummo.toLocaleString()} TUMMO` : isX ? toErr : ""
      : toErr || (!wdYocto ? "Enter an amount" : wdYocto > wdMax ? `Max is ${near(wdMax, 4)} NEAR` : "");
  async function doCashOut() {
    if (wdErr) return;
    const done =
      wd.kind === "tummo"
        ? await act("withdraw", (a) => a.sell(sellN, isX ? wdTo : null), isX ? `Sold ${sellN} TUMMO and sent the NEAR to ${short(wdTo)}` : `Sold ${sellN} TUMMO`)
        : await act("withdraw", (a) => a.withdraw(wdTo, wdYocto), `Sent ${wd.amt} NEAR to ${short(wdTo)}`);
    if (done) setWd(null);
  }
  const toField = (
            <label>
              To
              <input spellCheck={false} autoCapitalize="off" placeholder="yourname.testnet" value={wd?.to || ""} onChange={(e) => setWd({ ...wd, to: e.target.value })} />
            </label>
  );
  const withdrawSheet = wd && (
        <div className="sheet-bg" onClick={() => !busy && setWd(null)}>
          <form className="sheet withdraw" role="dialog" aria-modal="true" aria-label="Cash out" onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), doCashOut())}>
            <h2>Cash out</h2>
            {isX && (
              <div className="seg" role="tablist">
                <button type="button" role="tab" aria-selected={wd.kind === "tummo"} className={wd.kind === "tummo" ? "on" : ""} onClick={() => setWd({ ...wd, kind: "tummo", amt: "" })}>Sell TUMMO</button>
                <button type="button" role="tab" aria-selected={wd.kind === "near"} className={wd.kind === "near" ? "on" : ""} onClick={() => setWd({ ...wd, kind: "near", amt: "" })}>Send NEAR</button>
              </div>
            )}
            {wd.kind === "tummo" ? (
              <>
                <p className="signin-note">
                  Each TUMMO pays its share of the treasury, minus {cfg ? Number(cfg.sell_fee_bps) / 100 : 10}% that stays for the feeders. Sold TUMMO is burned.
                  {isX ? " The NEAR is sent straight to the address below." : " The NEAR goes to your wallet."}
                </p>
                <label>
                  TUMMO to sell
                  <span className="wd-amt">
                    <input autoFocus inputMode="numeric" placeholder="0" value={wd.amt} onChange={(e) => setWd({ ...wd, amt: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
                    <button type="button" className="ghost" onClick={() => setWd({ ...wd, amt: myTummo.toString() })}>All</button>
                  </span>
                </label>
                {isX && toField}
                <p className="wd-hint">{wdErr && (wd.to || wd.amt) ? wdErr : sellN && sq ? `You get about ${near(sq, 4)} NEAR` : `You have ${myTummo.toLocaleString()} TUMMO`}</p>
              </>
            ) : (
              <>
                <p className="signin-note">Send NEAR from your X account to any NEAR wallet or exchange address. Transfers can't be undone.</p>
                {toField}
                <label>
                  Amount
                  <span className="wd-amt">
                    <input inputMode="decimal" placeholder="0.0" value={wd.amt} onChange={(e) => setWd({ ...wd, amt: e.target.value.replace(/[^\d.]/g, "") })} />
                    <button type="button" className="ghost" onClick={() => setWd({ ...wd, amt: near(wdMax, 4).replace(/,/g, "") })}>Max</button>
                  </span>
                </label>
                <p className="wd-hint">{wdErr && (wd.to || wd.amt) ? wdErr : `Available ${near(wdMax, 4)} NEAR (0.01 stays to keep the account open)`}</p>
              </>
            )}
            <button className="solid lg wide" disabled={!!wdErr || !!busy}>{busy === "withdraw" ? "Working…" : wd.kind === "tummo" ? (isX ? "Sell and send" : "Sell") : "Send"}</button>
          </form>
        </div>
      );

  const buyable = Math.max(1, Math.min(100000, Number(buyN) || 1));
  const buyCost = pet ? cost(pet.minted, buyable) : 0n;
  const addSecs = feedable * secondsPerTummo(lvl);
  const rank = pet && account ? pet.top.findIndex(([a]) => a === account) + 1 : 0;

  async function doFeed() {
    if (await act("feed", (a) => a.feed(feedable), rescue ? `Rescued with ${feedable} TUMMO` : `Fed ${feedable} TUMMO`)) {
      if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: "smooth" });
      setMunch(true);
      setFed((n) => n + 1);
      setTimeout(() => setMunch(false), 1300);
    }
  }

  // front page -> sign in -> slides -> game. Signing out lands back on the front page.
  if (!ready) return <div className="boot" />;
  if (!account)
    return (
      <>
        <Landing onStart={connect} />
        {signInSheet}
        {toast && <div className={`toast ${toast.bad ? "bad" : ""}`} role="status">{toast.msg}</div>}
      </>
    );
  if (intro || isNewPlayer(account))
    return (
      <Onboarding
        account={account}
        onDone={() => {
          setIntro(false);
          seen((n) => n + 1);
        }}
      />
    );

  return (
    <div className={`app mood-${base}`}>
      <header className="top">
        <Wordmark />
        <div className="top-r">
          <button className="ghost how-btn" onClick={() => setIntro(true)} aria-label="How it works"><span className="hide-s">How it works</span><span className="show-s">?</span></button>
          {account ? (
            <>
              <span className="acct">
                <b>{near(bal, 2)}</b> NEAR <span className="hide-s">{ident?.handle || short(account)}</span>
              </span>
              <button className="ghost signout" onClick={() => setWd({ kind: "tummo", to: "", amt: "" })}>Cash out</button>
              <button className="ghost signout" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <button className="solid" onClick={connect}>Connect</button>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="stage">
          <div className="pet-wrap">
            <Bubble text={SAYS[mood]} />
            <Pet mood={mood} level={lvl} size={420} jump={fed} />
            <Crumbs show={munch} />
          </div>

          {pet && (
            <div className="clock">
              {base === "dead" ? (
                <>
                  <div className="big">Gone</div>
                  <div className="sub">Starved {ago(pet.life.deadline)} ago, life #{pet.life.id}</div>
                  <button className="solid lg" disabled={!!busy || !account} onClick={() => act("bury", (a) => a.bury(), "A new egg")}>Hatch a new egg</button>
                </>
              ) : (
                <>
                  <div className={`big ${rescue ? "red" : ""}`}>{span(left)}</div>
                  <div className="sub">
                    {base === "egg" ? "until the egg goes cold" : "until it starves"}
                  </div>
                  <div className="meta-row">
                    <span>Life #{pet.life.id}</span>
                    <span>Level {lvl}</span>
                    <span>{age(pet.life.born_at, now)} old</span>
                  </div>
                  <div className="feast">
                    <FeastDots count={Math.min(pet.life.day_feeders, FEAST_FEEDERS)} total={FEAST_FEEDERS} done={pet.life.feasted_today} />
                    <span>{pet.life.feasted_today ? "Feast today, +12h" : `${pet.life.day_feeders}/${FEAST_FEEDERS} toward today's feast`}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="card dock">
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={mode === "feed"} className={mode === "feed" ? "on" : ""} onClick={() => setMode("feed")}>Feed</button>
              <button role="tab" aria-selected={mode === "buy"} className={mode === "buy" ? "on" : ""} onClick={() => setMode("buy")}>Buy TUMMO</button>
            </div>

            {needsFunds && (
              <div className="fund-note">
                <b>Add NEAR to start playing</b>
                <span>Your account was just created. Send a little NEAR to it.</span>
                <code>{account}</code>
                <div className="fund-row">
                  <button className="ghost" onClick={() => navigator.clipboard?.writeText(account).then(() => say("Address copied")).catch(() => {})}>Copy address</button>
                  {(import.meta.env.VITE_NETWORK || "testnet") !== "mainnet" && <a className="ghost" href="https://near-faucet.io/" target="_blank" rel="noreferrer">Free testnet NEAR</a>}
                </div>
              </div>
            )}
            {mode === "feed" ? (
              <>
                <div className="amount">
                  <input aria-label="TUMMO to feed" inputMode="numeric" value={feedN} onChange={(e) => setFeedN(e.target.value.replace(/\D/g, "").slice(0, 7))} />
                  <span>TUMMO</span>
                </div>
                <div className="steps">
                  {FEED_STEPS.map((n) => (
                    <button key={n} className={Number(feedN) === n ? "on" : ""} onClick={() => setFeedN(n)}>{n}</button>
                  ))}
                  {myTummo > 0n && <button onClick={() => setFeedN(Number(myTummo))}>All</button>}
                </div>
                {feedable >= (cfg?.feast_min_feed ?? 25) && !pet?.life.feasted_today && base !== "dead" && <div className="note">Counts toward today's feast</div>}
                <div className="gain">
                  <span>+{span(addSecs).replace(/ 00s$/, "")} of life</span>
                  <span>{rescue ? <b className="red">2× love</b> : `+${feedable} love`}</span>
                </div>
                {account ? (
                  <button
                    className={`solid lg wide ${rescue ? "rescue" : ""}`}
                    disabled={!!busy || base === "dead" || myTummo < BigInt(feedable)}
                    onClick={doFeed}
                  >
                    {busy === "feed" ? "Feeding…" : myTummo < BigInt(feedable) ? "Not enough TUMMO" : rescue ? `Rescue with ${feedable} TUMMO` : `Feed ${feedable} TUMMO`}
                  </button>
                ) : (
                  <button className="solid lg wide" onClick={connect}>Connect to feed</button>
                )}
                <div className="foot-line">
                  You have {myTummo.toLocaleString()} TUMMO
                  {myTummo < BigInt(feedable) && account && <button className="link" onClick={() => setMode("buy")}>Buy</button>}
                </div>
              </>
            ) : (
              <>
                <div className="amount">
                  <input aria-label="TUMMO to buy" inputMode="numeric" value={buyN} onChange={(e) => setBuyN(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  <span>TUMMO</span>
                </div>
                <div className="steps">
                  {BUY_STEPS.map((n) => (
                    <button key={n} className={Number(buyN) === n ? "on" : ""} onClick={() => setBuyN(n)}>{n.toLocaleString()}</button>
                  ))}
                </div>
                <div className="gain">
                  <span>{near(buyCost, 4)} NEAR</span>
                  <span>all of it to the treasury</span>
                </div>
                {account ? (
                  <button className="solid lg wide" disabled={!!busy} onClick={() => act("buy", (a) => a.buy(buyable), `Bought ${buyable.toLocaleString()} TUMMO`).then((ok) => ok && setMode("feed"))}>
                    {busy === "buy" ? "Buying…" : `Buy ${buyable.toLocaleString()} TUMMO`}
                  </button>
                ) : (
                  <button className="solid lg wide" onClick={connect}>Connect to buy</button>
                )}
                <div className="foot-line">Price rises with every TUMMO ever minted</div>
              </>
            )}
          </div>

          <div className="card share">
            <div className="share-top">
              <div>
                <div className="label">Your share</div>
                <div className="money">{near(me?.claimable || 0, 4)} <small>NEAR</small></div>
              </div>
              <button className="ghost" disabled={!account || !!busy || !me || me.claimable === "0"} onClick={() => act("claim", (a) => a.claim(), "Claimed")}>
                {busy === "claim" ? "…" : "Claim"}
              </button>
            </div>
            <div className="share-row">
              <span>{me?.fed_this_life ? <>Love <b>{Number(me.love).toLocaleString()}</b>{rank ? <> · #{rank}</> : null}</> : "Feed it to start earning"}</span>
              {pet && <span><b>{near(pet.drip_per_day, 3)}</b> NEAR/day to feeders</span>}
            </div>
          </div>

          {pet && (
            <div className="card stats">
              <div><span>Treasury</span><b>{near(pet.treasury, 2)}</b></div>
              <div><span>TUMMO price</span><b>{near(pet.price, 5)}</b></div>
              <div><span>Burned</span><b>{Number(pet.burned).toLocaleString()}</b></div>
              <button className="link rules-link" onClick={() => setHow(true)}>Contract rules</button>
            </div>
          )}

        </aside>

        <section className="card lists">
            <div className="seg small" role="tablist">
              {[["feeders", "Feeders"], ["log", "Log"], ["graves", `Graveyard${graves?.length ? ` ${graves.length}` : ""}`]].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === "feeders" && (
              <ol className="rows">
                {(pet?.top || []).map(([a, love], i) => (
                  <li key={a} className={a === account ? "me" : ""}>
                    <span className="n">{i + 1}</span>
                    <span className="who">{a === account ? "you" : short(a)}</span>
                    <b>{Number(love).toLocaleString()}</b>
                  </li>
                ))}
                {pet?.top?.length === 0 && <li className="empty">No one has fed this life yet</li>}
              </ol>
            )}

            {tab === "log" && (
              <>
              <ol className="rows">
                {(log || []).slice(0, 14).map((e, i) => (
                  <li key={i} className={`ev ${e.kind} ${e.account_id === account ? "me" : ""}`}>
                    <span className="who">{e.kind === "death" ? `Life #${e.amount}` : e.account_id === account ? "you" : short(e.account_id)}</span>
                    <span className="what">
                      {e.kind === "feed" && `fed ${e.amount}`}
                      {e.kind === "rescue" && `rescued with ${e.amount}`}
                      {e.kind === "buy" && `bought ${Number(e.amount).toLocaleString()}`}
                      {e.kind === "sell" && `sold ${Number(e.amount).toLocaleString()}`}
                      {e.kind === "feast" && "started a feast"}
                      {e.kind === "death" && "starved"}
                    </span>
                    <span className="t">{ago(e.ts)}</span>
                  </li>
                ))}
              </ol>
              {lock?.explorer ? (
                <a className="all-events" href={lock.explorer} target="_blank" rel="noreferrer">Every mint and burn on NearBlocks</a>
              ) : (
                <p className="all-events">Every mint and burn is also a NEP-297 event on-chain</p>
              )}
              </>
            )}

            {tab === "graves" && (
              <ol className="graves">
                {(graves || []).map((g) => (
                  <li key={g.id}>
                    <Tomb id={g.id} />
                    <div>
                      <b>Lived {age(g.born_at, g.died_at)}</b>
                      <span>Level {g.level}, ate {Number(g.eaten).toLocaleString()}, {g.feeders} feeders</span>
                      <span>Paid {near(g.paid_out, 3)} NEAR{g.top_feeder ? `, top: ${short(g.top_feeder)}` : ""}</span>
                    </div>
                  </li>
                ))}
                {graves?.length === 0 && <li className="empty">Nobody here yet</li>}
              </ol>
            )}
          </section>
      </main>

      {how && (
        <div className="sheet-bg" onClick={() => setHow(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="How it works" onClick={(e) => e.stopPropagation()}>
            <h2>Rules</h2>
            <ol>
              <li><b>Buy TUMMO.</b> Every NEAR goes into its treasury.</li>
              <li><b>Feed it.</b> Fed TUMMO is burned and buys it time. The bigger it grows, the hungrier it gets.</li>
              <li><b>Get paid.</b> While it lives, {cfg ? Number(cfg.drip_bps_per_day) / 100 : 3}% of the treasury a day goes to its feeders, split by love.</li>
              <li><b>Save it.</b> Feeding in its last {cfg ? cfg.rescue_window / 3600 : 6} hours counts double. {cfg?.feast_feeders ?? 10} feeders of {cfg?.feast_min_feed ?? 25}+ TUMMO in a day throws a feast: +{cfg ? cfg.feast_bonus / 3600 : 12}h.</li>
              <li><b>Or lose it.</b> If it starves, it's buried, love resets and a new egg hatches with what's left.</li>
            </ol>
            {cfg && (
              <details className="cfg" open>
                <summary>Contract rules</summary>
                <dl>
                  <dt>Life per TUMMO, newborn</dt><dd>{cfg.seconds_per_tummo / 60} min</dd>
                  <dt>Level</dt><dd>√(eaten ÷ {cfg.level_unit})</dd>
                  <dt>Fed ahead, max</dt><dd>{cfg.max_ahead / 3600} h</dd>
                  <dt>Egg, if ignored</dt><dd>{cfg.egg_life / 3600} h</dd>
                  <dt>Drip</dt><dd>{Number(cfg.drip_bps_per_day) / 100}% a day</dd>
                  <dt>Feast</dt><dd>{cfg.feast_feeders} feeders, {cfg.feast_min_feed}+ TUMMO, holding {cfg.feast_min_age / 3600}h+</dd>
                  <dt>TUMMO price</dt><dd>{near(cfg.base_price, 4)} + {near(cfg.price_step, 7)} per TUMMO minted</dd>
                  <dt>Admin</dt><dd>{cfg.admin || "none"}</dd>
                </dl>
              </details>
            )}
            <button className="solid lg wide" onClick={() => setHow(false)}>Got it</button>
          </div>
        </div>
      )}

      {signInSheet}
      {withdrawSheet}


      {toast && <div className={`toast ${toast.bad ? "bad" : ""}`} role="status">{toast.msg}</div>}
    </div>
  );
}
