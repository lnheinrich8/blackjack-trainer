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
