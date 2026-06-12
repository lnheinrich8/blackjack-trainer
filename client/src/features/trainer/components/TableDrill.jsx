import { useEffect, useReducer, useRef, useState } from "react";
import { startDrill, gradeGuess } from "../../../api/client";
import BlackjackTable from "../../shared/components/BlackjackTable";
import { writeShoe } from "../../shared/utils/shoeCache";
import CountPrompt from "./CountPrompt";
import FeedbackLine from "./FeedbackLine";

// Reshuffle once this fraction of the shoe has been dealt (cut-card penetration).
const PENETRATION = 0.75;

// --- pure helpers ---

function emptySeats(numPlayers) {
    return {
        players: Array.from({ length: numPlayers }, () => []),
        dealer: [],
    };
}

// The deal order for one hand: a card to each player right-to-left (the user is
// the rightmost seat, index numPlayers-1, so they're dealt first), then the
// dealer — twice, like a real blackjack deal.
function buildPlan(numPlayers) {
    const plan = [];
    for (let round = 0; round < 2; round++) {
        for (let i = numPlayers - 1; i >= 0; i--) plan.push({ type: "player", index: i });
        plan.push({ type: "dealer" });
    }
    return plan;
}

function placeCard(seats, target, card) {
    if (target.type === "dealer") {
        return { ...seats, dealer: [...seats.dealer, card] };
    }
    const players = seats.players.map((hand, i) =>
        i === target.index ? [...hand, card] : hand,
    );
    return { ...seats, players };
}

// Reshuffle when past the cut card OR too few cards remain for another full hand.
function needsReshuffle(pos, shoeLen, numPlayers) {
    const cardsPerHand = 2 * (numPlayers + 1);
    return pos >= PENETRATION * shoeLen || shoeLen - pos < cardsPerHand;
}

function describeChange(prev, next, correct) {
    if (next.revealMs < prev.revealMs) return "Speeding up ⏩";
    if (next.revealMs > prev.revealMs) return "Slowing down 🐢";
    return correct ? "Steady pace" : "Keep at it";
}

// --- reducer ---
// phases: loading | dealing | handbreak | asking | feedback | reshuffle

function init(controller) {
    const config = controller.initial();
    return {
        config,
        phase: "loading",
        shoe: [],
        pos: 0, // next card index in the current shoe = cards dealt this shoe
        seats: emptySeats(config.numPlayers),
        plan: [],
        step: 0, // next index into plan for the current hand
        active: null,
        handsDealt: 0, // hands since the last prompt
        result: null,
        feedback: null,
    };
}

function startHand(state, config = state.config) {
    return {
        ...state,
        config,
        seats: emptySeats(config.numPlayers),
        plan: buildPlan(config.numPlayers),
        step: 0,
        active: null,
        phase: "dealing",
    };
}

function reducer(state, action) {
    switch (action.type) {
        case "SHOE_LOADED":
            return startHand({ ...state, shoe: action.shoe, pos: 0 });

        case "TICK": {
            const target = state.plan[state.step];
            const card = state.shoe[state.pos];
            const seats = placeCard(state.seats, target, card);
            const pos = state.pos + 1;
            const step = state.step + 1;

            if (step < state.plan.length) {
                return { ...state, seats, pos, step, active: target };
            }

            // Hand complete. Ask if we've hit the quota OR we're about to reshuffle
            // (so the user always reports a count before the shoe resets).
            const handsDealt = state.handsDealt + 1;
            const ask =
                handsDealt >= state.config.handsUntilAsked ||
                needsReshuffle(pos, state.shoe.length, state.config.numPlayers);

            return {
                ...state,
                seats,
                pos,
                step,
                active: target,
                handsDealt,
                phase: ask ? "asking" : "handbreak",
            };
        }

        case "NEXT_HAND":
            return startHand(state);

        case "GRADED":
            return {
                ...state,
                phase: "feedback",
                result: action.result,
                config: action.nextConfig,
                feedback: action.feedback,
            };

        case "CONTINUE": {
            const cleared = { ...state, result: null, feedback: null, handsDealt: 0 };
            if (needsReshuffle(state.pos, state.shoe.length, state.config.numPlayers)) {
                return { ...cleared, phase: "reshuffle" };
            }
            return startHand(cleared);
        }

        case "RESHUFFLE_DONE":
            return startHand(
                { ...state, shoe: action.shoe, pos: 0, handsDealt: 0 },
                action.nextConfig,
            );

        default:
            return state;
    }
}

// --- component ---

