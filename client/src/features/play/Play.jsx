import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { getShoe } from "../../api/client";
import { useLocalStorage } from "../shared/hooks/useLocalStorage";
import { readShoe, writeShoe, clearShoe } from "../shared/utils/shoeCache";
import {
    reducer,
    init,
    doubleReason,
    splitReason,
    needsReshuffle,
    isUserTurn,
    seatLayout,
    MAX_HANDS,
    STARTING_BANKROLL,
} from "./state";
import { decide, PLAYER_TYPES } from "./strategy";
import { canSplit } from "./engine";
import {
    PRESETS,
    DEFAULT_DIFFICULTY,
    labelFor,
    statusDetails,
    isTestingMode,
    behaviorsFor,
} from "./playModes";
import PlayTable from "./components/PlayTable";
import BetControls from "./components/BetControls";
import RoundResult from "./components/RoundResult";
import PlayConfigModal from "./components/PlayConfigModal";
import DrillStatus from "../shared/components/DrillStatus";
import { CHIP_DEFS } from "./chips";

// Number-row / numpad hotkeys → chip value (1=$5, 2=$25, 3=$100, 4=$500,
// 5=$1000). Keyed by e.code so it's layout-independent and unaffected by Shift
// (which we read separately to remove a chip instead of add). A is the all-in
// key (Shift+A clears the bet).
const CHIP_KEYS = {};
CHIP_DEFS.forEach((chip, i) => {
    CHIP_KEYS[`Digit${i + 1}`] = chip.value;
    CHIP_KEYS[`Numpad${i + 1}`] = chip.value;
});

const DEAL_MS = 450; // pause between cards of the opening deal
const DEALER_MS = 700; // pause between the dealer's draws
const NPC_MS = 600; // pause between a bot's decisions
const REBUY = 1000; // chips handed out when you bust your bankroll
const MIN_CHIP = 5; // smallest chip; below this with no bet you must re-buy

// Flat bets the bots place — purely cosmetic (they don't touch your bankroll).
const NPC_BETS = [25, 50, 75, 100, 150, 200];

// Dynamic-seating tuning: bots a dynamic table starts with, the cap, and how
// often (per round) the table changes — when it does, one bot joins or leaves.
const DYNAMIC_START_BOTS = 3; // a 4-seat table to begin
const MAX_BOTS = 4; // 5 seats including the user (2 left + 2 right)
const DYNAMIC_CHANGE_PROB = 0.5; // ~every other hand a player comes or goes

