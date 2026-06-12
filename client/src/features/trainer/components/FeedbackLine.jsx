// Shown under the table after grading, styled like the count-asking line it
// replaces: a single line saying whether the guess was right or wrong and what
// the actual running count was, plus a Spacebar-to-continue hint. (Replaces the
// old pop-up FeedbackBanner with its Continue button.)
function FeedbackLine({ result }) {
    const count = result.correctCount;
    const signed = `${count > 0 ? "+" : ""}${count}`;

    return (
        <div className="guess">
            <div className="guess__row">
                <span className="guess__label">
                    <span
                        className={
                            result.correct ? "guess__verdict--win" : "guess__verdict--lose"
                        }
                    >
                        {result.correct ? "Correct!" : "Not quite."}
                    </span>{" "}
                    The running count was {signed}.
                </span>
            </div>
            <p className="guess__hint">
                Press <strong>Spacebar</strong> to continue.
            </p>
        </div>
    );
}

export default FeedbackLine;
