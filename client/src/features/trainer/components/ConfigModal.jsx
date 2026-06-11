import { useState } from "react";
import { DIFFICULTIES } from "../modes";

// Bounds for the dealing-speed field, in seconds per card.
const SPEED_MIN_S = 0.2;
const SPEED_MAX_S = 5;

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

    // Same idea for "hands before count": keep the raw text so the user can clear
    // the field and type freely (e.g. backspace to empty on the way to "2")
    // without it snapping to 1 mid-edit. We clamp to bounds on blur instead.
    const [handsText, setHandsText] = useState(config.handsUntilAsked.toString());
    const [prevHands, setPrevHands] = useState(config.handsUntilAsked);

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

    // Likewise re-sync the hands text on outside changes (preset selection).
    if (config.handsUntilAsked !== prevHands) {
        setPrevHands(config.handsUntilAsked);
        if (parseInt(handsText, 10) !== config.handsUntilAsked) {
            setHandsText(config.handsUntilAsked.toString());
        }
    }

    const handleSpeed = (e) => {
        const text = e.target.value;
        setSpeedText(text);
        const seconds = parseFloat(text);
        if (!Number.isNaN(seconds) && seconds >= SPEED_MIN_S && seconds <= SPEED_MAX_S) {
            set({ revealMs: Math.round(seconds * 1000) });
        }
    };

    // On blur, settle the speed: empty falls back to the minimum, otherwise clamp
    // into range — below the minimum becomes 0.2s, above the maximum becomes 5s.
    const commitSpeed = () => {
        const seconds = parseFloat(speedText);
        const settled = Number.isNaN(seconds)
            ? SPEED_MIN_S
            : Math.max(SPEED_MIN_S, Math.min(SPEED_MAX_S, seconds));
        setSpeedText(settled.toString());
        const ms = Math.round(settled * 1000);
        if (ms !== config.revealMs) set({ revealMs: ms });
    };

    const handleHands = (e) => {
        const text = e.target.value;
        setHandsText(text);
        const n = parseInt(text, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= 15) {
            set({ handsUntilAsked: n });
        }
    };

    // On blur, settle the field: empty falls back to 1, otherwise clamp into
    // range — below the minimum becomes 1, above the maximum becomes 15.
    const commitHands = () => {
        const n = parseInt(handsText, 10);
        const settled = Number.isNaN(n) ? 1 : Math.max(1, Math.min(15, n));
        setHandsText(settled.toString());
        if (settled !== config.handsUntilAsked) set({ handsUntilAsked: settled });
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
                                min={SPEED_MIN_S}
                                max={SPEED_MAX_S}
                                step={0.1}
                                value={speedText}
                                onChange={handleSpeed}
                                onBlur={commitSpeed}
                            />
                        </label>

                        <label className="field">
                            <span>Hands before count</span>
                            <input
                                type="number"
                                min={1}
                                max={15}
                                value={handsText}
                                onChange={handleHands}
                                onBlur={commitHands}
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
