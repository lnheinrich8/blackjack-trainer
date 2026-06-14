import Hand from "./Hand";
import Shoe from "../../shared/components/Shoe";
import { handValue, isBlackjack } from "../engine";
import { seatLayout } from "../state";

// Format a hand's value for display: "BJ" for a natural, "7/17" for a soft total
// (ace as 1 or 11), otherwise the plain total. Empty hands show nothing.
function totalLabel(cards) {
    if (cards.length === 0) return null;
    if (isBlackjack(cards)) return "BJ";
    const { total, isSoft } = handValue(cards);
    return isSoft ? `${total - 10}/${total}` : `${total}`;
}

// One seat's hand(s). A seat with no splits shows a single hand; the user's
// hands are labelled ("You", or "Hand 1/2/…" once split), the bots' are tagged
// "Player". A bot's cards collapse into a tight overlap except while it's being
// dealt to (dealing phase) or while it's the active seat on its turn — so the
// table stays tidy and the eye follows whoever is acting. The user never collapses.
function Seat({ seat, seatIndex, active, phase }) {
    const isUser = seat.kind === "user";
    const split = seat.hands.length > 1;
    const isSeatActive = phase === "playerTurn" && active.p === seatIndex;
    const collapsed = !isUser && phase !== "dealing" && !isSeatActive;
    return (
        <div className="playseat">
            {seat.hands.map((hand, h) => (
                <Hand
                    key={h}
                    label={isUser ? (split ? `Hand ${h + 1}` : "You") : "Player"}
                    cards={hand.cards}
                    totalText={totalLabel(hand.cards)}
                    bet={hand.bet}
                    isUser={isUser}
                    isActive={isSeatActive && active.h === h}
                    collapsed={collapsed}
                    outcome={hand.outcome}
                />
            ))}
        </div>
    );
}

// An empty bot seat for the betting phase — a dotted square plus a "Player" tag,
// so the other players are visible on the table before any cards are dealt.
function EmptySeat() {
    return (
        <div className="playseat">
            <Hand label="Player" cards={[]} />
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
    previewBots = 0,
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

    // During betting we show the configured bots as empty seats flanking the
    // user's bet spot (same left/right split they'll be dealt into). Otherwise the
    // live seats render with their cards.
    const seatProps = { active, phase };
    let leftSeats;
    let rightSeats;
    if (betting) {
        const { left, right } = seatLayout(previewBots + 1);
        leftSeats = Array.from({ length: left }, (_, i) => <EmptySeat key={`l${i}`} />);
        rightSeats = Array.from({ length: right }, (_, i) => <EmptySeat key={`r${i}`} />);
    } else {
        leftSeats = players
            .slice(0, userIndex)
            .map((seat, i) => <Seat key={seat.id} seat={seat} seatIndex={i} {...seatProps} />);
        rightSeats = players
            .slice(userIndex + 1)
            .map((seat, i) => (
                <Seat
                    key={seat.id}
                    seat={seat}
                    seatIndex={userIndex + 1 + i}
                    {...seatProps}
                />
            ));
    }

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
