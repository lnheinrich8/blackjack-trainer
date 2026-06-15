import axios from "axios";

// Configured axios instance
const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// GET /api/health — liveness check
export const getHealth = () => api.get("/health").then((r) => r.data);

// POST /api/drills/start — deal a whole drill sequence up front.
// config: { numDecks, numCards }  ->  response: { sequence: [{ rank, suit }] }
export const startDrill = (config) =>
  api.post("/drills/start", config).then((r) => r.data);

// POST /api/drills/grade — server recomputes the true count and grades the guess.
// sequence: the cards the user was shown, guessedCount: their running-count guess.
// response: { guessedCount, correctCount, correct }
export const gradeGuess = (sequence, guessedCount) =>
  api.post("/drills/grade", { sequence, guessedCount }).then((r) => r.data);

// POST /api/play/shoe — deal a full, freshly shuffled shoe for a blackjack game.
// body: { numDecks }  ->  response: { sequence: [{ rank, suit }] } (52 * numDecks)
export const getShoe = (numDecks) =>
  api.post("/play/shoe", { numDecks }).then((r) => r.data);

// POST /api/coach/chat — chat with the local-LLM coach. Sends the conversation so
// far plus the freshly computed bet analysis (so replies are grounded in the
// player's stats). body: { analysis, messages: [{ role, content }] } -> { reply }.
// No client timeout since local model inference can take several seconds (the
// server caps the wait).
export const postCoachChat = (analysis, messages) =>
  api.post("/coach/chat", { analysis, messages }).then((r) => r.data);
