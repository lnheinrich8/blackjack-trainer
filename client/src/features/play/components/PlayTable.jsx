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

// The blackjack felt: dealer on top, the player's hand(s) below. Reuses the
// trainer's table/felt styling. While the dealer's hole card is hidden, only the
// up-card counts toward the shown dealer total.
function PlayTable({
    dealer,
    dealerHoleHidden,
    hands,
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
                {phase === "betting" ? (
                    <div className="bet-spot">
                        <Hand label="You" cards={[]} isUser />
                        {betChips.length > 0 && (
                            <ChipStacks chips={betChips} onRemove={onRemoveChip} />
                        )}
                    </div>
                ) : (
                    hands.map((hand, i) => (
                        <Hand
                            key={i}
                            label={hands.length > 1 ? `Hand ${i + 1}` : "You"}
                            cards={hand.cards}
                            totalText={totalLabel(hand.cards)}
                            bet={hand.bet}
                            isUser
                            isActive={phase === "playerTurn" && i === active}
                            outcome={hand.outcome}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default PlayTable;
