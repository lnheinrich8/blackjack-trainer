import { useState } from "react";
import Trainer from "./features/trainer/Trainer";
import Play from "./features/play/Play";
import Stats from "./features/stats/Stats";
import TopNav from "./features/shared/components/TopNav";
import { useLocalStorage } from "./features/shared/hooks/useLocalStorage";

const DEFAULT_STATS = { totalDrills: 0, totalCorrect: 0, history: [] };
const HISTORY_LIMIT = 20;

function App() {
  // Stats persist to localStorage, so a returning user keeps their progress.
  const [stats, setStats] = useLocalStorage("bjack.stats", DEFAULT_STATS);
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

  const accuracy =
    stats.totalDrills === 0
      ? "—"
      : `${Math.round((stats.totalCorrect / stats.totalDrills) * 100)}%`;

  return (
    <div className="site">
      <TopNav
        active={section}
        onSelect={setSection}
        glance={`${accuracy} · ${stats.totalDrills} counts`}
      />

      <main className="site__main">
        {section === "train" && <Trainer onResult={recordResult} />}
        {section === "play" && <Play />}
        {section === "stats" && <Stats stats={stats} onReset={resetStats} />}
      </main>
    </div>
  );
}

export default App;
