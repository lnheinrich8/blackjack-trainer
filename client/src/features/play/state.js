// The blackjack game state machine — a pure reducer plus a few selectors. It
// drives one round at a time through these phases:
//
//   betting → dealing → playerTurn → dealerTurn → settle → (NEXT_ROUND) betting
//
// The component (Play.jsx) owns the timing: it dispatches DEAL_CARD / DEALER_CARD
// on timers so the deal and the dealer's draws animate one card at a time. All
// rules math lives in engine.js; this file only sequences the game and moves
// chips. Cards are consumed in order from a predetermined shoe (fetched whole).

import {
    handValue,
    isBlackjack,
    isBust,
    dealerShouldHit,
    canDouble,
    canSplit,
    settle,
} from "./engine";
import { CHIP_DEFS } from "./chips";

export const STARTING_BANKROLL = 1000;
export const MAX_HANDS = 4; // a hand can be split up to three times
const PENETRATION = 0.75; // reshuffle once this fraction of the shoe is spent

// Chip denominations, largest first, for greedy bet decomposition (all-in).
const DENOMS = [...CHIP_DEFS.map((c) => c.value)].sort((a, b) => b - a);
const SMALLEST_CHIP = Math.min(...DENOMS);

// Break an amount into a list of chip values, largest first (e.g. 1005 ->
// [500, 500, 5]). The amount should already be a multiple of the smallest chip.
function chipsFor(amount) {
    const chips = [];
    let remaining = amount;
    for (const d of DENOMS) {
        while (remaining >= d) {
            chips.push(d);
            remaining -= d;
        }
    }
    return chips;
}

// --- state shape ---
// {
//   phase, shoe, pos, bankroll, bet, lastBet,
//   hands: [{ cards, bet, status, outcome, payout }],  // status: playing|stood|bust|doubled|blackjack
//   active,            // index of the hand currently being played
//   dealer,            // dealer's cards (hole = dealer[1])
//   dealStep,          // how many of the 4 opening cards have been dealt
//   dealerHoleHidden,  // render dealer[1] face-down until the dealer's turn
//   lastNet,           // net chips from the last settled round (for the banner)
// }

export function init({ bankroll = STARTING_BANKROLL, shoe = [] } = {}) {
    return {
        phase: "betting",
        shoe,
        pos: 0,
        bankroll,
        bet: 0,
        betChips: [], // chip values placed for the current bet, for the table display
        lastBet: 0,
        hands: [],
        active: 0,
        dealer: [],
        dealStep: 0,
        dealerHoleHidden: true,
        lastNet: null,
    };
}

// --- selectors (used by the UI) ---

// Whether the shoe is past the cut card and should be reshuffled before the next
// round. The component checks this in the betting phase and dispatches RESHUFFLE.
export function needsReshuffle(state) {
    if (state.shoe.length === 0) return false;
    return state.pos >= PENETRATION * state.shoe.length;
}

// Why the active hand can't double right now — a short reason, or null if it can.
export function doubleReason(state) {
    if (state.phase !== "playerTurn") return null;
    const hand = state.hands[state.active];
    if (hand.cards.length !== 2) {
        return "You can only double on your opening two cards.";
    }
    if (state.bankroll < hand.bet) return "Not enough chips to double.";
    return null;
}

// Why the active hand can't split right now — a short reason, or null if it can.
export function splitReason(state) {
    if (state.phase !== "playerTurn") return null;
    const hand = state.hands[state.active];
    if (hand.cards.length !== 2) {
        return "You can only split your opening two cards.";
    }
    if (!canSplit(hand.cards)) return "You can only split a matching pair.";
    if (state.hands.length >= MAX_HANDS) {
        return `You can't have more than ${MAX_HANDS} hands.`;
    }
    if (state.bankroll < hand.bet) return "Not enough chips to split.";
    return null;
}

// --- pure helpers ---

function replaceHand(hands, index, hand) {
    return hands.map((h, i) => (i === index ? hand : h));
}

// Finishing-status for a hand that has just received a card. A split-ace hand
// gets exactly one card and then stands; any 21 auto-stands; a bust busts.
function statusAfterCard(cards, { aceSplit = false } = {}) {
    if (isBust(cards)) return "bust";
    if (aceSplit) return "stood";
    if (handValue(cards).total === 21) return "stood";
    return "playing";
}

