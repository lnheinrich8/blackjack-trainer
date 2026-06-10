import CardView from "./CardView";

// One position at the table — not a literal chair, just a flag marking where a
// hand is dealt, plus that hand's cards. `isUser` marks the human player (always
// centered by BlackjackTable); `isActive` marks the spot currently being dealt
// to. An active spot with no cards yet still shows its flag + an empty slot so
// you can see where cards are about to land.
function Seat({ label, cards = [], isUser = false, isActive = false }) {
  const classes = ["seat"];
  if (isActive) classes.push("seat--active");
  if (isUser) classes.push("seat--user");

  return (
    <div className={classes.join(" ")}>
      <div className="seat__cards">
        {cards.length === 0 ? (
          <div className="seat__empty" />
        ) : (
          cards.map((card, i) => (
            <CardView key={i} card={card} />
          ))
        )}
      </div>
      <span className="seat__flag">{isUser ? "You" : label}</span>
    </div>
  );
}

export default Seat;
