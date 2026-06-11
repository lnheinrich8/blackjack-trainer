import {
    startingDifficulty,
    onCorrect,
    onWrong,
    onReshuffle,
} from "./engine";

// A "controller" is what makes the difficulties interchangeable: the shared
// TableDrill loop only knows { initial, onCorrect, onWrong, onReshuffle } and
// calls them at the right moments, so it never branches on the difficulty.
// Config field shape matches the engine's:
//   { decks, revealMs, numPlayers, handsUntilAsked, streak, level }

// Presets and Custom never change difficulty — they only track the streak for
// display. onReshuffle is a no-op (the fixed config carries straight over).
export function staticController(config) {
    const base = { streak: 0, level: 1, ...config };
    return {
        initial: () => ({ ...base }),
        onCorrect: (s) => ({ ...s, streak: s.streak + 1 }),
        onWrong: (s) => ({ ...s, streak: 0 }),
        onReshuffle: (s) => ({ ...s }),
    };
}

// Dynamic delegates straight to the adaptive engine. Math.random is injected
// here (not in engine.js) so the engine stays pure.
export const dynamicController = {
    initial: startingDifficulty,
    onCorrect,
    onWrong,
    onReshuffle: (s) => onReshuffle(s, Math.random),
};

// Fixed difficulty presets (the concrete values shown in the config modal).
export const PRESETS = {
    easy: { decks: 1, numPlayers: 1, revealMs: 1400, handsUntilAsked: 3 },
    normal: { decks: 2, numPlayers: 3, revealMs: 1000, handsUntilAsked: 4 },
    hard: { decks: 6, numPlayers: 5, revealMs: 600, handsUntilAsked: 5 },
    extreme: { decks: 8, numPlayers: 6, revealMs: 300, handsUntilAsked: 6 },
};

// Order shown in the config modal. "Custom" is derived (selected automatically
// when the user edits a specific value), so it isn't in this pickable list.
export const DIFFICULTIES = [
    { id: "easy", label: "Easy" },
    { id: "normal", label: "Normal" },
    { id: "hard", label: "Hard" },
    { id: "extreme", label: "Extreme" },
    { id: "dynamic", label: "Dynamic" },
];

export const DEFAULT_DIFFICULTY = "normal";

export function labelFor(difficultyId) {
    if (difficultyId === "custom") return "Custom";
    const found = DIFFICULTIES.find((d) => d.id === difficultyId);
    return found ? found.label : "Custom";
}

// Pick the controller for the current difficulty. Presets and Custom both run on
// concrete config values; only Dynamic uses the adaptive engine.
export function resolveController(difficultyId, config) {
    if (difficultyId === "dynamic") return dynamicController;
    return staticController(config);
}
