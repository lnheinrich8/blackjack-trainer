import { DIFFICULTIES } from "../playModes";

// The Play page settings modal. Mirrors the trainer's ConfigModal: pick a
// difficulty (which fills in concrete values) or edit Decks/Players directly —
// editing flips the selection to "Custom". Dynamic hides the values since the
// table size drifts as you play. Changes are pushed up to Play, which persists
// them to localStorage.
function PlayConfigModal({
    difficultyId,
    config,
    onSelectDifficulty,
    onChangeConfig,
    onExitTesting,
    onClose,
}) {
    const isDynamic = difficultyId === "dynamic";
    const set = (patch) => onChangeConfig({ ...config, ...patch });

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h2>Configure blackjack</h2>
                    <button className="modal__close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <p className="modal__label">
                    Difficulty
                    {difficultyId === "custom" && <span className="badge">Custom</span>}
                    {difficultyId === "testing-custom" && (
                        <span className="badge-wrap">
                            <button
                                type="button"
                                className="badge badge--clickable"
                                onClick={onExitTesting}
                            >
                                Testing custom
                            </button>
                            <span className="badge__hint">Cancel testing mode</span>
                        </span>
                    )}
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
                        Plays at the maximum deck count, and other players join and leave
                        the table at random every few hands.
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
                            <span>Other players</span>
                            {/* The value is the number of bots (excluding the user); we
                                store total seats internally, so map ±1 on read/write. */}
                            <select
                                value={config.numPlayers - 1}
                                onChange={(e) =>
                                    set({ numPlayers: Number(e.target.value) + 1 })
                                }
                            >
                                {[0, 1, 2, 3, 4].map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
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

export default PlayConfigModal;
