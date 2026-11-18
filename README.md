# btc-race-24h-20261118-1444-bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/zeroxfive05/btc-race-24h-20261118-1444-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/zeroxfive05/btc-race-24h-20261118-1444-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Flush-dip buyer for the cbBTC 24-hour race (bars-replay/v1). Long only, one
position: it buys full size when cbBTC falls 1.5% under its 60-bar rolling high
and the bar closes green — the first print that the flush is bouncing — and
exits on a 1.3% take-profit, a 2% stop-loss, or a trailing stop armed at +0.8%.
A 30-bar cooldown follows a stop and an 8% equity-drawdown brake stops new
entries. Fully deterministic: no clock, no randomness, no network. Dev grade
(local, kit's own grader): net PnL +$24.55 on $1,000, 4 trades, max drawdown
1.14%.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=pkrvv9ny&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
