import { useEffect, useReducer, useState } from "react";
import { getShoe } from "../../api/client";
import { useLocalStorage } from "../shared/hooks/useLocalStorage";
import {
  reducer,
  init,
  doubleReason,
  splitReason,
  needsReshuffle,
  STARTING_BANKROLL,
} from "./state";
import PlayTable from "./components/PlayTable";
import BetControls from "./components/BetControls";
import RoundResult from "./components/RoundResult";
import PlayConfigModal from "./components/PlayConfigModal";

const DECKS = 6; // shoe size for the Play game
const DEAL_MS = 450; // pause between cards of the opening deal
const DEALER_MS = 700; // pause between the dealer's draws
const REBUY = 1000; // chips handed out when you bust your bankroll
const MIN_CHIP = 5; // smallest chip; below this with no bet you must re-buy

// The Play page: real blackjack against the dealer, dealt from a server-provided
// predetermined shoe. The reducer (state.js) holds the game; this component owns
// the side effects — fetching shoes, persisting the bankroll, and ticking the
// deal/dealer animations on timers (same approach as the trainer's TableDrill).
function Play() {
  const [savedBankroll, setSavedBankroll] = useLocalStorage(
    "bjack.play.bankroll",
    STARTING_BANKROLL,
  );
  const [state, dispatch] = useReducer(
    reducer,
    { bankroll: savedBankroll, shoe: [] },
    init,
  );

  // Persist the bankroll whenever it changes so progress survives a reload.
  useEffect(() => {
    setSavedBankroll(state.bankroll);
  }, [state.bankroll, setSavedBankroll]);

  // Initial shoe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getShoe(DECKS);
      if (!cancelled) dispatch({ type: "RESHUFFLE", shoe: data.sequence });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reshuffle between rounds once the shoe passes the cut card. Fetching resets
  // pos to 0, so needsReshuffle goes false and this won't loop.
  useEffect(() => {
    if (state.phase !== "betting") return;
    if (!needsReshuffle(state)) return;
    let cancelled = false;
    (async () => {
      const data = await getShoe(DECKS);
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

  // Keyboard controls. Spacebar deals / advances; during the player's turn
  // Z=hit, X=stand, C=double, V=split. Trying to double/split when it isn't
  // allowed shows a 3-second explanation instead.
  useEffect(() => {
    const onKey = (e) => {
      if (modalOpen) return; // the settings modal owns its own interactions
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " ") {
        if (state.phase === "betting") {
          e.preventDefault(); // stop the page from scrolling on space
          if (state.bet > 0 && !dealDisabled) dispatch({ type: "DEAL" });
          else if (state.bet === 0) setNudge((n) => n + 1);
        } else if (state.phase === "settle") {
          e.preventDefault();
          dispatch({ type: "NEXT_ROUND" });
        }
        return;
      }

      if (state.phase !== "playerTurn") return;
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
  }, [state, dealDisabled, modalOpen]);

  // Clear the blocker message 3 seconds after it (re)appears.
  useEffect(() => {
    if (!blocker) return;
    const id = setTimeout(() => setBlocker(null), 3000);
    return () => clearTimeout(id);
  }, [blocker]);

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
        <div className="play__bankroll">
          Bankroll <strong>${state.bankroll}</strong>
        </div>
      </div>

      <div className="trainer__spacer trainer__spacer--top" aria-hidden="true" />

      <div className="tabledrill">
        <div className="tabledrill__stage">
          <PlayTable
            dealer={state.dealer}
            dealerHoleHidden={state.dealerHoleHidden}
            hands={state.hands}
            active={state.active}
            phase={state.phase}
            betChips={state.betChips}
            onRemoveChip={(value) => dispatch({ type: "REMOVE_CHIP", value })}
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
                onAddChip={(value) => dispatch({ type: "ADD_CHIP", value })}
                nudge={nudge}
              />
            ))}

          {state.phase === "dealing" && (
            <p className="belt__msg belt__msg--hint">Dealing…</p>
          )}

          {state.phase === "playerTurn" && (
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
          )}

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

      {modalOpen && <PlayConfigModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}

export default Play;
