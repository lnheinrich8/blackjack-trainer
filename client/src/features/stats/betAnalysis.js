// Derives the deeper bet-strategy metrics the AI coach reasons over, from the
// enriched Testing-mode betting history (one entry per settled round, see the
// schema captured in Play.jsx). This is the model's *grounded* input: the code
// computes every fact deterministically here so the LLM only narrates them and is
// never the authority on the numbers.
//
// Three views, each a different lens on the same rounds:
//   - session : headline grade/correlation/ROI (reused from betStats) plus
//               bankroll-risk discipline, win rate, and a list of betting "leaks".
//   - perShoe : how the player ramped *within* each physical shoe (bet spread in
//               units, count↔bet correlation, the bet at the shoe's peak count).
//   - perTc   : per true-count bucket, the average bet in units, its spread
//               (consistency), and the win rate at that count.
//
// Everything is expressed in betting *units* (bet / table unit) so spreads are
// comparable across sessions regardless of the dollar stakes. Defensive against
// pre-enrichment history entries that only carry { tc, bet, net, decks }.

import { computeBetStats, TC_BUCKETS, sum, mean, pearson } from "./betStats";

// Fallback betting unit when an entry predates unit capture. Matches the app's
// smallest chip, which is what new entries record.
const DEFAULT_UNIT = 5;

// Leak heuristics. A leak is a bet that contradicts the count: staking up when
// the count is unfavorable, or flat-minimum-betting when it's clearly favorable.
const BIG_BET_UNITS = 3; // 3+ units with the count at or below 0 is overbetting
const MIN_BET_UNITS = 1; // a single unit = the table minimum (no ramp)
const GOOD_TC = 2; // true count at/above which the player should be ramping up
const MAX_LEAKS = 12; // cap the reported list so it stays prompt-sized

const round1 = (x) => Math.round(x * 10) / 10;
const round3 = (x) => Math.round(x * 1000) / 1000;

