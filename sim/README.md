# 60-day simulation

`simulate.py` is a float copy of `contract/src/lib.rs` stepped every 10 minutes for 60 days. `charts.py` draws the result and writes `results.json`.

```bash
python3 simulate.py   # table: 4 scenarios x 5 parameter sets, 5 seeds each
python3 charts.py     # sim-final.png, results.json
```

Scenarios: a steady community (30 people), hype then fade (90 people, activity decays), a few whales (3 whales, 6 regulars) and a community that leaves by day 25. People show up more often when the pet is starving.

Model limit: simulated players only buy what they plan to feed, so nearly all minted TUMMO gets burned. Real holders will sit on TUMMO, which leaves more in circulation than the charts show.
