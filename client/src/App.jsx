import { useState } from "react";
import Trainer from "./features/trainer/Trainer";
import Play from "./features/play/Play";
import Stats from "./features/stats/Stats";
import Coach from "./features/coach/Coach";
import TopNav from "./features/shared/components/TopNav";
import { useLocalStorage } from "./features/shared/hooks/useLocalStorage";

const DEFAULT_STATS = { totalDrills: 0, totalCorrect: 0, history: [] };
const HISTORY_LIMIT = 20;

// Testing-mode betting history (one entry per settled round). Capped larger than
// the drill history since the bet-strategy aggregates want a decent sample.
const DEFAULT_BET_STATS = { history: [] };
const BET_HISTORY_LIMIT = 200;

function App() {
    // Stats persist to localStorage, so a returning user keeps their progress.
    const [stats, setStats] = useLocalStorage("bjack.stats", DEFAULT_STATS);
    const [betStats, setBetStats] = useLocalStorage(
        "bjack.play.betstats",
        DEFAULT_BET_STATS,
    );
    const [section, setSection] = useState("play");

    // Called when a count is graded — fold the result into lifetime stats and the
    // capped recent-history list.
    const recordResult = (result, config) => {
        setStats((prev) => ({
            totalDrills: prev.totalDrills + 1,
            totalCorrect: prev.totalCorrect + (result.correct ? 1 : 0),
            history: [
                {
                    guessed: result.guessedCount,
                    correct: result.correctCount,
                    isCorrect: result.correct,
                    numDecks: config.numDecks,
                    numCards: config.numCards,
                },
                ...prev.history,
            ].slice(0, HISTORY_LIMIT),
        }));
    };

    const resetStats = () => setStats(DEFAULT_STATS);

    // Called when a Testing-mode round settles — record the bet placed, the true
    // count it was placed at, and how the round netted out, so the Stats page can
    // judge how well the player's bets track the count.
    const recordBet = (entry) => {
        setBetStats((prev) => ({
            history: [entry, ...prev.history].slice(0, BET_HISTORY_LIMIT),
        }));
    };

    const resetBetStats = () => setBetStats(DEFAULT_BET_STATS);

    const accuracy =
        stats.totalDrills === 0
            ? "—"
            : `${Math.round((stats.totalCorrect / stats.totalDrills) * 100)}%`;

    return (
        <div className={`site${section === "coach" ? " site--fixed" : ""}`}>
            <TopNav
                active={section}
                onSelect={setSection}
                glance={`${accuracy} · ${stats.totalDrills} counts`}
            />

            <main className="site__main">
                {section === "train" && <Trainer onResult={recordResult} />}
                {section === "play" && <Play onRecordBet={recordBet} />}
                {section === "coach" && <Coach betStats={betStats} />}
                {section === "stats" && (
                    <Stats
                        stats={stats}
                        betStats={betStats}
                        onReset={resetStats}
                        onResetBets={resetBetStats}
                    />
                )}
            </main>
        </div>
    );
}

export default App;
