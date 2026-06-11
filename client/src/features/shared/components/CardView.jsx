import { isRedSuit, rankLabel, suitSymbol } from "../utils/cards";

// Renders a single playing card. `card` is { rank, suit } using the server's
// enum names. Pass placeholder to render a face-down/empty slot.
function CardView({ card, placeholder = false }) {
    if (placeholder || !card) {
        return <div className="card card--placeholder" />;
    }

    const color = isRedSuit(card.suit) ? "card--red" : "card--black";

    return (
        <div className={`card ${color}`}>
            <span className="card__rank">{rankLabel(card.rank)}</span>
            <span className="card__suit">{suitSymbol(card.suit)}</span>
        </div>
    );
}

export default CardView;
