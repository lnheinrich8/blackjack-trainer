// Lifetime stats + recent history, fed from the localStorage-backed state owned
// by App. This is the "major information saved for the user when they return."

function formatPct(correct, total) {
    if (total === 0) return "—";
    return `${Math.round((correct / total) * 100)}%`;
}

function Stats({ stats, onReset }) {
    const { totalDrills, totalCorrect, history } = stats;

    return (
        <aside className="panel stats">
            <h2>Your stats</h2>

            <div className="stats__summary">
                <div>
                    <span className="stats__value">{totalDrills}</span>
                    <span className="stats__label">drills</span>
                </div>
                <div>
                    <span className="stats__value">{formatPct(totalCorrect, totalDrills)}</span>
                    <span className="stats__label">accuracy</span>
                </div>
            </div>

            <h3>Recent</h3>
            {history.length === 0 ? (
                <p className="stats__empty">No drills yet — play one!</p>
            ) : (
                <ul className="stats__history">
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
            )}

            {totalDrills > 0 && (
                <button className="btn btn--ghost" onClick={onReset}>
                    Reset stats
                </button>
            )}
        </aside>
    );
}

export default Stats;
