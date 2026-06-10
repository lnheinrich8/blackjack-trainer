// Maps the server's Rank/Suit enum names onto human-friendly card labels.
// These keys must match the enum names exactly (see server model.Rank / model.Suit).

const SUIT_SYMBOLS = {
  HEARTS: "♥", // ♥
  DIAMONDS: "♦", // ♦
  CLUBS: "♣", // ♣
  SPADES: "♠", // ♠
};

const RANK_LABELS = {
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
  JACK: "J",
  QUEEN: "Q",
  KING: "K",
  ACE: "A",
};

// Hearts and diamonds are drawn red; clubs and spades black.
export const isRedSuit = (suit) => suit === "HEARTS" || suit === "DIAMONDS";

export const rankLabel = (rank) => RANK_LABELS[rank] ?? rank;

export const suitSymbol = (suit) => SUIT_SYMBOLS[suit] ?? "?";
