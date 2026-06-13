// Aggregates the raw Testing-mode betting history (one entry per settled round:
// { tc, bet, net, decks }) into the numbers the Stats page shows. Pure functions
// only, so this is easy to reason about and test. The whole point of counting is
// to bet more as the true count climbs, so the headline metric is how strongly
// the player's bet size tracks the count.

// True-count buckets for the breakdown ladder. We round each round's true count
// to the nearest integer and drop it in a bucket; negative counts collapse into
// "≤ 0" since we only care how the player ramps the bet up.
export const TC_BUCKETS = [
    { id: "le0", label: "TC ≤ 0", match: (n) => n <= 0 },
    { id: "p1", label: "TC +1", match: (n) => n === 1 },
    { id: "p2", label: "TC +2", match: (n) => n === 2 },
    { id: "p3", label: "TC +3", match: (n) => n === 3 },
    { id: "p4", label: "TC +4 or more", match: (n) => n >= 4 },
];

// Below this many tracked hands the ramp grade isn't meaningful yet.
const MIN_HANDS_FOR_GRADE = 10;

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => (xs.length === 0 ? 0 : sum(xs) / xs.length);

// Pearson correlation between two equal-length series, or null when it's
// undefined (fewer than two points, or one series never varies — e.g. the player
// flat-bets, so bet has no spread to correlate with the count).
function pearson(xs, ys) {
    if (xs.length < 2) return null;
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    if (sxx === 0 || syy === 0) return null;
    return sxy / Math.sqrt(sxx * syy);
}

// Letter grade from a 0–100 sub-score. The ramp, results, and overall scores all
// grade on this same curve so the letters are comparable.
function gradeFromScore(score) {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    if (score >= 20) return "D";
    return "F";
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Results score from return-on-investment (net / total wagered). Break-even maps
// to 50; +5% (or better) tops out at 100 and −5% (or worse) bottoms at 0. The
// band is generous because blackjack edges are small and short-run swingy.
function resultsScoreFor(roi) {
    return Math.round(clamp01((roi + 0.05) / 0.1) * 100);
}

// Turn the raw betting history into display-ready stats. Returns hands: 0 when
// there's nothing to show yet so the page can render an empty state. The grade
// has two factors: "ramp" (how tightly bets track the count) and "results" (is
// the bankroll actually growing) — blended equally into the overall grade so a
// disciplined ramp that still loses money can't score top marks.
export function computeBetStats(history) {
    const hands = history.length;
    if (hands === 0) {
        return { hands: 0 };
    }

    const bets = history.map((h) => h.bet);
    const tcs = history.map((h) => h.tc);
    const nets = history.map((h) => h.net);

    const totalWagered = sum(bets);
    const net = sum(nets);
    const minBet = Math.min(...bets);
    const maxBet = Math.max(...bets);
    const spread = minBet > 0 ? maxBet / minBet : null;
    const roi = totalWagered > 0 ? net / totalWagered : 0;

    const correlation = pearson(tcs, bets);
    // Ramp score is the positive part of the correlation on a 0–100 scale; betting
    // backwards or not at all scores 0.
    const rampScore = Math.round(Math.max(0, correlation ?? 0) * 100);
    const resultsScore = resultsScoreFor(roi);
    const overallScore = Math.round((rampScore + resultsScore) / 2);

    const graded = hands >= MIN_HANDS_FOR_GRADE;
    const grade = (s) => (graded ? gradeFromScore(s) : null);

    const buckets = TC_BUCKETS.map((b) => {
        const rounds = history.filter((h) => b.match(Math.round(h.tc)));
        return {
            id: b.id,
            label: b.label,
            hands: rounds.length,
            avgBet: rounds.length ? Math.round(mean(rounds.map((r) => r.bet))) : null,
            net: rounds.length ? sum(rounds.map((r) => r.net)) : null,
        };
    });

    return {
        hands,
        totalWagered,
        net,
        roi,
        minBet,
        maxBet,
        spread,
        correlation,
        ramp: { score: rampScore, grade: grade(rampScore) },
        results: { score: resultsScore, grade: grade(resultsScore) },
        overall: { score: overallScore, grade: grade(overallScore) },
        graded,
        minHandsForGrade: MIN_HANDS_FOR_GRADE,
        buckets,
    };
}
