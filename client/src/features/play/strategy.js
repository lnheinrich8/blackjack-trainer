// NPC decision-making for the seated bot players. Pure card logic: a basic-
// strategy table (the "by the book" play) plus two looser personalities. All
// randomness is injected as an `rng` (a () => number in [0,1)) so this module
// stays pure and deterministic under test — the component passes Math.random,
// the same way modes.js injects it for the trainer's dynamic difficulty.
//
// House rules match engine.js: dealer stands on soft 17 (S17), double on any two
// cards, double-after-split allowed (DAS). decide() returns one of
// "hit" | "stand" | "double" | "split"; the game loop enforces legality (a
// "double"/"split" it can't honor falls back to a plain hit/stand).

import { handValue, canSplit } from "./engine";

// The three seat personalities, assigned at random when a bot sits down.
export const PLAYER_TYPES = ["book", "loose", "erratic"];

// How often the "loose" player ignores the book and guesses (a little randomness).
const LOOSE_DEVIATION = 0.15;

// A single card's blackjack value (ace = 11), reusing the engine's math.
const cardValue = (card) => handValue([card]).total;

// "double" only makes sense on a fresh two-card hand; otherwise fall back.
const dbl = (twoCards, fallback) => (twoCards ? "double" : fallback);

// Whether a matched pair of single-card value `p` should be split vs dealer
// up-card `up` (2–11, ace = 11), under S17 + DAS.
function pairShouldSplit(p, up) {
    switch (p) {
        case 11: // A,A
        case 8: // 8,8
            return true;
        case 10: // never split tens
        case 5: // play 5,5 as a hard 10
            return false;
        case 9: // split vs 2-6, 8, 9 — stand vs 7, 10, A
            return (up >= 2 && up <= 6) || up === 8 || up === 9;
        case 7:
        case 3:
        case 2:
            return up >= 2 && up <= 7;
        case 6:
            return up >= 2 && up <= 6;
        case 4:
            return up === 5 || up === 6;
        default:
            return false;
    }
}

// Basic strategy for a soft total (an ace still counted as 11).
function softAction(total, up, twoCards) {
    if (total >= 19) return "stand"; // soft 19/20
    if (total === 18) {
        if (up >= 2 && up <= 6) return dbl(twoCards, "stand");
        if (up === 7 || up === 8) return "stand";
        return "hit"; // vs 9, 10, A
    }
    if (total === 17) return up >= 3 && up <= 6 ? dbl(twoCards, "hit") : "hit";
    if (total === 16 || total === 15) {
        return up >= 4 && up <= 6 ? dbl(twoCards, "hit") : "hit";
    }
    if (total === 14 || total === 13) {
        return up >= 5 && up <= 6 ? dbl(twoCards, "hit") : "hit";
    }
    return "hit";
}

// Basic strategy for a hard total.
function hardAction(total, up, twoCards) {
    if (total >= 17) return "stand";
    if (total >= 13) return up >= 2 && up <= 6 ? "stand" : "hit"; // 13-16
    if (total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
    if (total === 11) return up === 11 ? "hit" : dbl(twoCards, "hit"); // double 2-10
    if (total === 10) return up >= 2 && up <= 9 ? dbl(twoCards, "hit") : "hit";
    if (total === 9) return up >= 3 && up <= 6 ? dbl(twoCards, "hit") : "hit";
    return "hit"; // 8 or less
}

// The textbook play for a hand against the dealer's up-card — no randomness.
export function basicAction(hand, dealerUp) {
    const up = cardValue(dealerUp);
    const twoCards = hand.length === 2;

    // Splitting decisions apply only to a fresh, matched two-card pair. A pair we
    // don't split is then played as its ordinary hard/soft total below.
    if (twoCards && canSplit(hand) && pairShouldSplit(cardValue(hand[0]), up)) {
        return "split";
    }

    const { total, isSoft } = handValue(hand);
    return isSoft ? softAction(total, up, twoCards) : hardAction(total, up, twoCards);
}

// The "erratic" player: correct on the obvious spots (always hit a hard 11 or
// less, always stand a hard 17+ or soft 19+) but a coin-flip everywhere in the
// 12–16 "thinking" zone. Only ever hits or stands — no doubling or splitting.
function erraticAction(hand, dealerUp, rng) {
    const { total, isSoft } = handValue(hand);
    if (!isSoft && total <= 11) return "hit";
    if (!isSoft && total >= 17) return "stand";
    if (isSoft && total >= 19) return "stand";
    return rng() < 0.5 ? "hit" : "stand";
}

// Decide an NPC's action for the given personality. `rng` is injected.
export function decide(hand, dealerUp, type, rng) {
    if (type === "erratic") return erraticAction(hand, dealerUp, rng);

    const book = basicAction(hand, dealerUp);

    // The "loose" player mostly follows the book but occasionally just guesses
    // hit-or-stand instead.
    if (type === "loose" && rng() < LOOSE_DEVIATION) {
        return rng() < 0.5 ? "hit" : "stand";
    }
    return book;
}
