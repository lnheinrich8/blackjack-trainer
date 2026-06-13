// The Stats page: two sections fed from the localStorage-backed state owned by
// App. "Bet strategy" judges how well the player's Testing-mode bets track the
// count; "Count accuracy" summarises the Train drills (with the per-guess list
// tucked behind a toggle so it's hidden by default).

import { computeBetStats } from "./betStats";

function formatPct(correct, total) {
    if (total === 0) return "—";
    return `${Math.round((correct / total) * 100)}%`;
}

// Signed dollar amount, e.g. +$120 / -$45 / $0.
function money(n) {
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}$${Math.abs(n)}`;
}

function netClass(n) {
    if (n > 0) return "stats__net stats__net--win";
    if (n < 0) return "stats__net stats__net--lose";
    return "stats__net";
}

// Signed percentage, e.g. +1.4% / −2.0% / 0.0%.
function signedPct(frac) {
    const v = frac * 100;
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    return `${sign}${Math.abs(v).toFixed(1)}%`;
}

// Colour class for a letter grade (reuses the ramp grade colours).
function gradeClass(grade) {
    return grade ? `ramp__grade--${grade.toLowerCase()}` : "";
}

// One-line read on the overall grade, calling out when the two factors diverge —
// e.g. bets that track the count but still bleed money.
function overallNote(bet) {
    const rampOk = bet.ramp.score >= 50;
    const profitOk = bet.roi >= 0;
    if (rampOk && profitOk) {
        return "Your bets track the count and your bankroll's growing — great counting.";
    }
    if (rampOk && !profitOk) {
        return "Your bets track the count but you're down — variance, or tighten your play.";
    }
    if (!rampOk && profitOk) {
        return "You're up money, but your bets barely track the count.";
    }
    return "Your bets don't track the count and you're losing — bet big on high counts, small on low.";
}

// The headline bet-strategy summary: a blended overall grade, then the two
// factors it's made of (bet ramp + results).
function GradeSummary({ bet }) {
    if (!bet.graded) {
        return (
            <div className="ramp ramp--pending">
                <span className="ramp__grade">—</span>
                <div className="ramp__body">
                    <span className="ramp__title">Overall grade</span>
                    <span className="ramp__note">
                        Play {bet.minHandsForGrade}+ Testing-mode hands for a grade
                        ({bet.hands} so far).
                    </span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="ramp">
                <span className={`ramp__grade ${gradeClass(bet.overall.grade)}`}>
                    {bet.overall.grade}
                </span>
                <div className="ramp__body">
                    <span className="ramp__title">
                        Overall grade · {bet.overall.score}/100
                    </span>
                    <span className="ramp__note">{overallNote(bet)}</span>
                </div>
            </div>

            <div className="grade-factors">
                <div className="grade-factor">
                    <span className="grade-factor__label">Bet ramp</span>
                    <span className="grade-factor__value">
                        <strong className={gradeClass(bet.ramp.grade)}>
                            {bet.ramp.grade}
                        </strong>
                        {bet.ramp.score}/100
                    </span>
                    <span className="grade-factor__hint">tracks the count</span>
                </div>
                <div className="grade-factor">
                    <span className="grade-factor__label">Results</span>
                    <span className="grade-factor__value">
                        <strong className={gradeClass(bet.results.grade)}>
                            {bet.results.grade}
                        </strong>
                        {bet.results.score}/100
                    </span>
                    <span className="grade-factor__hint">grows bankroll</span>
                </div>
            </div>
        </>
    );
}

function BetStrategy({ betStats, onResetBets }) {
    const bet = computeBetStats(betStats.history);

    if (bet.hands === 0) {
        return (
            <section className="panel stats">
                <h2>Bet strategy</h2>
                <p className="stats__sub">
                    How well your bets track the count in Testing mode.
                </p>
                <p className="stats__empty">
                    Play a few hands in Testing mode (Play page) to analyze your
                    betting.
                </p>
            </section>
        );
    }

    return (
        <section className="panel stats">
            <h2>Bet strategy</h2>
            <p className="stats__sub">
                How well your bets track the count in Testing mode.
            </p>

            <GradeSummary bet={bet} />

            <div className="stats__summary">
                <div>
                    <span className="stats__value">{bet.hands}</span>
                    <span className="stats__label">hands</span>
                </div>
                <div>
                    <span className="stats__value">${bet.totalWagered}</span>
                    <span className="stats__label">wagered</span>
                </div>
                <div>
                    <span className={`stats__value ${netClass(bet.net)}`}>
                        {money(bet.net)}
                    </span>
                    <span className="stats__label">net</span>
                </div>
                <div>
                    <span className={`stats__value ${netClass(bet.roi)}`}>
                        {signedPct(bet.roi)}
                    </span>
                    <span className="stats__label">ROI</span>
                </div>
            </div>

            <p className="stats__spread">
                Bet spread{" "}
                <strong>
                    ${bet.minBet} → ${bet.maxBet}
                </strong>
                {bet.spread && bet.spread > 1 && (
                    <span className="stats__meta"> ({Math.round(bet.spread)}×)</span>
                )}
            </p>

            <h3>By true count</h3>
            <table className="stats__table">
                <thead>
                    <tr>
                        <th>True count</th>
                        <th>Hands</th>
                        <th>Avg bet</th>
                        <th>Net</th>
                    </tr>
                </thead>
                <tbody>
                    {bet.buckets.map((b) => (
                        <tr key={b.id} className={b.hands === 0 ? "is-empty" : ""}>
                            <td>{b.label}</td>
                            <td>{b.hands || "—"}</td>
                            <td>{b.avgBet === null ? "—" : `$${b.avgBet}`}</td>
                            <td className={b.net === null ? "" : netClass(b.net)}>
                                {b.net === null ? "—" : money(b.net)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <button className="btn btn--ghost" onClick={onResetBets}>
                Reset bet stats
            </button>
        </section>
    );
}

function CountAccuracy({ stats, onReset }) {
    const { totalDrills, totalCorrect, history } = stats;

    return (
        <section className="panel stats">
            <h2>Count accuracy</h2>
            <p className="stats__sub">Your running-count guesses from the Train page.</p>

            <div className="stats__summary">
                <div>
                    <span className="stats__value">{totalDrills}</span>
                    <span className="stats__label">drills</span>
                </div>
                <div>
                    <span className="stats__value">
                        {formatPct(totalCorrect, totalDrills)}
                    </span>
                    <span className="stats__label">accuracy</span>
                </div>
            </div>

            {totalDrills === 0 ? (
                <p className="stats__empty">No drills yet — play one!</p>
            ) : (
                <>
                    <ul className="stats__history stats__history--scroll">
                        {history.map((h, i) => (
                            <li key={i} className={h.isCorrect ? "ok" : "bad"}>
                                <span>{h.isCorrect ? "✓" : "✗"}</span>
                                <span>
                                    guessed {h.guessed}, running {h.correct}
                                </span>
                                <span className="stats__meta">
                                    {h.numDecks}d · {h.numCards}c
                                </span>
                            </li>
                        ))}
                    </ul>

                    <button className="btn btn--ghost" onClick={onReset}>
                        Reset count stats
                    </button>
                </>
            )}
        </section>
    );
}

function Stats({ stats, betStats, onReset, onResetBets }) {
    return (
        <div className="stats-page">
            <BetStrategy betStats={betStats} onResetBets={onResetBets} />
            <CountAccuracy stats={stats} onReset={onReset} />
        </div>
    );
}

export default Stats;
