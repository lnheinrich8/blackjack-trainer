import { useState } from "react";
import { DIFFICULTIES } from "../modes";

// The Configure modal: pick a difficulty (which fills in concrete values) or
// edit any specific value — editing flips the selection to "Custom". Dynamic
// hides the values since they change as you play. All changes are pushed up to
// Trainer, which persists them to localStorage.
function ConfigModal({
  difficultyId,
  config,
  onSelectDifficulty,
  onChangeConfig,
  onClose,
}) {
  const isDynamic = difficultyId === "dynamic";
  const set = (patch) => onChangeConfig({ ...config, ...patch });

  // Speed is edited in seconds (with decimals) but stored as ms. Keep the raw
  // text locally so partial entries like "1." or "0.35" type smoothly.
  const [speedText, setSpeedText] = useState(
    (config.revealMs / 1000).toString(),
  );
  const [prevRevealMs, setPrevRevealMs] = useState(config.revealMs);

  // Re-sync the speed text when revealMs changes from OUTSIDE (e.g. picking a
  // preset) — but not when the change came from this field's own typing (those
  // already match). React's "adjust state during render" pattern, no effect.
  if (config.revealMs !== prevRevealMs) {
    setPrevRevealMs(config.revealMs);
    const fromText = Math.round((parseFloat(speedText) || 0) * 1000);
    if (fromText !== config.revealMs) {
      setSpeedText((config.revealMs / 1000).toString());
    }
  }

  const handleSpeed = (e) => {
    const text = e.target.value;
    setSpeedText(text);
    const seconds = parseFloat(text);
    if (!Number.isNaN(seconds) && seconds > 0) {
      set({ revealMs: Math.round(seconds * 1000) });
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Configure drill</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="modal__label">
          Difficulty
          {difficultyId === "custom" && <span className="badge">Custom</span>}
        </p>
        <div className="difficulty-row">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`difficulty ${difficultyId === d.id ? "is-active" : ""}`}
              onClick={() => onSelectDifficulty(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {isDynamic ? (
          <p className="modal__note">
            Decks, dealing speed, and player count adapt automatically as you
            count — speeding up when you're right and easing off when you're
            wrong.
          </p>
        ) : (
          <div className="config-fields">
            <label className="field">
              <span>Decks</span>
              <select
                value={config.decks}
                onChange={(e) => set({ decks: Number(e.target.value) })}
              >
                {[1, 2, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Players</span>
              <select
                value={config.numPlayers}
                onChange={(e) => set({ numPlayers: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Dealing speed (s)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={speedText}
                onChange={handleSpeed}
              />
            </label>

            <label className="field">
              <span>Hands before count</span>
              <input
                type="number"
                min={1}
                max={15}
                value={config.handsUntilAsked}
                onChange={(e) =>
                  set({
                    handsUntilAsked: Math.max(
                      1,
                      Math.min(15, Number(e.target.value) || 1),
                    ),
                  })
                }
              />
            </label>
          </div>
        )}

        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigModal;
