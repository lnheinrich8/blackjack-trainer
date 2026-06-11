import CardView from "../../shared/components/CardView";

// One hand on the blackjack table — the dealer's or one of the player's. Cards
// overlap like the trainer's seats; a hidden hole card (dealer's second card
// before their turn) renders face-down via CardView's placeholder. `totalText`
// is the pre-formatted hand value, `outcome` (win/lose/push/blackjack) tints the
// hand once the round is settled.
function Hand({
    label,
    cards,
    totalText,
    bet,
    isActive = false,
    isUser = false,
    outcome = null,
    holeIndex = null,
}) {
    const classes = ["hand"];
    if (isActive) classes.push("hand--active");
    if (isUser) classes.push("hand--user");
    if (outcome) classes.push(`hand--${outcome}`);

    return (
        <div className={classes.join(" ")}>
            <div className="hand__cards">
                {cards.length === 0 ? (
                    <div className="seat__empty" />
                ) : (
                    cards.map((card, i) =>
                        i === holeIndex ? (
                            <CardView key={i} placeholder />
                        ) : (
                            <CardView key={i} card={card} />
                        ),
                    )
                )}
            </div>

            <div className="hand__meta">
                <span className="hand__flag">{label}</span>
                {totalText != null && <span className="hand__total">{totalText}</span>}
                {bet != null && <span className="hand__bet">${bet}</span>}
            </div>
        </div>
    );
}

export default Hand;
