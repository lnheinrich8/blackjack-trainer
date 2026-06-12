import Hand from "./Hand";
import ChipStacks from "./ChipStacks";
import Shoe from "../../shared/components/Shoe";
import { handValue, isBlackjack } from "../engine";

// Format a hand's value for display: "BJ" for a natural, "7/17" for a soft total
// (ace as 1 or 11), otherwise the plain total. Empty hands show nothing.
function totalLabel(cards) {
    if (cards.length === 0) return null;
    if (isBlackjack(cards)) return "BJ";
    const { total, isSoft } = handValue(cards);
    return isSoft ? `${total - 10}/${total}` : `${total}`;
}

// One seat's hand(s). A seat with no splits shows a single hand; the user's
// hands are labelled ("You", or "Hand 1/2/…" once split), the bots' aren't.
function Seat({ seat, seatIndex, active, phase }) {
    const isUser = seat.kind === "user";
    const split = seat.hands.length > 1;
    return (
        <div className="playseat">
            {seat.hands.map((hand, h) => (
                <Hand
                    key={h}
                    label={isUser ? (split ? `Hand ${h + 1}` : "You") : null}
                    cards={hand.cards}
                    totalText={totalLabel(hand.cards)}
                    bet={hand.bet}
                    isUser={isUser}
                    isActive={
                        phase === "playerTurn" && active.p === seatIndex && active.h === h
                    }
                    outcome={hand.outcome}
                />
            ))}
        </div>
    );
}

// The blackjack felt: dealer on top, the seats below. The user always sits dead-
// center with the bots fanned out in the left/right wings, so the table can grow
// or shrink (dynamic mode) without the user's hand ever sliding sideways. While
// the dealer's hole card is hidden, only the up-card counts toward their total.
function PlayTable({
    dealer,
    dealerHoleHidden,
    players,
    userIndex,
    active,
    phase,
    betChips = [],
    onRemoveChip,
    cardsRemaining = 0,
    shoeSize = 0,
}) {
    const holeIndex = dealerHoleHidden ? 1 : null;
    const dealerTotal =
        dealer.length === 0
            ? null
            : dealerHoleHidden
                ? totalLabel([dealer[0]])
                : totalLabel(dealer);

    const betting = phase === "betting";

    // During betting the wings are empty and only the user's bet spot shows; the
    // bots appear once the deal begins (their wings populate without moving You).
    const seatProps = { active, phase };
    const leftSeats = betting
        ? null
        : players
            .slice(0, userIndex)
            .map((seat, i) => <Seat key={seat.id} seat={seat} seatIndex={i} {...seatProps} />);
    const rightSeats = betting
        ? null
        : players
            .slice(userIndex + 1)
            .map((seat, i) => (
                <Seat
                    key={seat.id}
                    seat={seat}
                    seatIndex={userIndex + 1 + i}
                    {...seatProps}
                />
            ));

    return (
        <div className="table">
            <Shoe remaining={cardsRemaining} total={shoeSize} />

            <div className="table__dealer">
                <Hand
                    label="Dealer"
                    cards={dealer}
                    totalText={dealerTotal}
                    holeIndex={holeIndex}
                />
            </div>

            <div className="table__players">
                <div className="seats seats--left">{leftSeats}</div>
                <div className="seats seats--user">
                    {betting ? (
                        <div className="bet-spot">
                            <Hand label="You" cards={[]} isUser />
                            {betChips.length > 0 && (
                                <ChipStacks chips={betChips} onRemove={onRemoveChip} />
                            )}
                        </div>
                    ) : (
                        <Seat
                            seat={players[userIndex]}
                            seatIndex={userIndex}
                            {...seatProps}
                        />
                    )}
                </div>
                <div className="seats seats--right">{rightSeats}</div>
            </div>
        </div>
    );
}

export default PlayTable;
