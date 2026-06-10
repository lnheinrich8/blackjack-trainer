import Seat from "./Seat";

// The table felt: dealer at top-center, players in a centered row below. Players
// arrive already ordered left-to-right with the human user (You) as the last
// (rightmost) seat. With a single player the centered row puts You in the
// middle. Purely presentational — it renders whatever hands it's handed.
// `dealer` is { cards, isActive }; `players` is an array of
// { id, label, cards, isUser, isActive } in display order.
function BlackjackTable({ dealer, players }) {
  return (
    <div className="table">
      <div className="table__dealer">
        <Seat label="Dealer" cards={dealer.cards} isActive={dealer.isActive} />
      </div>

      <div className="table__players">
        {players.map((p) => (
          <Seat
            key={p.id}
            label={p.label}
            cards={p.cards}
            isUser={p.isUser}
            isActive={p.isActive}
          />
        ))}
      </div>
    </div>
  );
}

export default BlackjackTable;
