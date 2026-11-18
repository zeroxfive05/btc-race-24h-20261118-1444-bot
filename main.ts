// Flush-dip buyer for the cbBTC 24-hour race: long only, one position, full
// size on a confirmed washout, out on a fixed take-profit, a stop, or a
// trailing stop once the trade is in profit. Nothing here reads the clock,
// the environment, or any randomness: the same bars always give the same
// orders, so the two grading runs match byte for byte.
//
// Why this shape: on the dev window BTC fell 2.8% and the whole profit sat in
// two flush-and-recover events. A dip buy only pays when the bounce clears the
// round-trip cost (about 30 bps at full size: 4 bps fee + 2 bps slippage +
// ~10 bps of pool impact each way), so the entry waits for a deep dip (1.5%
// under the last hour's high) AND a green bar that prints the bounce, and the
// take-profit sits at 1.3% above cost. Shallow dips were measured and
// rejected: their median 60-minute bounce is under the round-trip cost.
// The stop (2% under cost), the 30-bar cooldown after a stop, and the 8%
// equity-drawdown brake exist for the race window, where a flush can keep
// falling instead of recovering; none of them fired on the dev window.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Rolling high of closes, in bars (one hour). */
const HIGH_BARS = 60;
/** Entry dip, in basis points under the rolling high. */
const DIP_BPS = 150;
/** Take-profit: exit when the position is worth this many bps over its cost. */
const TAKE_PROFIT_BPS = 130;
/** Stop-loss: exit when the position is worth this many bps under its cost. */
const STOP_BPS = 200;
/** Trailing stop: arms once the position is up this many bps over its cost. */
const TRAIL_ARM_BPS = 80;
/** Trailing stop: exits once the position gives back this many bps from its peak value. */
const TRAIL_GAP_BPS = 40;
/** Bars to wait after a stop-loss exit before a new entry. */
const COOLDOWN_BARS = 30;
/** Equity drawdown (bps from the peak) that stops new entries for the window. */
const BRAKE_BPS = 800;
/** Scored window length in bars, and how many of its last bars take no entries. */
const WINDOW_BARS = 1440;
const TAIL_BARS = 60;
/** Slippage cap per order, in bps past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

const BPS = 10000n;

/** Closes seen so far, oldest first (warm-up bars included: they seed history). */
const closes: number[] = [];
/** Scored CBBTC bars seen (warm-up bars excluded): drives the cooldown and tail. */
let barsSeen = 0;
/** Highest equity so far, for the drawdown brake. */
let peakEquity = 0n;
/** Highest value of the open position since entry, for the trailing stop. */
let peakValue = 0n;
/** No entries before this scored-bar count (set on a stop-loss exit). */
let coolUntil = -1;
/** Once set, no new entries for the rest of the window. */
let brakeTripped = false;

/** The dip of the latest close under the rolling high, in basis points. */
function dipBps(): number | null {
  if (closes.length < HIGH_BARS) return null;
  let high = 0;
  for (let i = closes.length - HIGH_BARS; i < closes.length; i++) {
    if (closes[i]! > high) high = closes[i]!;
  }
  const close = closes[closes.length - 1]!;
  return ((high - close) / high) * 10000;
}

await runBars({
  onHello(state) {
    peakEquity = state.equity;
  },

  onBatch(state, batch) {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    closes.push(Number(bar.c));
    if (!state.warmingUp) barsSeen++;

    // Drawdown brake: trip once, stay tripped. It blocks entries, never exits.
    if (state.equity > peakEquity) peakEquity = state.equity;
    if (!brakeTripped && (peakEquity - state.equity) * BPS > peakEquity * BigInt(BRAKE_BPS)) {
      brakeTripped = true;
    }

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      if (value > peakValue) peakValue = value;
      const cost = held.cost;
      let exit = false;
      let stopped = false;
      if (value * BPS >= cost * (BPS + BigInt(TAKE_PROFIT_BPS))) {
        exit = true; // take-profit
      } else if (value * BPS <= cost * (BPS - BigInt(STOP_BPS))) {
        exit = true; // stop-loss
        stopped = true;
      } else if (
        peakValue * BPS >= cost * (BPS + BigInt(TRAIL_ARM_BPS)) &&
        (peakValue - value) * BPS >= peakValue * BigInt(TRAIL_GAP_BPS)
      ) {
        exit = true; // trailing stop, armed and given back the gap
      }
      if (exit) {
        if (stopped) coolUntil = barsSeen + COOLDOWN_BARS;
        peakValue = 0n;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: one entry rule, all of it. The dip alone is not enough: the bar
    // must also close green, the first print that the flush is bouncing.
    peakValue = 0n;
    if (state.warmingUp || brakeTripped) return [];
    if (barsSeen < HIGH_BARS || barsSeen >= WINDOW_BARS - TAIL_BARS) return [];
    if (barsSeen < coolUntil) return [];
    const dip = dipBps();
    if (dip === null || dip < DIP_BPS) return [];
    if (BigInt(bar.c) <= BigInt(bar.o)) return [];
    // Full size, capped by the weight room so a tighter cap in another window
    // rejects nothing: the buy is the smaller of the cash and the room.
    const cash = state.cash;
    const room = state.weightRoom(SYMBOL);
    const notional = cash < room ? cash : room;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
