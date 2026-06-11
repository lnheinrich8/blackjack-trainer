// Pure blackjack rules engine — no React, no state, just card math. Cards are the
// server's shape: { rank, suit } using the enum names (e.g. "ACE", "KING").
// House rules (MVP): blackjack pays 3:2, dealer stands on all 17 (S17).

// The blackjack point value of each rank. Aces start at 11 and handValue demotes
// them to 1 when a hand would otherwise bust. Face cards are all worth 10.
const RANK_VALUES = {
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    SIX: 6,
    SEVEN: 7,
    EIGHT: 8,
    NINE: 9,
    TEN: 10,
    JACK: 10,
    QUEEN: 10,
    KING: 10,
    ACE: 11,
};

// Best blackjack total for a hand. Aces count as 11 until that would bust, then
// drop to 1. Returns { total, isSoft }, where isSoft means an ace is still being
// counted as 11 (so the hand can't bust on the next single hit).
export function handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
        total += RANK_VALUES[card.rank];
        if (card.rank === "ACE") aces += 1;
    }

    // Demote aces from 11 to 1 (−10 each) until the hand no longer busts.
    let elevens = aces;
    while (total > 21 && elevens > 0) {
        total -= 10;
        elevens -= 1;
    }

    return { total, isSoft: elevens > 0 };
}

// A natural blackjack: exactly two cards totaling 21 (an ace + a ten-value card).
export function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
}

// True when the hand's total exceeds 21 — a bust. (handValue has already pushed
// aces down to 1 where possible, so anything still over 21 is a real bust.)
export function isBust(cards) {
    return handValue(cards).total > 21;
}

// The dealer's fixed strategy under the S17 house rule: keep hitting while below
// 17, then stand on all 17s (including soft 17).
export function dealerShouldHit(cards) {
    return handValue(cards).total < 17;
}

// Doubling down is allowed only on the opening two-card hand. (Whether the
// bankroll can cover the extra bet is the reducer's concern, not a rules one.)
export function canDouble(cards) {
    return cards.length === 2;
}

// A hand can be split when it's exactly two cards of equal value, so K+Q (both
// worth 10) qualify. The reducer separately enforces the max-hands cap.
export function canSplit(cards) {
    return (
        cards.length === 2 &&
        RANK_VALUES[cards[0].rank] === RANK_VALUES[cards[1].rank]
    );
}

// Settle one finished player hand against the dealer's final hand. Returns
// { outcome, multiplier }, where multiplier is profit per unit bet: +1.5 for a
// natural blackjack (3:2), +1 for a win, 0 for a push, -1 for a loss.
export function settle(playerCards, dealerCards) {
    // A player bust always loses, regardless of what the dealer does.
    if (isBust(playerCards)) {
        return { outcome: "lose", multiplier: -1 };
    }

    const playerNatural = isBlackjack(playerCards);
    const dealerNatural = isBlackjack(dealerCards);

    // Naturals settle before any drawing: 3:2, unless the dealer also has one.
    if (playerNatural || dealerNatural) {
        if (playerNatural && dealerNatural) {
            return { outcome: "push", multiplier: 0 };
        }
        if (playerNatural) {
            return { outcome: "blackjack", multiplier: 1.5 };
        }
        return { outcome: "lose", multiplier: -1 };
    }

    // A dealer bust pays any player who's still standing.
    if (isBust(dealerCards)) {
        return { outcome: "win", multiplier: 1 };
    }

    // Otherwise the higher total wins; equal totals push.
    const player = handValue(playerCards).total;
    const dealer = handValue(dealerCards).total;
    if (player > dealer) {
        return { outcome: "win", multiplier: 1 };
    }
    if (player < dealer) {
        return { outcome: "lose", multiplier: -1 };
    }
    return { outcome: "push", multiplier: 0 };
}
