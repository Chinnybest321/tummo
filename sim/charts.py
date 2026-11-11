import sys, json
sys.path.insert(0, ".")
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from simulate import sim, SCENARIOS, PARAMS, BASE

FINAL = dict(BASE, spn=600, drip=0.03, level_unit=250)
INK, SUN, RED, BLUE, GREEN = "#1d1b19", "#f5b800", "#e5483b", "#3b6fd9", "#1f9d55"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False, "axes.edgecolor": "#bbb", "axes.labelcolor": "#555", "xtick.color": "#666", "ytick.color": "#666"})

fig, axes = plt.subplots(4, 3, figsize=(15, 13), sharex=True)
summary = {}
for i, (name, sc) in enumerate(SCENARIOS.items()):
    r = sim(FINAL, sc, 3)
    s = r["series"]
    t = np.array(s["t"])
    minted = np.cumsum([0])  # placeholder
    a0, a1, a2 = axes[i]
    a0.plot(t, s["minted"], color=INK, lw=1.8, label="minted")
    a0.plot(t, s["burned"], color=RED, lw=1.8, ls="--", label="burned by feeding")
    if i == 0:
        a0.legend(frameon=False, loc="center right", fontsize=9)
    a0b = a0.twinx()
    a0b.spines["top"].set_visible(False)
    burned_curve = np.linspace(0, r["burned"], len(t))  # replaced below
    a0.set_ylabel(name, fontsize=11, color=INK, fontweight="bold")
    a1.plot(t, s["treasury"], color=GREEN, lw=1.8)
    a2.fill_between(t, s["left_h"], color=SUN, alpha=0.35, lw=0)
    a2.plot(t, s["left_h"], color="#c99400", lw=1.2)
    for d in r["deaths"]:
        a2.axvline(d, color=RED, lw=1, alpha=0.7)
    a2.axhline(6, color=RED, lw=0.8, ls=":")
    a0b.axis("off")
    summary[name] = dict(deaths=len(r["deaths"]), feasts=r["feasts"], alive_pct=round(r["alive_pct"], 1), burned=int(r["burned"]), minted=int(r["minted"]), treasury=round(r["treasury"], 2), paid=round(r["paid"], 2))
    a2.text(0.99, 0.95, f'{len(r["deaths"])} deaths · {r["feasts"]} feasts', transform=a2.transAxes, ha="right", va="top", fontsize=9, color="#444")
    a0.text(0.02, 0.95, f'{int(r["burned"]):,} of {int(r["minted"]):,} burned', transform=a0.transAxes, ha="left", va="top", fontsize=9, color="#444")
    a1.text(0.99, 0.95, f'paid to feeders {r["paid"]:.1f} NEAR', transform=a1.transAxes, ha="right", va="top", fontsize=9, color="#444")

axes[0][0].set_title("TUMMO minted vs burned", loc="left", fontsize=11)
axes[0][1].set_title("Treasury (NEAR)", loc="left", fontsize=11)
axes[0][2].set_title("Hours until it starves (red lines = deaths)", loc="left", fontsize=11)
for a in axes[-1]:
    a.set_xlabel("day")
fig.suptitle("Tummo: 60 days under four communities (final parameters)", x=0.01, ha="left", fontsize=15, fontweight="bold", color=INK)
fig.tight_layout(rect=(0, 0, 1, 0.97))
fig.savefig("sim-final.png", dpi=110)

# cumulative burn, the supply story
fig2, ax = plt.subplots(1, 1, figsize=(10, 4.6))
for (name, sc), c in zip(SCENARIOS.items(), [INK, BLUE, SUN, RED]):
    r = sim(FINAL, sc, 3)
    # recompute cumulative burned per sample by rerunning with tracking
    ax.plot(r["series"]["t"], np.cumsum(np.maximum(0, -np.diff([0] + r["series"]["supply"]))) * 0 + r["series"]["level"], color=c, lw=1.8, label=name)
ax.set_title("Pet level over 60 days (bigger = hungrier, burns TUMMO faster)", loc="left", fontsize=12)
ax.set_xlabel("day"); ax.set_ylabel("level")
ax.legend(frameon=False)
fig2.tight_layout()
fig2.savefig("sim-level.png", dpi=110)

# parameter comparison table
rows = []
for pname, p in PARAMS.items():
    for name, sc in SCENARIOS.items():
        runs = [sim(p, sc, k) for k in range(5)]
        rows.append(dict(params=pname.strip(), scenario=name, deaths=round(float(np.mean([len(x["deaths"]) for x in runs])), 1), feasts=round(float(np.mean([x["feasts"] for x in runs])), 1), burned=int(np.mean([x["burned"] for x in runs])), paid=round(float(np.mean([x["paid"] for x in runs])), 1), treasury_end=round(float(np.mean([x["treasury"] for x in runs])), 1)))
json.dump(dict(final=summary, comparison=rows), open("results.json", "w"), indent=1)
print(json.dumps(summary, indent=1))
