import { useEffect, useRef, useState } from "react";

// Top-right difficulty label. Click it to expand the current settings (decks,
// players, speed, streak) in a vertical column underneath. Replaces the old gray
// HUD bar. `details` is a ready-made list of strings built by Trainer.
function DrillStatus({ label, details }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // While open, a click anywhere outside this component closes it. (Clicking the
    // toggle itself stays inside the ref, so its own onClick handles that case.)
    useEffect(() => {
        if (!open) return;
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [open]);

    return (
        <div className="drillstatus" ref={ref}>
            <button
                className="drillstatus__toggle"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
            >
                {label}
            </button>

            {open && (
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