// Pay out every hand against the dealer's final hand and move chips. Each hand's
// stake was already deducted at commit time, so we return stake + profit:
// bet * (1 + multiplier). lastNet (sum of per-hand profit) is the round's swing.
function enterSettle(state) {
    let bankroll = state.bankroll;
    const hands = state.hands.map((hand) => {
        const { outcome, multiplier } = settle(hand.cards, state.dealer);
        bankroll += hand.bet * (1 + multiplier);
        return { ...hand, outcome, payout: hand.bet * multiplier };
    });
    const lastNet = hands.reduce((sum, h) => sum + h.payout, 0);
    return {
        ...state,
        hands,
        bankroll,
        phase: "settle",
        dealerHoleHidden: false,
        lastNet,
    };
}

// All player hands are resolved — reveal the hole card and hand off to the
// dealer. If every hand busted the dealer doesn't draw; if the dealer is already
// standing we settle immediately. Otherwise begin the dealer's draw sequence.
function enterDealerPhase(state) {
    const revealed = { ...state, dealerHoleHidden: false };
    const anyLive = state.hands.some((h) => h.status !== "bust");
    if (!anyLive) return enterSettle(revealed);
    if (dealerShouldHit(state.dealer)) {
        return { ...revealed, phase: "dealerTurn" };
    }
    return enterSettle(revealed);
}

// Advance to the next hand that still needs decisions. A freshly-split hand
// arrives holding a single card, so deal it its second card on activation
// (split aces then auto-stand). When no playing hands remain, the dealer plays.
function advance(state) {
    let { hands, pos } = state;
    let next = state.active + 1;

    while (next < hands.length) {
        let hand = hands[next];
        if (hand.cards.length === 1) {
            const card = state.shoe[pos];
            pos += 1;
            const cards = [hand.cards[0], card];
            const aceSplit = hand.cards[0].rank === "ACE";
            hand = { ...hand, cards, status: statusAfterCard(cards, { aceSplit }) };
            hands = replaceHand(hands, next, hand);
        }
        if (hand.status === "playing") {
            return { ...state, hands, pos, active: next, phase: "playerTurn" };
        }
        next += 1;
    }

    return enterDealerPhase({ ...state, hands, pos });
}

// --- reducer ---

