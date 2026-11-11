"""60-day simulation of tummo under a few community scenarios and parameter sets.

Mirrors contract/src/lib.rs at 10-minute resolution:
  buy -> mint on a linear curve, NEAR to treasury
  feed -> burn, extends life by count * seconds_per_tummo(level), capped 3 days ahead
  drip -> treasury pays feeders while alive
  feast -> enough qualifying feeders in one day of its life: +12h
  death -> buried, love resets, new egg (24h)
"""
import json, math, random, sys
import numpy as np

DAY, HOUR, STEP = 86400, 3600, 600
DAYS = 60

BASE_PRICE, PRICE_STEP = 0.001, 1e-7  # NEAR

def sim(params, scenario, seed=7):
    rng = random.Random(seed)
    P = params
    users = scenario["users"](rng)
    t = 0
    st = dict(minted=0.0, burned=0.0, treasury=0.0, paid=0.0)
    life = dict(born=0, deadline=P["egg"], eaten=0.0, love=0.0, day=-1, day_feeders=set(), feasted=False)
    bal = {u["id"]: 0.0 for u in users}
    first_buy = {}
    deaths, feasts, lifespans = [], 0, []
    series = {k: [] for k in ["t", "supply", "minted", "burned", "treasury", "alive", "left_h", "level", "price"]}

    def level():
        return int(math.isqrt(int(life["eaten"] // P["level_unit"])))

    def spn():
        return max(10, P["spn"] // (1 + level()))

    for step in range(DAYS * DAY // STEP):
        t = step * STEP
        # drip for this step
        if t < life["deadline"] and life["love"] > 0:
            amt = st["treasury"] * P["drip"] * STEP / DAY
            st["treasury"] -= amt
            st["paid"] += amt
        # death
        if t >= life["deadline"]:
            if life["eaten"] > 0:
                deaths.append(life["deadline"] / DAY)
            lifespans.append((life["deadline"] - life["born"]) / DAY)
            life = dict(born=t, deadline=t + P["egg"], eaten=0.0, love=0.0, day=-1, day_feeders=set(), feasted=False)
        day = t // DAY
        left = life["deadline"] - t
        for u in users:
            # each user checks in a few times a day with prob from the scenario
            p_visit = scenario["activity"](u, day) * STEP / (DAY / u.get("visits", 3))
            if left < P["rescue_window"]:
                p_visit *= 2.5  # people show up when it's starving
            if rng.random() >= p_visit:
                continue
            want = u["size"] * rng.lognormvariate(0, 0.6)
            if left < P["rescue_window"]:
                want *= 1.5
            want = max(1, round(want))
            if bal[u["id"]] < want:
                n = want - int(bal[u["id"]]) + int(u["size"] * 0.3)
                m = st["minted"]
                cost = n * BASE_PRICE + PRICE_STEP * (n * m + n * (n - 1) / 2)
                st["treasury"] += cost
                st["minted"] += n
                bal[u["id"]] += n
                first_buy.setdefault(u["id"], t)
            n = min(want, int(bal[u["id"]]))
            if n < 1 or t >= life["deadline"]:
                continue
            bal[u["id"]] -= n
            st["burned"] += n
            rescue = left <= P["rescue_window"]
            life["love"] += n * (2 if rescue else 1)
            add = n * spn()
            life["eaten"] += n
            life["deadline"] = min(life["deadline"] + add, t + P["max_ahead"])
            lday = (t - life["born"]) // DAY
            if lday != life["day"]:
                life["day"], life["day_feeders"], life["feasted"] = lday, set(), False
            if n >= P["feast_min_feed"] and t - first_buy.get(u["id"], t) >= P["feast_min_age"]:
                life["day_feeders"].add(u["id"])
            if not life["feasted"] and len(life["day_feeders"]) >= P["feast_feeders"]:
                life["feasted"] = True
                feasts += 1
                life["deadline"] = min(life["deadline"] + 12 * HOUR, t + P["max_ahead"] + 12 * HOUR)
            left = life["deadline"] - t
        if step % 6 == 0:
            series["t"].append(t / DAY)
            series["supply"].append(st["minted"] - st["burned"])
            series["minted"].append(st["minted"])
            series["burned"].append(st["burned"])
            series["treasury"].append(st["treasury"])
            series["alive"].append(1 if t < life["deadline"] and life["eaten"] > 0 else 0)
            series["left_h"].append(max(0, (life["deadline"] - t) / HOUR))
            series["level"].append(level())
            series["price"].append(BASE_PRICE + PRICE_STEP * st["minted"])
    alive = np.array(series["alive"])
    return dict(
        series=series, deaths=deaths, feasts=feasts,
        lifespans=lifespans,
        minted=st["minted"], burned=st["burned"], treasury=st["treasury"], paid=st["paid"],
        alive_pct=float(alive.mean() * 100),
        final_supply=st["minted"] - st["burned"],
    )

def users(n, size, visits=3, kind="regular", offset=0):
    return [dict(id=f"{kind}{i + offset}", size=size, visits=visits, kind=kind) for i in range(n)]

SCENARIOS = {
    "Steady community": dict(
        users=lambda r: users(30, 15),
        activity=lambda u, d: 0.55,
    ),
    "Hype then fade": dict(
        users=lambda r: users(90, 15),
        activity=lambda u, d: 0.75 * math.exp(-d / 12) + 0.04,
    ),
    "A few whales": dict(
        users=lambda r: users(3, 1500, visits=1, kind="whale") + users(6, 12),
        activity=lambda u, d: 0.35 if u["kind"] == "whale" else 0.45,
    ),
    "Community leaves": dict(
        users=lambda r: users(30, 15),
        activity=lambda u, d: 0.6 * max(0.0, 1 - d / 25),
    ),
}

BASE = dict(egg=24 * HOUR, max_ahead=72 * HOUR, rescue_window=6 * HOUR, feast_feeders=10, feast_min_feed=25, feast_min_age=HOUR)
PARAMS = {
    "A  600s/TUMMO, 3%/day, level 100": dict(BASE, spn=600, drip=0.03, level_unit=100),
    "B  300s/TUMMO, 3%/day, level 100": dict(BASE, spn=300, drip=0.03, level_unit=100),
    "C  600s/TUMMO, 2%/day, level 400": dict(BASE, spn=600, drip=0.02, level_unit=400),
    "D  900s/TUMMO, 2%/day, level 400": dict(BASE, spn=900, drip=0.02, level_unit=400),
    "Final  600s/TUMMO, 3%/day, level 250": dict(BASE, spn=600, drip=0.03, level_unit=250),
}

if __name__ == "__main__":
    out = {}
    for sname, sc in SCENARIOS.items():
        for pname, p in PARAMS.items():
            runs = [sim(p, sc, seed) for seed in range(5)]
            r = runs[0]
            out[(sname, pname)] = (r, runs)
            print(f"{sname:18} | {pname:32} | deaths {np.mean([len(x['deaths']) for x in runs]):5.1f} | alive {np.mean([x['alive_pct'] for x in runs]):5.1f}% | feasts {np.mean([x['feasts'] for x in runs]):5.1f} | supply {np.mean([x['final_supply'] for x in runs]):9.0f} | burned {np.mean([x['burned'] for x in runs]):9.0f} | treasury {np.mean([x['treasury'] for x in runs]):7.2f} | paid {np.mean([x['paid'] for x in runs]):7.2f}")
    import pickle
    pickle.dump(out, open("/tmp/tummosim.pkl", "wb"))
