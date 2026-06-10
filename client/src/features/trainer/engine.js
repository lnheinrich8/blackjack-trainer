// Adaptive difficulty engine for Dynamic mode. Pure functions only — no React,
// no timers, no storage, no Math.random(). Given a game state and an outcome it
// returns the next game state, which keeps it fully unit-testable.

// --- Tuning constants ---

// Card reveal speed (ms each card is shown). Lower = harder. Clamped to bounds
export const MIN_REVEAL_MS = 250;
export const MAX_REVEAL_MS = 1500;
export const START_REVEAL_MS = 1000;

// Multipliers applied to revealMs on a right / wrong answer
export const SPEED_UP_FACTOR = 0.85;
export const SLOW_DOWN_FACTOR = 1.4;

// Deck bounds for the gradual ramp (decks only change at a reshuffle)
export const MIN_DECKS = 1;
export const MAX_DECKS = 8;
export const START_DECKS = 1;

// Player-seat bounds (also chosen per shoe at a reshuffle)
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 6;
export const START_PLAYERS = 1;

// Hands dealt before the app prompts for the count
export const START_HANDS_UNTIL_ASKED = 5;
export const MIN_HANDS_UNTIL_ASKED = 2;

// Gradual ramp: add one deck every N levels (decks change only at a reshuffle).
export const LEVELS_PER_DECK = 3;


// --- Game state ---

// Universal game state object. Defaults come from the constants above so there
// is a single source of truth; pass `overrides` to tweak any field.
function createGameState(overrides = {}) {
    return {
        decks: START_DECKS,
        revealMs: START_REVEAL_MS,
        numPlayers: START_PLAYERS,
        handsUntilAsked: START_HANDS_UNTIL_ASKED,
        streak: 0,
        level: 1,
        ...overrides,
    };
}

// Baseline difficulty a fresh Dynamic run begins at
export function startingDifficulty() {
    return createGameState();
}

// --- Helpers ---

// Constrain a value to the inclusive [min, max] range
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// --- Transitions ---

// Reward path: the user got the count right. Speed up (shorter reveal time) and extend the streak / level
export function onCorrect(difficulty) {
    const revealMs = Math.round(
        clamp(
            difficulty.revealMs * SPEED_UP_FACTOR,
            MIN_REVEAL_MS,
            MAX_REVEAL_MS,
        ),
    );

    return {
        ...difficulty,
        revealMs,
        streak: difficulty.streak + 1,
        level: difficulty.level + 1,
    };
}

// Penalty path: the user got the count wrong. Slow down (longer reveal time) and reset
// the streak. Deck and player counts are NOT touched here
export function onWrong(difficulty) {
    const revealMs = Math.round(
        clamp(
            difficulty.revealMs * SLOW_DOWN_FACTOR,
            MIN_REVEAL_MS,
            MAX_REVEAL_MS,
        ),
    );

    return {
        ...difficulty,
        revealMs,
        streak: 0,
        level: difficulty.level, // keep on the same level when wrong (for now)
    }
}

// Called when the shoe hits the cut card and we deal a fresh one. This is where
// the STRUCTURAL difficulty ramps (decks, players, hands-until-asked), since
// those can only change between shoes. `rng` is a function returning a number in
// [0, 1) — pass Math.random in the app, a stub in tests — so this stays pure and
// deterministic. revealMs and streak carry over (earned speed/streak persist).
export function onReshuffle(difficulty, rng) {
    // Decks grow gradually with level (deterministic), capped at MAX_DECKS.
    const decks = clamp(
        START_DECKS + Math.floor(difficulty.level / LEVELS_PER_DECK),
        MIN_DECKS,
        MAX_DECKS,
    );

    // Seats widen with level; the actual count is random within [MIN_PLAYERS, max].
    const maxSeats = clamp(
        MIN_PLAYERS + Math.floor(difficulty.level / 2),
        MIN_PLAYERS,
        MAX_PLAYERS,
    );
    const numPlayers =
        MIN_PLAYERS + Math.floor(rng() * (maxSeats - MIN_PLAYERS + 1));

    // Prompt sooner as level rises: the upper bound of the hand range tightens
    // toward MIN_HANDS_UNTIL_ASKED, and the actual value is random within it.
    const maxHands = clamp(
        START_HANDS_UNTIL_ASKED - Math.floor(difficulty.level / 2),
        MIN_HANDS_UNTIL_ASKED,
        START_HANDS_UNTIL_ASKED,
    );
    const handsUntilAsked =
        MIN_HANDS_UNTIL_ASKED +
        Math.floor(rng() * (maxHands - MIN_HANDS_UNTIL_ASKED + 1));

    return {
        ...difficulty,
        decks,
        numPlayers,
        handsUntilAsked,
    };
}