export function reducer(state, action) {
    switch (action.type) {
        // Load a fresh shoe (initial fetch and every reshuffle both use this).
        case "RESHUFFLE":
            return { ...state, shoe: action.shoe, pos: 0 };

        // ---- betting ----

        case "ADD_CHIP": {
            if (state.phase !== "betting") return state;
            const bet = state.bet + action.value;
            if (bet > state.bankroll) return state; // can't stake more than you have
            return { ...state, bet, betChips: [...state.betChips, action.value] };
        }

        // Clicking a stack on the table removes one chip of that value.
        case "REMOVE_CHIP": {
            if (state.phase !== "betting") return state;
            const idx = state.betChips.lastIndexOf(action.value);
            if (idx === -1) return state;
            const betChips = state.betChips.filter((_, i) => i !== idx);
            return { ...state, bet: state.bet - action.value, betChips };
        }

        // Bet the whole bankroll, rounded down to the nearest chip.
        case "ALL_IN": {
            if (state.phase !== "betting") return state;
            const bet =
                Math.floor(state.bankroll / SMALLEST_CHIP) * SMALLEST_CHIP;
            return { ...state, bet, betChips: chipsFor(bet) };
        }

        // Take every chip off the table.
        case "CLEAR_BET":
            if (state.phase !== "betting") return state;
            return { ...state, bet: 0, betChips: [] };

        case "REBUY":
            return { ...state, bankroll: state.bankroll + action.amount };

        // ---- start a round ----

        case "DEAL": {
            if (state.phase !== "betting") return state;
            if (state.bet <= 0 || state.bet > state.bankroll) return state;
            return {
                ...state,
                phase: "dealing",
                bankroll: state.bankroll - state.bet,
                lastBet: state.bet,
                betChips: [], // chips move onto the hand; clear the betting spot
                hands: [{ cards: [], bet: state.bet, status: "playing", outcome: null }],
                dealer: [],
                active: 0,
                dealStep: 0,
                dealerHoleHidden: true,
                lastNet: null,
            };
        }

        // One card of the opening deal: player, dealer-up, player, dealer-hole.
        case "DEAL_CARD": {
            if (state.phase !== "dealing") return state;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const toPlayer = state.dealStep === 0 || state.dealStep === 2;
            const hands = toPlayer
                ? replaceHand(state.hands, 0, {
                    ...state.hands[0],
                    cards: [...state.hands[0].cards, card],
                })
                : state.hands;
            const dealer = toPlayer ? state.dealer : [...state.dealer, card];
            const dealStep = state.dealStep + 1;
            const dealt = { ...state, pos, hands, dealer, dealStep };

            if (dealStep < 4) return dealt;

            // Opening deal complete — a natural on either side ends the round at once.
            const playerBJ = isBlackjack(hands[0].cards);
            const dealerBJ = isBlackjack(dealer);
            if (playerBJ || dealerBJ) {
                const marked = playerBJ
                    ? replaceHand(hands, 0, { ...hands[0], status: "blackjack" })
                    : hands;
                return enterSettle({ ...dealt, hands: marked, dealerHoleHidden: false });
            }
            return { ...dealt, phase: "playerTurn", active: 0 };
        }

        // ---- player turn ----

        case "HIT": {
            if (state.phase !== "playerTurn") return state;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const hand = state.hands[state.active];
            const cards = [...hand.cards, card];
            const status = statusAfterCard(cards);
            const hands = replaceHand(state.hands, state.active, {
                ...hand,
                cards,
                status,
            });
            const updated = { ...state, pos, hands };
            return status === "playing" ? updated : advance(updated);
        }

        case "STAND": {
            if (state.phase !== "playerTurn") return state;
            const hands = replaceHand(state.hands, state.active, {
                ...state.hands[state.active],
                status: "stood",
            });
            return advance({ ...state, hands });
        }

        case "DOUBLE": {
            if (state.phase !== "playerTurn") return state;
            const hand = state.hands[state.active];
            if (!canDouble(hand.cards) || state.bankroll < hand.bet) return state;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const cards = [...hand.cards, card];
            const status = isBust(cards) ? "bust" : "doubled";
            const hands = replaceHand(state.hands, state.active, {
                ...hand,
                cards,
                bet: hand.bet * 2,
                status,
            });
            return advance({ ...state, pos, bankroll: state.bankroll - hand.bet, hands });
        }

        case "SPLIT": {
            if (state.phase !== "playerTurn") return state;
            const hand = state.hands[state.active];
            if (
                !canSplit(hand.cards) ||
                state.hands.length >= MAX_HANDS ||
                state.bankroll < hand.bet
            ) {
                return state;
            }
            const [first, second] = hand.cards;
            // The first split hand gets its second card now; the second hand keeps a
            // lone card until advance() activates and fills it.
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const firstCards = [first, card];
            const aceSplit = first.rank === "ACE";
            const firstHand = {
                ...hand,
                cards: firstCards,
                status: statusAfterCard(firstCards, { aceSplit }),
            };
            const secondHand = {
                cards: [second],
                bet: hand.bet,
                status: "playing",
                outcome: null,
            };
            const hands = [...state.hands];
            hands.splice(state.active, 1, firstHand, secondHand);
            const updated = {
                ...state,
                pos,
                bankroll: state.bankroll - hand.bet,
                hands,
            };
            // Stay on the first split hand unless it auto-finished (e.g. split aces).
            return firstHand.status === "playing" ? updated : advance(updated);
        }

        // ---- dealer turn ----

        case "DEALER_CARD": {
            if (state.phase !== "dealerTurn") return state;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const dealer = [...state.dealer, card];
            const updated = { ...state, pos, dealer };
            return dealerShouldHit(dealer) ? updated : enterSettle(updated);
        }

        // ---- next round ----

        case "NEXT_ROUND": {
            // Fresh betting spot — the player re-stacks chips for the next hand.
            return {
                ...state,
                phase: "betting",
                bet: 0,
                betChips: [],
                hands: [],
                active: 0,
                dealer: [],
                dealStep: 0,
                dealerHoleHidden: true,
                lastNet: null,
            };
        }

        default:
            return state;
    }
}
