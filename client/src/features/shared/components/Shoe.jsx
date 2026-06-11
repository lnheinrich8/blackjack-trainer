// A dealing-shoe graphic for the table corner. The holder/tray (.shoe__bay) is a
// static rectangle, always full length so it looks able to hold the whole shoe.
// Inside it, the card stack (.shoe__cards, drawn edge-on) shrinks toward the
// mouth as the real shoe is dealt down — `remaining` / `total` come from the live
// shoe (cards left vs. full shoe size). We don't draw every card edge; the width
// conveys how much is left.
const MAX_WIDTH = 118; // px, a full stack of cards (matches the tray's inner length)
const MIN_WIDTH = 3; // a sliver while any cards remain

function Shoe({ remaining, total }) {
    const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    const width = frac > 0 ? Math.max(MIN_WIDTH, MAX_WIDTH * frac) : 0;

    return (
        <div className="shoe" aria-hidden="true">
            <div className="shoe__mouth" />
            <div className="shoe__bay">
                <div className="shoe__cards" style={{ width: `${width}px` }} />
            </div>
        </div>
    );
}

export default Shoe;