// Population standard deviation of a series (0 for fewer than two points).
function stdDev(xs) {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// A round's bet measured in betting units (bet / that round's unit).
const unitsOf = (h) => h.bet / (h.unit || DEFAULT_UNIT);

// Did the user win the round? Prefer the recorded outcome; fall back to the net
// sign for pre-enrichment entries that lack it.
const won = (h) => (h.outcome ? h.outcome === "win" : h.net > 0);

// How deep into the shoe this round was dealt (0 = top, ~1 = cut card), or null
// when the entry lacks the cards-remaining / deck info to compute it.
function penetration(h) {
    if (h.cardsRemaining == null || !h.decks) return null;
    const total = h.decks * 52;
    if (total <= 0) return null;
    return 1 - h.cardsRemaining / total;
}

// Group rounds by their shoe id, preserving first-seen order. Pre-enrichment
// entries (no shoe id) collapse into one "unknown" group keyed -1.
function groupByShoe(history) {
    const groups = new Map();
    for (const h of history) {
        const id = h.shoe ?? -1;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(h);
    }
    return groups;
}

// Per-shoe ramp quality: how the bet tracked the count within one shoe, the bet
// spread in units, the count it peaked at, and what was actually staked there.
function analyzeShoe(id, rounds) {
    const units = rounds.map(unitsOf);
    const minUnits = Math.min(...units);
    const maxUnits = Math.max(...units);
    const wagered = sum(rounds.map((r) => r.bet));
    const net = sum(rounds.map((r) => r.net));

    // The round where the count peaked — did the player bet up for it?
    const peak = rounds.reduce((a, b) => (b.tc > a.tc ? b : a));
    const pens = rounds.map(penetration).filter((p) => p != null);

    return {
        shoe: id,
        rounds: rounds.length,
        ramp: pearson(rounds.map((r) => r.tc), rounds.map((r) => r.bet)),
        peakTc: round1(peak.tc),
        betAtPeakTc: peak.bet,
        unitsAtPeakTc: round1(unitsOf(peak)),
        minUnits: round1(minUnits),
        maxUnits: round1(maxUnits),
        spreadUnits: minUnits > 0 ? round1(maxUnits / minUnits) : null,
        wagered,
        net,
        roi: wagered > 0 ? round3(net / wagered) : 0,
        deepestPenetration: pens.length ? round3(Math.max(...pens)) : null,
    };
}

// Per true-count bucket: average bet in units, the spread of those bets
// (stddev = how consistently the player sizes at this count), and the win rate.
function analyzeTcBucket(bucket, history) {
    const rounds = history.filter((h) => bucket.match(Math.round(h.tc)));
    if (rounds.length === 0) {
        return { id: bucket.id, label: bucket.label, rounds: 0 };
    }
    const units = rounds.map(unitsOf);
    const wins = rounds.filter(won).length;
    return {
        id: bucket.id,
        label: bucket.label,
        rounds: rounds.length,
        avgUnits: round1(mean(units)),
        unitsStdDev: round1(stdDev(units)),
        winRate: round3(wins / rounds.length),
        net: sum(rounds.map((r) => r.net)),
    };
}

// Bets that fight the count, worst first and capped. Big stakes at a dead/minus
// count and minimum bets at a strong plus count are the two classic leaks.
function findLeaks(history) {
    const leaks = [];
    for (const h of history) {
        const units = unitsOf(h);
        if (h.tc <= 0 && units >= BIG_BET_UNITS) {
            // Worse the bigger the bet and the more negative the count.
            leaks.push(leak("big-bet-low-count", h, units, units - h.tc));
        } else if (h.tc >= GOOD_TC && units <= MIN_BET_UNITS) {
            // Worse the higher the count you flat-bet through.
            leaks.push(leak("min-bet-high-count", h, units, h.tc));
        }
    }
    leaks.sort((a, b) => b.severity - a.severity);
    return { leakCount: leaks.length, leaks: leaks.slice(0, MAX_LEAKS) };
}

function leak(type, h, units, severity) {
    return {
        type,
        shoe: h.shoe ?? null,
        tc: round1(h.tc),
        bet: h.bet,
        units: round1(units),
        severity,
    };
}

// Roll the raw enriched history up into the coach's grounded metrics. Returns
// { hands: 0 } when there's nothing tracked yet so callers can show an empty
// state. `session` extends computeBetStats with risk discipline and the leak list.
export function analyzeBets(history) {
    const hands = history.length;
    if (hands === 0) return { hands: 0 };

    const unit = history.find((h) => h.unit)?.unit ?? DEFAULT_UNIT;
    const base = computeBetStats(history);

    const units = history.map(unitsOf);
    // Bankroll-risk discipline: bet as a fraction of the bankroll at bet time.
    // Only entries that recorded a positive bankroll count (pre-enrichment rounds
    // didn't capture it).
    const pcts = history
        .filter((h) => h.bankroll > 0)
        .map((h) => h.bet / h.bankroll);
    const wins = history.filter(won).length;

    const session = {
        hands,
        unit,
        totalWagered: base.totalWagered,
        net: base.net,
        roi: round3(base.roi),
        spread: base.spread == null ? null : round1(base.spread),
        correlation: base.correlation == null ? null : round3(base.correlation),
        ramp: base.ramp,
        results: base.results,
        overall: base.overall,
        graded: base.graded,
        avgUnits: round1(mean(units)),
        maxUnits: round1(Math.max(...units)),
        winRate: round3(wins / hands),
        avgBetPctBankroll: pcts.length ? round3(mean(pcts)) : null,
        maxBetPctBankroll: pcts.length ? round3(Math.max(...pcts)) : null,
        ...findLeaks(history),
    };

    const perShoe = [...groupByShoe(history).entries()].map(([id, rounds]) =>
        analyzeShoe(id, rounds),
    );
    const perTc = TC_BUCKETS.map((b) => analyzeTcBucket(b, history));

    return { hands, unit, session, perShoe, perTc };
}
