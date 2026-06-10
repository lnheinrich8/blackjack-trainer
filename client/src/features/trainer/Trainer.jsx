import { useCallback, useEffect, useState } from "react";
import BlackjackTable from "../shared/components/BlackjackTable";
import TableDrill from "./components/TableDrill";
import ConfigModal from "./components/ConfigModal";
import DrillStatus from "./components/DrillStatus";
import { useLocalStorage } from "../shared/hooks/useLocalStorage";
import {
  PRESETS,
  DEFAULT_DIFFICULTY,
  resolveController,
  labelFor,
} from "./modes";

const DEFAULT_SAVED = {
  difficultyId: DEFAULT_DIFFICULTY,
  config: PRESETS[DEFAULT_DIFFICULTY],
};

// Build the expandable status detail lines for the top-right label.
function buildDetails(config, { dynamicIdle, running }) {
  if (dynamicIdle) return ["Adapts as you play"];
  const lines = [
    `${config.decks} ${config.decks === 1 ? "deck" : "decks"}`,
    `${config.numPlayers} ${config.numPlayers === 1 ? "player" : "players"}`,
    `${config.revealMs} ms`,
  ];
  if (running) lines.push(`streak ${config.streak ?? 0}`);
  return lines;
}

// The Card Counting Trainer page. Table shows immediately; Configure changes the
// persisted difficulty/values, Go starts (or restarts) the drill.
function Trainer({ onResult }) {
  const [saved, setSaved] = useLocalStorage("bjack.trainer", DEFAULT_SAVED);
  const [modalOpen, setModalOpen] = useState(false);
  const [run, setRun] = useState(null); // snapshot of { difficultyId, config } at Go
  const [runId, setRunId] = useState(0);
  const [liveConfig, setLiveConfig] = useState(null); // reported by the running drill

  const handleConfigChange = useCallback((c) => setLiveConfig(c), []);

  // Does a candidate config behave differently from the running drill? Dynamic vs
  // not always differs; otherwise compare the concrete values (preset/custom with
  // identical values behave the same, so that doesn't count as a change).
  const differsFromRun = (next) => {
    if (!run) return false;
    const nextDyn = next.difficultyId === "dynamic";
    const runDyn = run.difficultyId === "dynamic";
    if (nextDyn !== runDyn) return true;
    if (nextDyn) return false;
    const a = next.config;
    const b = run.config;
    return (
      a.decks !== b.decks ||
      a.numPlayers !== b.numPlayers ||
      a.revealMs !== b.revealMs ||
      a.handsUntilAsked !== b.handsUntilAsked
    );
  };

  // Persist the new settings; if they actually differ from the running drill,
  // drop back to the idle "Go" state so the table reflects them immediately.
  const applySaved = (next) => {
    setSaved(next);
    if (differsFromRun(next)) {
      setRun(null);
      setLiveConfig(null);
    }
  };

  // Picking a preset fills in its values; Dynamic keeps the last config around.
  const selectDifficulty = (id) => {
    if (id === "dynamic") {
      applySaved({ ...saved, difficultyId: "dynamic" });
    } else {
      applySaved({ difficultyId: id, config: PRESETS[id] });
    }
  };

  // Editing any specific value flips the difficulty to Custom.
  const changeConfig = (config) => applySaved({ difficultyId: "custom", config });

  // Start (or restart) the drill from the current saved settings.
  const start = useCallback(() => {
    setRun({ difficultyId: saved.difficultyId, config: saved.config });
    setLiveConfig(null);
    setRunId((n) => n + 1);
    setModalOpen(false);
  }, [saved]);

  // Stop the drill and return to the blank idle table (without re-running it).
  const stop = useCallback(() => {
    setRun(null);
    setLiveConfig(null);
  }, []);

  const running = run !== null;

  // Keyboard controls: Enter starts the drill when idle; while it's running R
  // restarts and Esc stops it. Ignore Enter/R while typing (e.g. the count
  // input) so they don't fire mid-guess; Esc always stops. The Configure modal
  // owns its own keys, so skip the global handler while it's open.
  useEffect(() => {
    const onKey = (e) => {
      if (modalOpen) return;
      const tag = e.target.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (!running) {
        if (e.key === "Enter" && !typing) start();
        return;
      }
      if (e.key === "Escape") stop();
      else if ((e.key === "r" || e.key === "R") && !typing) start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, modalOpen, start, stop]);
  const activeDifficulty = running ? run.difficultyId : saved.difficultyId;
  const statusConfig = running ? liveConfig ?? run.config : saved.config;
  const details = buildDetails(statusConfig, {
    dynamicIdle: activeDifficulty === "dynamic" && !running,
    running,
  });

  // Idle table preview (before the first Go): empty seats for the chosen size.
  const previewCount =
    saved.difficultyId === "dynamic" ? 1 : saved.config.numPlayers;
  const previewPlayers = Array.from({ length: previewCount }, (_, i) => {
    const isUser = i === previewCount - 1;
    return {
      id: `p${i}`,
      label: isUser ? "You" : `P${i + 1}`,
      cards: [],
      isUser,
      isActive: false,
    };
  });

  return (
    <section className="trainer">
      <div className="trainer__bar">
        <div className="trainer__controls">
          <button className="btn btn--ghost" onClick={() => setModalOpen(true)}>
            ⚙ Configure
          </button>
        </div>

        <DrillStatus label={labelFor(activeDifficulty)} details={details} />
      </div>

      <div className="trainer__spacer trainer__spacer--top" aria-hidden="true" />

      {running ? (
        <TableDrill
          key={runId}
          controller={resolveController(run.difficultyId, run.config)}
          onConfigChange={handleConfigChange}
          onResult={onResult}
        />
      ) : (
        <div className="tabledrill">
          <div className="tabledrill__stage">
            <BlackjackTable
              dealer={{ cards: [], isActive: false }}
              players={previewPlayers}
            />
          </div>
          <div className="tabledrill__belt">
            <p className="belt__keys">
              Press the <strong>Enter</strong> key to start the drill.
            </p>
          </div>
        </div>
      )}

      <div className="trainer__spacer trainer__spacer--bottom" aria-hidden="true" />

      {modalOpen && (
        <ConfigModal
          difficultyId={saved.difficultyId}
          config={saved.config}
          onSelectDifficulty={selectDifficulty}
          onChangeConfig={changeConfig}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}

export default Trainer;
