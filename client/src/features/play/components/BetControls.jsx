import { useEffect, useRef, useState } from "react";
import { CHIP_DEFS } from "../chips";

// Chip betting for the betting phase. Add chips up to your bankroll, then deal
// with Spacebar. `nudge` increments when the player tries to deal with no chips
// down, to flash the "Add chips" hint.
function BetControls({ bet, bankroll, onAddChip, nudge = 0 }) {
    // Flash only when `nudge` actually changes while we're mounted — NOT on mount.
    // BetControls remounts every betting phase, so keying the flash off `nudge > 0`
    // alone would (wrongly) replay it at the start of each new hand.
    const prevNudge = useRef(nudge);
    const [flash, setFlash] = useState(0);
    useEffect(() => {
        if (nudge !== prevNudge.current) {
            prevNudge.current = nudge;
            setFlash((f) => f + 1); // changing key remounts the span to replay the anim
        }
    }, [nudge]);

    return (
        <div className="bet">
            <div className="bet__line">
                <div className="bet__chips">
                    {CHIP_DEFS.map(({ value, color }) => (
                        <button
                            key={value}
                            className={`chip chip--${color}`}
                            onClick={() => onAddChip(value)}
                            disabled={bet + value > bankroll}
                        >
                            ${value}
                        </button>
                    ))}
                </div>

                <span className="bet__amount">
                    Bet <strong>${bet}</strong>
                </span>
            </div>

            <p className="belt__keys">
                <span
                    key={flash}
                    className={flash > 0 ? "bet__nudge bet__nudge--flash" : "bet__nudge"}
                >
                    Add chips
                </span>
                , then press <strong>Spacebar</strong> to deal. Click a stack to remove a
                chip.
            </p>
        </div>
    );
}

export default BetControls;
