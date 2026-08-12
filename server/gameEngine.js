// =============================================================================
// Katrazado — Game Engine (Pure Functions)
// =============================================================================
// All game rules implemented as pure functions with no side effects.
// This module is the single source of truth for game mechanics.
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUITS = ['Espadas', 'Copas', 'Ouros', 'Paus'];

const VALUES = ['2', '3', '4', '5', '6', 'Dama', 'Valete', 'Rei', '7', 'Ás'];

// Rank index: lower index = weaker card
// 2=0, 3=1, 4=2, 5=3, 6=4, Dama=5, Valete=6, Rei=7, 7=8, Ás=9
const RANK_MAP = Object.freeze(
  VALUES.reduce((map, value, index) => {
    map[value] = index;
    return map;
  }, {})
);

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const DEFAULT_LIVES = 5;
const MAX_CARDS_PER_PLAYER = 5;
const TOTAL_CARDS = 40;

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

/**
 * Creates a full deck of 40 unique cards.
 * @returns {Array<{value: string, suit: string}>}
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ value, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 * @param {Array} deck
 * @returns {Array}
 */
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Deal cards from a shuffled deck without replacement.
 * @param {Array} deck - Shuffled deck (will be mutated — cards removed)
 * @param {string[]} playerIds - Array of player IDs to deal to
 * @param {number} cardsPerPlayer - Number of cards each player receives
 * @returns {Object<string, Array>} Map of playerId → hand (array of cards)
 */
function dealCards(deck, playerIds, cardsPerPlayer) {
  const hands = {};
  for (const playerId of playerIds) {
    hands[playerId] = deck.splice(0, cardsPerPlayer);
  }
  return hands;
}

// ---------------------------------------------------------------------------
// Card Ranking
// ---------------------------------------------------------------------------

/**
 * Returns the numeric rank of a card (0–9, higher = stronger).
 * @param {{value: string}} card
 * @returns {number}
 */
function getCardRank(card) {
  const rank = RANK_MAP[card.value];
  if (rank === undefined) {
    throw new Error(`Unknown card value: ${card.value}`);
  }
  return rank;
}

/**
 * Compares two cards by rank.
 * @returns {number} positive if a > b, negative if a < b, 0 if equal
 */
function compareCards(a, b) {
  return getCardRank(a) - getCardRank(b);
}

// ---------------------------------------------------------------------------
// Trick Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a trick by processing cards in the order they were played.
 *
 * PAIR-CANCELLATION MECHANIC:
 * Cards of the same value cancel each other in pairs.
 * - When a card is played with the same value as an earlier UNCANCELLED card,
 *   BOTH cards are cancelled (removed from consideration).
 * - Pairing is sequential: 1st and 2nd of a value cancel, 3rd and 4th cancel, etc.
 * - After all cards are processed, the winner is the highest-rank UNCANCELLED card.
 * - If ALL cards are cancelled, the last player who completed a pair wins by default.
 *
 * Suits are NEVER compared.
 *
 * @param {Array<{playerId: string, card: {value: string, suit: string}}>} cardsPlayed
 *   Cards in the order they were played.
 * @returns {{winnerId: string, winningCard: {value: string, suit: string}}}
 */
function resolveTrick(cardsPlayed) {
  if (!cardsPlayed || cardsPlayed.length === 0) {
    throw new Error('No cards played in trick');
  }

  const n = cardsPlayed.length;
  const cancelled = new Array(n).fill(false);
  let lastCancellerIndex = -1;

  for (let i = 0; i < n; i++) {
    const currentValue = cardsPlayed[i].card.value;

    // Look for the first UNCANCELLED previous card with the same value
    for (let j = 0; j < i; j++) {
      if (!cancelled[j] && cardsPlayed[j].card.value === currentValue) {
        // Pair found — cancel BOTH cards
        cancelled[j] = true;
        cancelled[i] = true;
        lastCancellerIndex = i;
        break; // Only pair with the first uncancelled match
      }
    }
  }

  // Find the winner among uncancelled cards (highest rank)
  let winnerIndex = -1;
  for (let i = 0; i < n; i++) {
    if (!cancelled[i]) {
      if (winnerIndex === -1 || getCardRank(cardsPlayed[i].card) > getCardRank(cardsPlayed[winnerIndex].card)) {
        winnerIndex = i;
      }
    }
  }

  // If all cards are cancelled, the last player who completed a pair wins by default
  if (winnerIndex === -1) {
    winnerIndex = lastCancellerIndex;
  }

  return {
    winnerId: cardsPlayed[winnerIndex].playerId,
    winningCard: cardsPlayed[winnerIndex].card,
  };
}

// ---------------------------------------------------------------------------
// Bid Validation
// ---------------------------------------------------------------------------

/**
 * Validates a player's bid.
 *
 * Rules:
 * - Bid must be between 0 and cardsPerPlayer (inclusive).
 * - The sum of ALL bids cannot equal cardsPerPlayer (number of tricks).
 * - This restriction only applies to the LAST bidder.
 *
 * @param {number} bid - The proposed bid
 * @param {number} cardsPerPlayer - Number of tricks available
 * @param {number[]} existingBids - Bids already placed by other players
 * @param {boolean} isLastBidder - Whether this is the last player to bid
 * @returns {{valid: boolean, reason?: string, forbiddenValue?: number}}
 */
