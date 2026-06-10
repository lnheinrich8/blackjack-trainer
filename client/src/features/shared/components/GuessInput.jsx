// The user enters their running count. The running count can be negative, so we
// accept a signed integer. Enter submits.

function GuessInput({ value, onChange, onSubmit, busy }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSubmit();
  };

  return (
    <div className="guess">
      <h2>What's the running count?</h2>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        autoFocus
        placeholder="e.g. -3"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="btn btn--primary"
        onClick={onSubmit}
        disabled={busy || value === ""}
      >
        {busy ? "Checking…" : "Submit"}
      </button>
    </div>
  );
}

export default GuessInput;