function TableDrill({ controller, onConfigChange, onResult }) {
    const controllerRef = useRef(controller);
    const [state, dispatch] = useReducer(reducer, controller, init);
    const [busy, setBusy] = useState(false);

    // Report the live config up so Trainer's top-right status reflects the running
    // drill (including Dynamic's changing decks/speed/players and the streak).
    useEffect(() => {
        onConfigChange?.(state.config);
    }, [state.config, onConfigChange]);

    // Claim the shared shoe cache for the trainer whenever a shoe loads or
    // reshuffles. TableDrill only mounts once a drill has started, so this is the
    // "started Train" signal that invalidates the Play page's saved shoe.
    useEffect(() => {
        if (state.shoe.length === 0) return;
        writeShoe("train", state.shoe, state.pos);
    }, [state.shoe, state.pos]);

    // Initial shoe — fetch the whole shoe for the starting deck count.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const decks = state.config.decks;
            const data = await startDrill({ numDecks: decks, numCards: 52 * decks });
            if (!cancelled) dispatch({ type: "SHOE_LOADED", shoe: data.sequence });
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Deal one card per tick while in the dealing phase.
    useEffect(() => {
        if (state.phase !== "dealing") return;
        if (state.pos >= state.shoe.length) return;
        const id = setTimeout(() => dispatch({ type: "TICK" }), state.config.revealMs);
        return () => clearTimeout(id);
    }, [state.phase, state.step, state.pos, state.shoe.length, state.config.revealMs]);

    // Brief pause between hands so the completed hand is visible before clearing.
    useEffect(() => {
        if (state.phase !== "handbreak") return;
        const id = setTimeout(
            () => dispatch({ type: "NEXT_HAND" }),
            Math.max(550, state.config.revealMs),
        );
        return () => clearTimeout(id);
    }, [state.phase, state.config.revealMs]);

    // Reshuffle: apply the controller's structural ramp, then fetch a fresh shoe.
    useEffect(() => {
        if (state.phase !== "reshuffle") return;
        let cancelled = false;
        (async () => {
            const nextConfig = controllerRef.current.onReshuffle(state.config);
            const data = await startDrill({
                numDecks: nextConfig.decks,
                numCards: 52 * nextConfig.decks,
            });
            if (!cancelled) {
                dispatch({ type: "RESHUFFLE_DONE", shoe: data.sequence, nextConfig });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [state.phase, state.config]);

    // After grading, Spacebar continues to the next hand (replacing the old
    // Continue button). Trainer's global handler ignores Spacebar while running,
    // so there's no conflict.
    useEffect(() => {
        if (state.phase !== "feedback") return;
        const onKey = (e) => {
            if (e.key === " ") {
                e.preventDefault();
                dispatch({ type: "CONTINUE" });
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [state.phase]);

    // Grade the guess against the cards seen so far this shoe (server recomputes).
    const handleGuess = async (guessStr) => {
        const parsed = Number.parseInt(guessStr, 10);
        if (Number.isNaN(parsed)) return;

        setBusy(true);
        try {
            const result = await gradeGuess(state.shoe.slice(0, state.pos), parsed);
            const nextConfig = result.correct
                ? controllerRef.current.onCorrect(state.config)
                : controllerRef.current.onWrong(state.config);
            const feedback = describeChange(state.config, nextConfig, result.correct);

            onResult?.(result, {
                numDecks: state.config.decks,
                numCards: state.pos,
            });
            dispatch({ type: "GRADED", result, nextConfig, feedback });
        } finally {
            setBusy(false);
        }
    };

    // Map drill state onto the table's props. Seats are ordered left-to-right with
    // the human user as the last (rightmost) seat; others are P1..P(n-1) leftward.
    const lastSeat = state.seats.players.length - 1;
    const players = state.seats.players.map((cards, i) => {
        const isUser = i === lastSeat;
        return {
            id: `p${i}`,
            label: isUser ? "You" : `P${i + 1}`,
            cards,
            isUser,
            isActive: state.active?.type === "player" && state.active.index === i,
        };
    });
    const dealer = {
        cards: state.seats.dealer,
        isActive: state.active?.type === "dealer",
    };

    const shuffling = state.phase === "loading" || state.phase === "reshuffle";
    const dealing = state.phase === "dealing" || state.phase === "handbreak";

    return (
        <section className="tabledrill">
            <div className="tabledrill__stage">
                <BlackjackTable
                    dealer={dealer}
                    players={players}
                    cardsRemaining={state.shoe.length - state.pos}
                    shoeSize={state.shoe.length}
                />
            </div>

            {/* The deal/prompt/feedback belt sits UNDER the table, not as a modal. */}
            <div className="tabledrill__belt">
                {shuffling && (
                    <p className="belt__msg">
                        Shuffling a fresh shoe… your running count resets to 0.
                    </p>
                )}

                {dealing && (
                    <p className="belt__msg belt__msg--hint">Keep your running count…</p>
                )}

                {state.phase === "asking" && (
                    <CountPrompt onSubmit={handleGuess} busy={busy} />
                )}

                {state.phase === "feedback" && state.result && (
                    <FeedbackLine result={state.result} />
                )}

                <p className="belt__keys">
                    Press <strong>R</strong> to restart · <strong>Esc</strong> to stop the
                    drill.
                </p>
            </div>
        </section>
    );
}

export default TableDrill;
