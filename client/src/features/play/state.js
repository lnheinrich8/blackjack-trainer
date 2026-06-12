// The blackjack game state machine — a pure reducer plus a few selectors. It
// drives one round at a time through these phases:
//
//   betting → dealing → playerTurn → dealerTurn → settle → (NEXT_ROUND) betting
//
// The table is multi-seat: the human ("user") plus zero or more bot seats
// ("npc"). All seats are dealt and played; the bots' decisions are computed in
// the component (Play.jsx) and dispatched as the same HIT/STAND/DOUBLE/SPLIT
// actions the user uses, so the reducer never branches on who's acting except to
// keep the bankroll tied to the user's hands only. The component owns the timing
// (DEAL_CARD / NPC turns / DEALER_CARD on timers). Rules math lives in engine.js;
// this file sequences the game and moves chips. Cards are consumed in order from
// a predetermined shoe (fetched whole).

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

// Where the seats sit relative to the centered user. The user is the middle
// seat; the bots flank it, split as evenly as possible with the odd one on the
// left. Returns { left, right, userIndex } where userIndex is the user's index
// in the left-to-right players array. Keeping the user dead-center means a
// changing bot count (dynamic mode) never slides the user's hand sideways.
export function seatLayout(numPlayers) {
    const npcs = Math.max(0, numPlayers - 1);
    const right = Math.floor(npcs / 2);
    const left = npcs - right;
    return { left, right, userIndex: left };
}

// --- state shape ---
// {
//   phase, shoe, pos, bankroll, bet, betChips, lastBet,
//   players: [{ id, kind: 'user'|'npc', type, hands: [{ cards, bet, status, outcome, payout }] }],
//   userIndex,         // index of the user's seat in players
//   active: { p, h },  // seat index + hand index currently being played
//   dealer,            // dealer's cards (hole = dealer[1])
//   dealStep,          // how many opening cards have been dealt
//   dealerHoleHidden,  // render dealer[1] face-down until the dealer's turn
//   lastNet,           // net chips from the user's last settled round (for the banner)
// }
// Hand status: playing | stood | bust | doubled | blackjack.

