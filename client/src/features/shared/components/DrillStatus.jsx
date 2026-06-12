import { useState } from "react";

// Top-right status label (used by both the Train and Play pages). Hover over it
// to reveal the current settings (decks, players, etc.) in a vertical column
// underneath. `details` is a ready-made list of strings built by the caller.
// `toggleClassName` lets a caller restyle the hover trigger (e.g. the Play page
// uses its bankroll text as the trigger).
function DrillStatus({ label, details, toggleClassName }) {
    const [hovered, setHovered] = useState(false);
    const toggle = toggleClassName
        ? `drillstatus__toggle ${toggleClassName}`
        : "drillstatus__toggle";

    return (
        <div
            className="drillstatus"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span className={toggle}>{label}</span>

            {hovered && (
                <ul className="drillstatus__details">
                    {details.map((d, i) => (
                        <li key={i}>{d}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default DrillStatus;
