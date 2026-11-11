import { useCallback, useEffect, useState } from "react";
let apiP;
export function getApi() {
  apiP ??= import("./chain.js").then((m) => m.chain);
  return apiP;
}

export function useLive(fn, deps = []) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    getApi().then((api) => {
      if (!alive) return; // unmounted before the api loaded: don't leak a subscription
      const go = () => run(api).then((d) => alive && (setData(d), setErr(null))).catch((e) => alive && setErr(e.message || String(e)));
      go();
      unsub = api.subscribe(go);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [run]);
  return [data, err];
}

export function useAccount() {
  const [a, setA] = useState(null);
  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    getApi().then((api) => {
      if (!alive) return;
      const sync = () => api.account().then(setA);
      sync();
      unsub = api.subscribe(sync);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return a;
}

export function useNow() {
  const [t, setT] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setT(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(id);
  }, []);
  return t;
}