export function init({ bankroll = STARTING_BANKROLL, shoe = [], pos = 0 } = {}) {
    return {
        phase: "betting",
        shoe,
        pos,
        bankroll,
        bet: 0,
        betChips: [], // chip values placed for the current bet, for the table display
        lastBet: 0,
        players: [],
        userIndex: 0,
        active: { p: 0, h: 0 },
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

// Is it the human's turn to act? (The bots play themselves on a timer.)
export function isUserTurn(state) {
    return state.phase === "playerTurn" && state.active.p === state.userIndex;
}

// The hand the user is currently playing, or null.
function userActiveHand(state) {
    if (!isUserTurn(state)) return null;
    return state.players[state.active.p].hands[state.active.h];
}

// Why the active hand can't double right now — a short reason, or null if it can.
export function doubleReason(state) {
    const hand = userActiveHand(state);
    if (!hand) return null;
    if (hand.cards.length !== 2) {
        return "You can only double on your opening two cards.";
    }
    if (state.bankroll < hand.bet) return "Not enough chips to double.";
    return null;
}

// Why the active hand can't split right now — a short reason, or null if it can.
export function splitReason(state) {
    const hand = userActiveHand(state);
    if (!hand) return null;
    if (hand.cards.length !== 2) {
        return "You can only split your opening two cards.";
    }
    if (!canSplit(hand.cards)) return "You can only split a matching pair.";
    if (state.players[state.active.p].hands.length >= MAX_HANDS) {
        return `You can't have more than ${MAX_HANDS} hands.`;
    }
    if (state.bankroll < hand.bet) return "Not enough chips to split.";
    return null;
}

// --- pure helpers ---

// Replace one hand within one seat, returning a new players array.
function setHand(players, p, h, hand) {
    return players.map((seat, i) =>
        i !== p
            ? seat
            : { ...seat, hands: seat.hands.map((hh, j) => (j === h ? hand : hh)) },
    );
}

// Replace a seat's whole hands array (used by split).
function setSeatHands(players, p, hands) {
    return players.map((seat, i) => (i === p ? { ...seat, hands } : seat));
}

// Finishing-status for a hand that has just received a card. A split-ace hand
// gets exactly one card and then stands; any 21 auto-stands; a bust busts.
function statusAfterCard(cards, { aceSplit = false } = {}) {
    if (isBust(cards)) return "bust";
    if (aceSplit) return "stood";
    if (handValue(cards).total === 21) return "stood";
    return "playing";
}

// Settle every seat's hands against the dealer's final hand. Each hand's stake
// was already deducted at commit time, so a user hand returns stake + profit:
// bet * (1 + multiplier). Only the user's hands move the bankroll; bot results
// are recorded (outcome/payout) for display but are otherwise cosmetic.
function settleAll(state) {
    let bankroll = state.bankroll;
    let lastNet = 0;
    const players = state.players.map((seat, p) => {
        const isUser = p === state.userIndex;
        const hands = seat.hands.map((hand) => {
            const { outcome, multiplier } = settle(hand.cards, state.dealer);
            if (isUser) {
                bankroll += hand.bet * (1 + multiplier);
                lastNet += hand.bet * multiplier;
            }
            return { ...hand, outcome, payout: hand.bet * multiplier };
        });
        return { ...seat, hands };
    });
    return {
        ...state,
        players,
        bankroll,
        phase: "settle",
        dealerHoleHidden: false,
        lastNet,
    };
}

// All player hands are resolved — reveal the hole card and hand off to the
// dealer. If every hand busted the dealer doesn't draw; if the dealer already
// stands we settle immediately. Otherwise begin the dealer's draw sequence.
function enterDealerPhase(state) {
    const revealed = { ...state, dealerHoleHidden: false };
    const anyLive = state.players.some((seat) =>
        seat.hands.some((h) => h.status !== "bust"),
    );
    if (!anyLive) return settleAll(revealed);
    if (dealerShouldHit(state.dealer)) {
        return { ...revealed, phase: "dealerTurn" };
    }
    return settleAll(revealed);
}

// Find the first hand that still needs to be played, scanning seats left-to-right
// then hands within a seat. Used right after the opening deal.
function enterPlay(state) {
    for (let p = 0; p < state.players.length; p++) {
        const seat = state.players[p];
        for (let h = 0; h < seat.hands.length; h++) {
            if (seat.hands[h].status === "playing") {
                return { ...state, phase: "playerTurn", active: { p, h } };
            }
        }
    }
    return enterDealerPhase(state);
}

// Move to the next hand needing a decision after the active one finishes. A
// freshly-split hand arrives holding a single card, so deal it its second card
// on activation (split aces then auto-stand). When no playing hands remain, the
// dealer plays.
function advance(state) {
    let { players, pos } = state;
    let p = state.active.p;
    let h = state.active.h + 1;

    while (p < players.length) {
        const seat = players[p];
        while (h < seat.hands.length) {
            let hand = seat.hands[h];
            if (hand.cards.length === 1) {
                const card = state.shoe[pos];
                pos += 1;
                const cards = [hand.cards[0], card];
                const aceSplit = hand.cards[0].rank === "ACE";
                hand = { ...hand, cards, status: statusAfterCard(cards, { aceSplit }) };
                players = setHand(players, p, h, hand);
            }
            if (hand.status === "playing") {
                return { ...state, players, pos, active: { p, h } };
            }
            h += 1;
        }
        p += 1;
        h = 0;
    }

    return enterDealerPhase({ ...state, players, pos });
}

// --- reducer ---

export function reducer(state, action) {
    switch (action.type) {
        // Load a fresh shoe (initial fetch and every reshuffle both use this).
        case "RESHUFFLE":
            return { ...state, shoe: action.shoe, pos: 0 };

        // Settings changed — start a fresh betting round with an empty shoe so the
        // next hand is dealt under the new deck/seat config. Bankroll is preserved.
        case "CONFIGURE":
            return init({ bankroll: state.bankroll });

        // ---- betting ----

        case "ADD_CHIP": {
            if (state.phase !== "betting") return state;
            const bet = state.bet + action.value;
            if (bet > state.bankroll) return state; // can't stake more than you have
            // Rebuild the chips from the new total so they auto-consolidate into the
            // fewest chips (e.g. five $5 -> one $25, two $500 -> one $1000). The
            // denominations are each a multiple of the previous, so the greedy
            // chipsFor() decomposition is the canonical, fully-merged set.
            return { ...state, bet, betChips: chipsFor(bet) };
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
            const bet = Math.floor(state.bankroll / SMALLEST_CHIP) * SMALLEST_CHIP;
            return { ...state, bet, betChips: chipsFor(bet) };
        }

        // Take every chip off the table.
        case "CLEAR_BET":
            if (state.phase !== "betting") return state;
            return { ...state, bet: 0, betChips: [] };

        case "REBUY":
            return { ...state, bankroll: state.bankroll + action.amount };

        // ---- start a round ----
        // The component builds the seats (with the bots' personalities and bets)
        // and passes them in, since seat creation uses randomness.

        case "DEAL": {
            if (state.phase !== "betting") return state;
            if (state.bet <= 0 || state.bet > state.bankroll) return state;
            return {
                ...state,
                phase: "dealing",
                bankroll: state.bankroll - state.bet,
                lastBet: state.bet,
                betChips: [], // chips move onto the hand; clear the betting spot
                players: action.players,
                userIndex: action.userIndex,
                dealer: [],
                active: { p: 0, h: 0 },
                dealStep: 0,
                dealerHoleHidden: true,
                lastNet: null,
            };
        }

        // One card of the opening deal, in seat order then dealer, twice. The
        // first round gives the dealer their up-card, the second the hole card.
        case "DEAL_CARD": {
            if (state.phase !== "dealing") return state;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const perRound = state.players.length + 1;
            const idx = state.dealStep % perRound;
            const toDealer = idx === state.players.length;

            let players = state.players;
            let dealer = state.dealer;
            if (toDealer) {
                dealer = [...state.dealer, card];
            } else {
                const hand0 = state.players[idx].hands[0];
                players = setHand(state.players, idx, 0, {
                    ...hand0,
                    cards: [...hand0.cards, card],
                });
            }
            const dealStep = state.dealStep + 1;
            const dealt = { ...state, pos, players, dealer, dealStep };

            if (dealStep < perRound * 2) return dealt;

            // Opening deal complete — mark every natural blackjack.
            const marked = players.map((seat) => ({
                ...seat,
                hands: seat.hands.map((h) =>
                    isBlackjack(h.cards) ? { ...h, status: "blackjack" } : h,
                ),
            }));
            // A dealer natural ends the round at once (everyone settles now).
            if (isBlackjack(dealer)) {
                return settleAll({ ...dealt, players: marked, dealerHoleHidden: false });
            }
            return enterPlay({ ...dealt, players: marked });
        }

        // ---- player / bot turns (same actions, applied to the active seat) ----

        case "HIT": {
            if (state.phase !== "playerTurn") return state;
            const { p, h } = state.active;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const hand = state.players[p].hands[h];
            const cards = [...hand.cards, card];
            const status = statusAfterCard(cards);
            const players = setHand(state.players, p, h, { ...hand, cards, status });
            const updated = { ...state, pos, players };
            return status === "playing" ? updated : advance(updated);
        }

        case "STAND": {
            if (state.phase !== "playerTurn") return state;
            const { p, h } = state.active;
            const hand = state.players[p].hands[h];
            const players = setHand(state.players, p, h, { ...hand, status: "stood" });
            return advance({ ...state, players });
        }

        case "DOUBLE": {
            if (state.phase !== "playerTurn") return state;
            const { p, h } = state.active;
            const isUser = p === state.userIndex;
            const hand = state.players[p].hands[h];
            if (!canDouble(hand.cards)) return state;
            if (isUser && state.bankroll < hand.bet) return state;
            const card = state.shoe[state.pos];
            const pos = state.pos + 1;
            const cards = [...hand.cards, card];
            const status = isBust(cards) ? "bust" : "doubled";
            const players = setHand(state.players, p, h, {
                ...hand,
                cards,
                bet: hand.bet * 2,
                status,
            });
            const bankroll = isUser ? state.bankroll - hand.bet : state.bankroll;
            return advance({ ...state, pos, players, bankroll });
        }

        case "SPLIT": {
            if (state.phase !== "playerTurn") return state;
            const { p, h } = state.active;
            const isUser = p === state.userIndex;
            const seat = state.players[p];
            const hand = seat.hands[h];
            if (!canSplit(hand.cards) || seat.hands.length >= MAX_HANDS) return state;
            if (isUser && state.bankroll < hand.bet) return state;

            const [first, second] = hand.cards;
            // The first split hand gets its second card now; the second keeps a lone
            // card until advance() activates and fills it.
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
            const hands = [...seat.hands];
            hands.splice(h, 1, firstHand, secondHand);
            const players = setSeatHands(state.players, p, hands);
            const bankroll = isUser ? state.bankroll - hand.bet : state.bankroll;
            const updated = { ...state, pos, players, bankroll };
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
            return dealerShouldHit(dealer) ? updated : settleAll(updated);
        }

        // ---- next round ----

        case "NEXT_ROUND": {
            // Fresh betting spot — the player re-stacks chips for the next hand.
            return {
                ...state,
                phase: "betting",
                bet: 0,
                betChips: [],
                players: [],
                userIndex: 0,
                active: { p: 0, h: 0 },
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
