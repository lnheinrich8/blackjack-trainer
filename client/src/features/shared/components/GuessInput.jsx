// The user enters their running count. The running count can be negative, so we
// accept a signed integer. There's no button — Spacebar submits.

function GuessInput({ value, onChange, onSubmit, busy }) {
    const handleKeyDown = (e) => {
        if (e.key === " " && !busy) {
            e.preventDefault(); // don't type a space into the field
            onSubmit();
        }
    };

    return (
        <div className="guess">
            <div className="guess__row">
                <span className="guess__label">Running count?</span>
                <input
                    type="number"
                    inputMode="numeric"
                    value={value}
                    autoFocus
                    placeholder="e.g. -3"
                    disabled={busy}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <p className="guess__hint">
                {busy ? (
                    "Checking…"
                ) : (
                    <>
                        Press <strong>Spacebar</strong> to submit your count.
                    </>
                )}
            </p>
        </div>
    );
}

export default GuessInput;