function validateBid(bid, cardsPerPlayer, existingBids, isLastBidder) {
  // Range check
  if (!Number.isInteger(bid) || bid < 0 || bid > cardsPerPlayer) {
    return {
      valid: false,
      reason: `A previsão deve ser entre 0 e ${cardsPerPlayer}.`,
    };
  }

  // Sum restriction (only applies to last bidder)
  if (isLastBidder) {
    const sumSoFar = existingBids.reduce((acc, b) => acc + b, 0);
    if (sumSoFar + bid === cardsPerPlayer) {
      return {
        valid: false,
        reason: `A soma das previsões não pode ser igual a ${cardsPerPlayer}. Não podes declarar ${bid}.`,
        forbiddenValue: bid,
      };
    }
  }

  return { valid: true };
}

/**
 * Returns the forbidden bid value for the last bidder, or null if no restriction.
 * @param {number} cardsPerPlayer
 * @param {number[]} existingBids
 * @returns {number|null}
 */
function getForbiddenBid(cardsPerPlayer, existingBids) {
  const sumSoFar = existingBids.reduce((acc, b) => acc + b, 0);
  const forbidden = cardsPerPlayer - sumSoFar;
  if (forbidden >= 0 && forbidden <= cardsPerPlayer) {
    return forbidden;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Round Sequence (Zigzag)
// ---------------------------------------------------------------------------

/**
 * Calculates the next cardsPerPlayer and direction.
 *
 * Sequence: 1,2,3,4,5,4,3,2,1,2,3,4,5,4,3,2,1,...
 *
 * Uses a direction variable that flips at boundaries.
 *
 * @param {number} current - Current cardsPerPlayer
 * @param {number} direction - Current direction (+1 or -1)
 * @returns {{cardsPerPlayer: number, direction: number}}
 */
function getNextCardsPerPlayer(current, direction) {
  let nextCards = current + direction;
  let nextDirection = direction;

  if (nextCards > MAX_CARDS_PER_PLAYER) {
    // Hit the top, reverse
    nextDirection = -1;
    nextCards = current + nextDirection;
  } else if (nextCards < 1) {
    // Hit the bottom, reverse
    nextDirection = 1;
    nextCards = current + nextDirection;
  }

  return { cardsPerPlayer: nextCards, direction: nextDirection };
}

/**
 * Generates the full round sequence for testing purposes.
 * @param {number} count - Number of values to generate
 * @returns {number[]}
 */
function generateRoundSequence(count) {
  const sequence = [];
  let cards = 1;
  let direction = 1;

  sequence.push(cards);

  for (let i = 1; i < count; i++) {
    const next = getNextCardsPerPlayer(cards, direction);
    cards = next.cardsPerPlayer;
    direction = next.direction;
    sequence.push(cards);
  }

  return sequence;
}

// ---------------------------------------------------------------------------
// Player Rotation
// ---------------------------------------------------------------------------

/**
 * Gets the next starting player for a round.
 *
 * Normal rotation: advance one position in the original player order,
 * skipping eliminated players.
 *
 * Elimination override: if a player was eliminated this round, the player
 * IMMEDIATELY BEFORE the eliminated player (in the active order) starts next.
 *
 * @param {string[]} originalOrder - Original full player order (never changes)
 * @param {string} currentStarter - Who started the current round
 * @param {string[]} activePlayers - Players still in the game (after elimination)
 * @param {string[]} newlyEliminated - Players eliminated THIS round (may be empty)
 * @returns {string} The ID of the next starting player
 */
function getNextStartingPlayer(originalOrder, currentStarter, activePlayers, newlyEliminated) {
  if (activePlayers.length === 0) {
    throw new Error('No active players remaining');
  }
  if (activePlayers.length === 1) {
    return activePlayers[0];
  }

  // If someone was eliminated, the player immediately BEFORE the eliminated
  // player in the ACTIVE order (before elimination) starts next.
  if (newlyEliminated && newlyEliminated.length > 0) {
    // Use the first eliminated player to determine the new starter.
    // The "previous" player is determined from the original order, considering
    // only players that are STILL active.
    const eliminated = newlyEliminated[0];
    const elimIdx = originalOrder.indexOf(eliminated);

    // Walk backwards in the original order to find the first active player
    // before the eliminated one.
    for (let step = 1; step < originalOrder.length; step++) {
      const idx = (elimIdx - step + originalOrder.length) % originalOrder.length;
      const candidate = originalOrder[idx];
      if (activePlayers.includes(candidate)) {
        return candidate;
      }
    }

    // Fallback (should not happen if activePlayers is valid)
    return activePlayers[0];
  }

  // Normal rotation: find the next active player after currentStarter
  // in the original order.
  const starterIdx = originalOrder.indexOf(currentStarter);

  for (let step = 1; step <= originalOrder.length; step++) {
    const idx = (starterIdx + step) % originalOrder.length;
    const candidate = originalOrder[idx];
    if (activePlayers.includes(candidate)) {
      return candidate;
    }
  }

  // Fallback
  return activePlayers[0];
}

/**
 * Returns the play order for a round starting from startingPlayer,
 * using only active players and respecting original order.
 *
 * @param {string[]} originalOrder
 * @param {string} startingPlayer
 * @param {string[]} activePlayers
 * @returns {string[]}
 */
function getPlayOrder(originalOrder, startingPlayer, activePlayers) {
  const startIdx = originalOrder.indexOf(startingPlayer);
  const order = [];

  for (let step = 0; step < originalOrder.length; step++) {
    const idx = (startIdx + step) % originalOrder.length;
    const player = originalOrder[idx];
    if (activePlayers.includes(player)) {
      order.push(player);
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Round Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a round: compares bids to tricks won and returns life changes.
 *
 * @param {Object<string, number>} bids - playerId → bid
 * @param {Object<string, number>} tricksWon - playerId → tricks won
 * @param {string[]} activePlayers - Players who participated
 * @returns {Object<string, {bidCorrect: boolean, livesLost: number}>}
 */
function evaluateRound(bids, tricksWon, activePlayers) {
  const results = {};

  for (const playerId of activePlayers) {
    const bid = bids[playerId];
    const tricks = tricksWon[playerId] || 0;
    const correct = bid === tricks;

    results[playerId] = {
      bid,
      tricksWon: tricks,
      bidCorrect: correct,
      livesLost: correct ? 0 : 1,
    };
  }

  return results;
}

// ---------------------------------------------------------------------------
// Blind Bid
// ---------------------------------------------------------------------------

/**
 * Determines if a player should bid blind this round.
 * @param {number} livesAtRoundStart - Player's lives at the START of this round
 * @returns {boolean}
 */
function isBlindBid(livesAtRoundStart) {
  return livesAtRoundStart === 1;
}

// ---------------------------------------------------------------------------
// Elimination
// ---------------------------------------------------------------------------

/**
 * Check which players should be eliminated after a round.
 * @param {Object<string, number>} lives - playerId → current lives
 * @param {string[]} activePlayers
 * @returns {{eliminated: string[], remaining: string[]}}
 */
function checkEliminations(lives, activePlayers) {
  const eliminated = [];
  const remaining = [];

  for (const playerId of activePlayers) {
    if (lives[playerId] <= 0) {
      eliminated.push(playerId);
    } else {
      remaining.push(playerId);
    }
  }

  return { eliminated, remaining };
}

/**
 * Check if the game is over (only 1 active player remains).
 * @param {string[]} activePlayers
 * @returns {{gameOver: boolean, winner?: string}}
 */
function checkGameOver(activePlayers) {
  if (activePlayers.length <= 1) {
    return {
      gameOver: true,
      winner: activePlayers[0] || null,
    };
  }
  return { gameOver: false };
}

// ---------------------------------------------------------------------------
// Card Utilities
// ---------------------------------------------------------------------------

/**
 * Returns a string identifier for a card (e.g., "Ás-Espadas").
 */
function cardId(card) {
  return `${card.value}-${card.suit}`;
}

/**
 * Checks if a player has a specific card in their hand.
 */
function playerHasCard(hand, card) {
  return hand.some(c => c.value === card.value && c.suit === card.suit);
}

/**
 * Removes a card from a hand (returns new array).
 */
function removeCardFromHand(hand, card) {
  const idx = hand.findIndex(c => c.value === card.value && c.suit === card.suit);
  if (idx === -1) {
    throw new Error(`Card ${cardId(card)} not found in hand`);
  }
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

// ---------------------------------------------------------------------------
// Suit Symbols (for display)
// ---------------------------------------------------------------------------

const SUIT_SYMBOLS = {
  Espadas: '♠',
  Copas: '♥',
  Ouros: '♦',
  Paus: '♣',
};

const SUIT_COLORS = {
  Espadas: 'black',
  Copas: 'red',
  Ouros: 'red',
  Paus: 'black',
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Constants
  SUITS,
  VALUES,
  RANK_MAP,
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_LIVES,
  MAX_CARDS_PER_PLAYER,
  TOTAL_CARDS,
  SUIT_SYMBOLS,
  SUIT_COLORS,

  // Deck
  createDeck,
  shuffleDeck,
  dealCards,

  // Ranking
  getCardRank,
  compareCards,

  // Trick
  resolveTrick,

  // Bids
  validateBid,
  getForbiddenBid,

  // Rounds
  getNextCardsPerPlayer,
  generateRoundSequence,

  // Rotation
  getNextStartingPlayer,
  getPlayOrder,

  // Evaluation
  evaluateRound,

  // Blind
  isBlindBid,

  // Elimination
  checkEliminations,
  checkGameOver,

  // Utilities
  cardId,
  playerHasCard,
  removeCardFromHand,
};