// The starting difficulty/config, used until the player picks something else.
const DEFAULT_SAVED = {
    difficultyId: DEFAULT_DIFFICULTY,
    config: PRESETS[DEFAULT_DIFFICULTY],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Hi-Lo card values for the Testing-mode running count (2-6:+1, 7-9:0, 10-A:-1).
const HILO = {
    TWO: 1, THREE: 1, FOUR: 1, FIVE: 1, SIX: 1,
    SEVEN: 0, EIGHT: 0, NINE: 0,
    TEN: -1, JACK: -1, QUEEN: -1, KING: -1, ACE: -1,
};

// The running count of every face-up card seen so far this shoe — i.e. all dealt
// cards minus the dealer's hole card while it's still hidden.
function runningCount(shoe, pos, dealer, holeHidden) {
    let count = 0;
    for (let i = 0; i < pos; i++) count += HILO[shoe[i].rank];
    if (holeHidden && dealer.length >= 2) count -= HILO[dealer[1].rank];
    return count;
}

// Build the round's seats from an ordered list of bot personalities: the user
// sits dead-center (see seatLayout) with the bots fanned out left and right.
// Each bot re-rolls a flat cosmetic bet. Returns { players, userIndex } for DEAL.
function buildSeats(botTypes, userBet) {
    const { left, userIndex } = seatLayout(botTypes.length + 1);
    const specs = botTypes.map((type) => ({
        kind: "npc",
        type,
        bet: pick(NPC_BETS),
    }));
    specs.splice(left, 0, { kind: "user", type: null, bet: userBet });

    const players = specs.map((s, i) => ({
        id: `seat-${i}`,
        kind: s.kind,
        type: s.type,
        hands: [{ cards: [], bet: s.bet, status: "playing", outcome: null }],
    }));
    return { players, userIndex };
}

// The bots a Dynamic table opens with — a fresh roster of random personalities.
function seedRoster() {
    return Array.from({ length: DYNAMIC_START_BOTS }, () => pick(PLAYER_TYPES));
}

// Drift a Dynamic roster by one between hands: ~half the time a single bot joins
// (up to the cap) or leaves. Returns the next roster (the input is left untouched).
function driftRoster(roster) {
    const next = [...roster];
    if (Math.random() < DYNAMIC_CHANGE_PROB) {
        const leaving = Math.random() < 0.5;
        if (leaving && next.length > 0) {
            next.splice(Math.floor(Math.random() * next.length), 1);
        } else if (next.length < MAX_BOTS) {
            next.push(pick(PLAYER_TYPES));
        }
    }
    return next;
}

// The Play page: real blackjack against the dealer, dealt from a server-provided
// predetermined shoe. The reducer (state.js) holds the game; this component owns
// the side effects — fetching shoes, persisting the bankroll, and ticking the
// deal/dealer animations on timers (same approach as the trainer's TableDrill).
function Play({ onRecordBet }) {
    const [savedBankroll, setSavedBankroll] = useLocalStorage(
        "bjack.play.bankroll",
        STARTING_BANKROLL,
    );
    const [savedConfig, setSavedConfig] = useLocalStorage(
        "bjack.play.config",
        DEFAULT_SAVED,
    );
    const decks = savedConfig.config.decks;
    const [state, dispatch] = useReducer(reducer, savedBankroll, (bankroll) => {
        // Resume the in-progress shoe if it's still ours. Starting a Train drill
        // claims the shared cache as "train", which makes this restore a no-op.
        const restored = readShoe("play");
        return init({
            bankroll,
            shoe: restored ? restored.sequence : [],
            pos: restored ? restored.pos : 0,
        });
    });

    // Persist the bankroll whenever it changes so progress survives a reload.
    useEffect(() => {
        setSavedBankroll(state.bankroll);
    }, [state.bankroll, setSavedBankroll]);

    // Persist the live shoe to the cache shared with the Train page, tagged as
    // ours, so navigating away and back keeps the same cards and position.
    useEffect(() => {
        if (state.shoe.length === 0) return;
        writeShoe("play", state.shoe, state.pos);
    }, [state.shoe, state.pos]);

    // The shoe starts empty and is fetched lazily when the player starts their
    // first hand (see the Spacebar handler) — mirroring the Train page, which only
    // loads a shoe once the drill begins. After that the cut-card effect below
    // keeps it topped up.

    // Reshuffle between rounds once the shoe passes the cut card. Fetching resets
    // pos to 0, so needsReshuffle goes false and this won't loop.
    useEffect(() => {
        if (state.phase !== "betting") return;
        if (!needsReshuffle(state)) return;
        let cancelled = false;
        (async () => {
            const data = await getShoe(decks);
            if (!cancelled) dispatch({ type: "RESHUFFLE", shoe: data.sequence });
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.phase, state.pos, state.shoe.length]);

    // Deal the opening cards one at a time.
    useEffect(() => {
        if (state.phase !== "dealing") return;
        const id = setTimeout(() => dispatch({ type: "DEAL_CARD" }), DEAL_MS);
        return () => clearTimeout(id);
    }, [state.phase, state.dealStep]);

    // Draw the dealer's cards one at a time during their turn.
    useEffect(() => {
        if (state.phase !== "dealerTurn") return;
        const id = setTimeout(() => dispatch({ type: "DEALER_CARD" }), DEALER_MS);
        return () => clearTimeout(id);
    }, [state.phase, state.dealer.length]);

    // Auto-play the bots: when the active seat is a bot, wait a beat then dispatch
    // its decision. Personality + dealer up-card drive decide(); an illegal
    // "double"/"split" falls back to a hit so play always progresses. state.pos is
    // in the deps so a bot that hits and keeps going re-triggers the next step.
    useEffect(() => {
        if (state.phase !== "playerTurn") return;
        if (state.active.p === state.userIndex) return; // user's turn — wait for keys
        const seat = state.players[state.active.p];
        const hand = seat.hands[state.active.h];
        if (!hand || hand.status !== "playing") return;
        const id = setTimeout(() => {
            let action = decide(hand.cards, state.dealer[0], seat.type, Math.random);
            if (action === "double" && hand.cards.length !== 2) action = "hit";
            if (
                action === "split" &&
                (!canSplit(hand.cards) || seat.hands.length >= MAX_HANDS)
            ) {
                action = "hit";
            }
            dispatch({ type: action.toUpperCase() });
        }, NPC_MS);
        return () => clearTimeout(id);
    }, [
        state.phase,
        state.active,
        state.pos,
        state.players,
        state.dealer,
        state.userIndex,
    ]);

    const shoeLoading = state.shoe.length === 0;
    const dealDisabled = shoeLoading || needsReshuffle(state);
    const broke = state.bankroll < MIN_CHIP && state.bet === 0;

    // Bumped each time the player tries to deal with no chips down, to flash the
    // "Add chips" hint.
    const [nudge, setNudge] = useState(0);

    // A transient message ({ text, id }) shown when the player tries an illegal
    // double/split, explaining why. The id retriggers its fade each press.
    const [blocker, setBlocker] = useState(null);

    const [modalOpen, setModalOpen] = useState(false);

    // The persistent bot roster for Dynamic mode (null until the first dynamic
    // deal seeds it). In state so the betting-phase seat preview reflects it.
    const [roster, setRoster] = useState(null);

    // The true count a Testing-mode bet was placed at, stashed when the deal
    // starts and recorded once the round settles. Null when not in Testing mode
    // (so that round isn't tracked) or once it's been recorded. A ref, not state,
    // since only effects/callbacks touch it and it shouldn't trigger renders.
    const pendingTcRef = useRef(null);

    // Whether a candidate config actually changes the game from the current one
    // (Dynamic always differs; otherwise compare the concrete values).
    const configDiffers = (next) => {
        const nextDyn = next.difficultyId === "dynamic";
        const curDyn = savedConfig.difficultyId === "dynamic";
        if (nextDyn !== curDyn) return true;
        const a = next.config;
        const b = savedConfig.config;
        return a.decks !== b.decks || a.numPlayers !== b.numPlayers;
    };

    // Persist the new settings; if they actually differ, drop the current shoe and
    // start a fresh betting round so the next hand uses the new deck/seat config.
    const applyConfig = (next) => {
        setSavedConfig(next);
        if (configDiffers(next)) {
            clearShoe();
            setRoster(null); // re-seed dynamic seating under the new config
            dispatch({ type: "CONFIGURE" });
        }
    };

    // Picking a preset fills in its values; editing a value flips to Custom —
    // except while in a Testing mode, which flips to "testing-custom" so the
    // running count keeps showing.
    const selectDifficulty = (id) =>
        applyConfig({ difficultyId: id, config: PRESETS[id] });
    const changeConfig = (config) =>
        applyConfig({
            difficultyId: isTestingMode(savedConfig.difficultyId)
                ? "testing-custom"
                : "custom",
            config,
        });

    // Clicking the "Testing custom" badge drops to a plain Custom (same values,
    // just no running count) without resetting the shoe.
    const exitTesting = () =>
        applyConfig({ difficultyId: "custom", config: savedConfig.config });

    // Build the seats and start the deal (used for the first hand and after each).
    // Static difficulties use a fixed bot count; Dynamic seats its persistent bot
    // roster, which is seeded on the first deal and then drifts on the way back to
    // betting (see the settle handler) so joins/leaves show before the deal. The
    // user is always seated; the roster resets on a config change (see applyConfig).
    const startDeal = useCallback(() => {
        let botTypes;
        if (savedConfig.difficultyId === "dynamic") {
            // The roster already reflects this round's seats: it's seeded on the
            // first deal and drifts when the player returns to betting after each
            // hand, so the join/leave is visible before the cards come out.
            botTypes = roster ?? seedRoster();
            setRoster(botTypes);
        } else {
            // Static difficulties seat exactly the personalities the user chose in
            // the config modal (one per other player).
            botTypes = behaviorsFor(savedConfig.config);
        }
        // In Testing mode, stash the true count this bet is being placed at (the
        // count of everything seen so far, before this round is dealt) so the
        // round can be folded into the bet-strategy stats once it settles.
        if (isTestingMode(savedConfig.difficultyId)) {
            const rc = runningCount(
                state.shoe,
                state.pos,
                state.dealer,
                state.dealerHoleHidden,
            );
            pendingTcRef.current = decks > 0 ? rc / decks : 0;
        } else {
            pendingTcRef.current = null;
        }

        const { players, userIndex } = buildSeats(botTypes, state.bet);
        dispatch({ type: "DEAL", players, userIndex });
    }, [
        savedConfig.difficultyId,
        savedConfig.config,
        state.bet,
        state.shoe,
        state.pos,
        state.dealer,
        state.dealerHoleHidden,
        decks,
        roster,
    ]);

    // Once a Testing-mode round settles, record the bet, the count it was placed
    // at, and the round's net result, then clear the pending count so we record
    // each round exactly once.
    useEffect(() => {
        if (state.phase !== "settle" || pendingTcRef.current === null) return;
        onRecordBet({
            tc: pendingTcRef.current,
            bet: state.lastBet,
            net: state.lastNet,
            decks,
        });
        pendingTcRef.current = null;
    }, [state.phase, state.lastBet, state.lastNet, onRecordBet, decks]);

    // Keyboard controls. Spacebar deals / advances; during betting 1-5 add a chip
    // (Shift+1-5 removes one); during the player's turn Z=hit, X=stand, C=double,
    // V=split. Trying to double/split when it isn't allowed shows a 3s explanation.
    useEffect(() => {
        const onKey = (e) => {
            if (modalOpen) return; // the settings modal owns its own interactions
            const tag = e.target.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            if (e.key === " ") {
                if (state.phase === "betting") {
                    e.preventDefault(); // stop the page from scrolling on space
                    if (state.bet === 0) {
                        setNudge((n) => n + 1);
                    } else if (shoeLoading) {
                        // First hand: fetch the shoe, then deal once it's loaded.
                        (async () => {
                            const data = await getShoe(decks);
                            dispatch({ type: "RESHUFFLE", shoe: data.sequence });
                            startDeal();
                        })();
                    } else if (!dealDisabled) {
                        startDeal();
                    }
                } else if (state.phase === "settle") {
                    e.preventDefault();
                    // Returning to betting: drift the Dynamic roster now so any bot
                    // join/leave shows up while the player places their next bet,
                    // not when the deal starts.
                    if (savedConfig.difficultyId === "dynamic") {
                        setRoster((r) => (r === null ? r : driftRoster(r)));
                    }
                    dispatch({ type: "NEXT_ROUND" });
                }
                return;
            }

            // R reshuffles the shoe during betting — bankroll and bet are untouched.
            if ((e.key === "r" || e.key === "R") && state.phase === "betting") {
                e.preventDefault();
                (async () => {
                    const data = await getShoe(decks);
                    dispatch({ type: "RESHUFFLE", shoe: data.sequence });
                })();
                return;
            }

            // Chip hotkeys (betting only): 1-5 add a chip, Shift+1-5 remove one;
            // A bets the whole bankroll (all in), Shift+A clears the table.
            if (state.phase === "betting") {
                const value = CHIP_KEYS[e.code];
                if (value) {
                    e.preventDefault();
                    dispatch(
                        e.shiftKey
                            ? { type: "REMOVE_CHIP", value }
                            : { type: "ADD_CHIP", value },
                    );
                } else if (e.code === "KeyA") {
                    e.preventDefault();
                    dispatch(e.shiftKey ? { type: "CLEAR_BET" } : { type: "ALL_IN" });
                }
                return;
            }

            // Action keys only while it's actually the user's turn (bots auto-play).
            if (!isUserTurn(state)) return;
            const flash = (text) =>
                setBlocker((prev) => ({ text, id: (prev?.id ?? 0) + 1 }));
            switch (e.key.toLowerCase()) {
                case "z":
                    e.preventDefault();
                    dispatch({ type: "HIT" });
                    break;
                case "x":
                    e.preventDefault();
                    dispatch({ type: "STAND" });
                    break;
                case "c": {
                    e.preventDefault();
                    const reason = doubleReason(state);
                    if (reason) flash(reason);
                    else dispatch({ type: "DOUBLE" });
                    break;
                }
                case "v": {
                    e.preventDefault();
                    const reason = splitReason(state);
                    if (reason) flash(reason);
                    else dispatch({ type: "SPLIT" });
                    break;
                }
                default:
                    break;
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [
        state,
        dealDisabled,
        shoeLoading,
        modalOpen,
        decks,
        startDeal,
        savedConfig.difficultyId,
    ]);

    // Clear the blocker message 3 seconds after it (re)appears.
    useEffect(() => {
        if (!blocker) return;
        const id = setTimeout(() => setBlocker(null), 3000);
        return () => clearTimeout(id);
    }, [blocker]);

    // How many bot seats to preview during betting. Static difficulties use the
    // configured count; Dynamic uses its current roster (the seats from the last
    // hand, or the seed before the first deal). Driven by config, so it only
    // changes when settings change — not on reshuffle or between hands.
    const previewBots =
        savedConfig.difficultyId === "dynamic"
            ? roster?.length ?? DYNAMIC_START_BOTS
            : Math.max(0, savedConfig.config.numPlayers - 1);

    // The bankroll-hover detail lines. Testing mode also reveals the live running
    // count (handy for checking your own count) — no other mode shows it.
    const statusLines = [
        labelFor(savedConfig.difficultyId),
        ...statusDetails(savedConfig.difficultyId, savedConfig.config),
    ];
    if (isTestingMode(savedConfig.difficultyId)) {
        const rc = runningCount(
            state.shoe,
            state.pos,
            state.dealer,
            state.dealerHoleHidden,
        );
        // True count = running count per deck (to 2 decimals), matching the app's
        // RC / total-decks convention.
        const decks = savedConfig.config.decks;
        const tc = decks > 0 ? rc / decks : 0;
        const rcStr = `${rc > 0 ? "+" : ""}${rc}`;
        const tcStr = `${tc > 0 ? "+" : ""}${tc.toFixed(2)}`;
        statusLines.push(`RC: ${rcStr}, TC: ${tcStr}`);
    }

    return (
        <section className="play">
            <div className="trainer__bar">
                <div className="trainer__controls">
                    <button
                        className="trainer__configure"
                        onClick={() => setModalOpen(true)}
                        aria-label="Settings"
                    >
                        ⚙
                    </button>
                </div>
                <DrillStatus
                    toggleClassName="play__bankroll"
                    label={
                        <>
                            Bankroll <strong>${state.bankroll}</strong>
                        </>
                    }
                    details={statusLines}
                />
            </div>

            <div className="trainer__spacer trainer__spacer--top" aria-hidden="true" />

            <div className="tabledrill">
                <div className="tabledrill__stage">
                    <PlayTable
                        dealer={state.dealer}
                        dealerHoleHidden={state.dealerHoleHidden}
                        players={state.players}
                        userIndex={state.userIndex}
                        active={state.active}
                        phase={state.phase}
                        previewBots={previewBots}
                        cardsRemaining={state.shoe.length - state.pos}
                        shoeSize={state.shoe.length}
                    />
                </div>

                <div className="tabledrill__belt">
                    {state.phase === "betting" &&
                        (broke ? (
                            <div className="bet">
                                <p className="belt__msg">You're out of chips.</p>
                                <button
                                    className="btn btn--primary"
                                    onClick={() => dispatch({ type: "REBUY", amount: REBUY })}
                                >
                                    Buy in for ${REBUY}
                                </button>
                            </div>
                        ) : (
                            <BetControls
                                bet={state.bet}
                                bankroll={state.bankroll}
                                betChips={state.betChips}
                                onAddChip={(value) => dispatch({ type: "ADD_CHIP", value })}
                                onRemoveChip={(value) =>
                                    dispatch({ type: "REMOVE_CHIP", value })
                                }
                                nudge={nudge}
                            />
                        ))}

                    {state.phase === "dealing" && (
                        <p className="belt__msg belt__msg--hint">Dealing…</p>
                    )}

                    {state.phase === "playerTurn" &&
                        (isUserTurn(state) ? (
                            <div className="actions-hint">
                                <p className="belt__keys">
                                    <strong>Z</strong> Hit · <strong>X</strong> Stand ·{" "}
                                    <strong>C</strong> Double · <strong>V</strong> Split
                                </p>
                                {blocker && (
                                    <p key={blocker.id} className="actions-block">
                                        {blocker.text}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="belt__msg belt__msg--hint">Players acting…</p>
                        ))}

                    {state.phase === "dealerTurn" && (
                        <p className="belt__msg belt__msg--hint">Dealer plays…</p>
                    )}

                    {state.phase === "settle" && <RoundResult net={state.lastNet} />}
                </div>
            </div>

            <div
                className="trainer__spacer trainer__spacer--bottom"
                aria-hidden="true"
            />

            {modalOpen && (
                <PlayConfigModal
                    difficultyId={savedConfig.difficultyId}
                    config={savedConfig.config}
                    onSelectDifficulty={selectDifficulty}
                    onChangeConfig={changeConfig}
                    onExitTesting={exitTesting}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </section>
    );
}

export default Play;
