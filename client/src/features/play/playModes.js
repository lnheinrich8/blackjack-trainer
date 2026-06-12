// Difficulty configuration for the Play page — the same shape as the trainer's
// modes.js, minus the counting-specific bits (no reveal speed, no "hands before
// count", no Extreme tier). A Play config is just { decks, numPlayers }, where
// numPlayers counts every seat including the user. "Dynamic" seats players that
// come and go between hands (handled by the game engine in a later phase).

// Fixed difficulty presets shown in the Play config modal.
export const PRESETS = {
    easy: { decks: 1, numPlayers: 1 }, // heads-up: just you
    normal: { decks: 4, numPlayers: 3 }, // you plus a couple of others
    hard: { decks: 8, numPlayers: 6 }, // max decks, a full table
    dynamic: { decks: 8, numPlayers: 4 }, // max decks; seat count drifts as you play
};

// Order shown in the modal. "Custom" is derived (selected automatically when the
// user edits a specific value), so it isn't in this pickable list.
export const DIFFICULTIES = [
    { id: "easy", label: "Easy" },
    { id: "normal", label: "Normal" },
    { id: "hard", label: "Hard" },
    { id: "dynamic", label: "Dynamic" },
];

export const DEFAULT_DIFFICULTY = "easy";

export function labelFor(difficultyId) {
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
