import { readJson, writeJson } from "./storage";

// A single localStorage slot shared by the Play and Train pages for the shoe
// that's currently in play. Whichever page last started its game "owns" the
// slot; the other page restores from it only when the owner matches. So leaving
// a page and coming back (without starting the other game) keeps the same shoe,
// but starting a game on the other page overwrites the slot and discards it.
const KEY = "bjack.shoe";

// Return the cached shoe ({ sequence, pos }) if it belongs to `owner` and holds
// cards, else null. (An empty/cleared slot restores nothing.)
export function readShoe(owner) {
    const cached = readJson(KEY, null);
    if (cached?.owner === owner && Array.isArray(cached.sequence) && cached.sequence.length > 0) {
        return { sequence: cached.sequence, pos: cached.pos ?? 0 };
    }
    return null;
}

// Claim the slot for `owner` and store the live shoe and position.
export function writeShoe(owner, sequence, pos) {
    writeJson(KEY, { owner, sequence, pos });
}

// Drop the cached shoe so nothing is restored (e.g. settings changed, the old
// shoe no longer matches the new deck count).
export function clearShoe() {
    writeJson(KEY, null);
}
