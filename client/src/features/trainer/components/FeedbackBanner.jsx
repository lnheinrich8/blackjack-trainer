// Shown under the table after grading: whether the guess matched the server-
// computed running count, the derived true count, and (for Dynamic) what changed.
function FeedbackBanner({ result, decks, note, onContinue }) {
  const trueCount = (result.correctCount / decks).toFixed(2);

  return (
    <div
      className={`panel feedback ${
        result.correct ? "feedback--win" : "feedback--lose"
      }`}
    >
      <h2>{result.correct ? "Correct! 🎯" : "Not quite"}</h2>

      <p className="feedback__line">
        Running count <strong>{result.correctCount}</strong> · true {trueCount}
      </p>
      <p className="feedback__line">You said {result.guessedCount}</p>

      {note && <p className="feedback__note">{note}</p>}

      <button className="btn btn--primary" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

export default FeedbackBanner;
