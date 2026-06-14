// Difficulty configuration for the Play page — the same shape as the trainer's
// modes.js, minus the counting-specific bits (no reveal speed, no "hands before
// count", no Extreme tier). A Play config is { decks, numPlayers, behaviors },
// where numPlayers counts every seat including the user and behaviors is one
// personality id per OTHER player (length numPlayers - 1). "Dynamic" seats
// players that come and go between hands, so it ignores behaviors and assigns
// personalities at random.

// The personalities a seated bot can play with, in modal-display order. The ids
// must match strategy.js's PLAYER_TYPES (that module owns the actual decisions).
export const BEHAVIORS = [
    { id: "book", label: "By the book" },
    { id: "loose", label: "Mostly by the book" },
    { id: "erratic", label: "Erratic" },
];

export const DEFAULT_BEHAVIOR = "book";

// Fixed difficulty presets shown in the Play config modal. behaviors always has
// numPlayers - 1 entries (one per other player).
export const PRESETS = {
    testing: { decks: 1, numPlayers: 1, behaviors: [] }, // same as easy; reveals the count
    easy: { decks: 1, numPlayers: 1, behaviors: [] }, // heads-up: just you
    normal: { decks: 4, numPlayers: 3, behaviors: ["book", "loose"] },
    hard: { decks: 8, numPlayers: 5, behaviors: ["book", "loose", "loose", "erratic"] },
    dynamic: { decks: 8, numPlayers: 4, behaviors: ["book", "loose", "erratic"] },
};

// Order shown in the modal. "Custom" is derived (selected automatically when the
// user edits a specific value), so it isn't in this pickable list.
export const DIFFICULTIES = [
    { id: "testing", label: "Testing" },
    { id: "easy", label: "Easy" },
    { id: "normal", label: "Normal" },
    { id: "hard", label: "Hard" },
    { id: "dynamic", label: "Dynamic" },
];

export const DEFAULT_DIFFICULTY = "easy";

// "Testing" and its edited variant "testing-custom" both reveal the running
// count in the bankroll hover stats.
export function isTestingMode(difficultyId) {
    return difficultyId === "testing" || difficultyId === "testing-custom";
}

// Grow or shrink a behaviors array to match a seat count (numPlayers - 1 other
// players), padding new slots with the default personality and dropping extras.
// Tolerates a missing array (legacy saved configs predate behaviors).
export function resizeBehaviors(behaviors, numPlayers) {
    const need = Math.max(0, numPlayers - 1);
    const next = (behaviors ?? []).slice(0, need);
    while (next.length < need) next.push(DEFAULT_BEHAVIOR);
    return next;
}

// A config's behaviors, normalized to the right length — safe to read anywhere
// even if the stored config is from before behaviors existed.
export function behaviorsFor(config) {
    return resizeBehaviors(config.behaviors, config.numPlayers);
}

export function labelFor(difficultyId) {
    if (difficultyId === "testing-custom") return "Testing custom";
    const found = DIFFICULTIES.find((d) => d.id === difficultyId);
    return found ? found.label : "Custom";
}

// The hover-detail lines for the top-right status label.
export function statusDetails(difficultyId, config) {
    if (difficultyId === "dynamic") {
        return [`${config.decks} decks`, "Players come & go"];
    }
    return [
        `${config.decks} ${config.decks === 1 ? "deck" : "decks"}`,
        `${config.numPlayers} ${config.numPlayers === 1 ? "player" : "players"}`,
    ];
}
