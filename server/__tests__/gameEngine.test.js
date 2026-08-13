// =============================================================================
// Katrazado — Game Engine Tests
// =============================================================================

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  SUITS,
  VALUES,
  RANK_MAP,
  TOTAL_CARDS,
  createDeck,
  shuffleDeck,
  dealCards,
  getCardRank,
  compareCards,
  resolveTrick,
  validateBid,
  getForbiddenBid,
  getNextCardsPerPlayer,
  generateRoundSequence,
  getNextStartingPlayer,
  getPlayOrder,
  evaluateRound,
  isBlindBid,
  checkEliminations,
  checkGameOver,
  cardId,
  playerHasCard,
  removeCardFromHand,
} = require('../gameEngine');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function card(value, suit = 'Espadas') {
  return { value, suit };
}

function playedCard(playerId, value, suit = 'Espadas') {
  return { playerId, card: card(value, suit) };
}

// ===========================================================================
// DECK TESTS
// ===========================================================================

describe('Deck', () => {
  it('should have exactly 40 cards', () => {
    const deck = createDeck();
    assert.equal(deck.length, TOTAL_CARDS);
  });

  it('should have exactly 4 suits', () => {
    const deck = createDeck();
    const suits = new Set(deck.map(c => c.suit));
    assert.equal(suits.size, 4);
    for (const suit of SUITS) {
      assert.ok(suits.has(suit), `Missing suit: ${suit}`);
    }
  });

  it('should have exactly 10 values', () => {
    const deck = createDeck();
    const values = new Set(deck.map(c => c.value));
    assert.equal(values.size, 10);
    for (const value of VALUES) {
      assert.ok(values.has(value), `Missing value: ${value}`);
    }
  });

  it('should have no duplicate cards', () => {
    const deck = createDeck();
    const ids = deck.map(c => cardId(c));
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, deck.length, 'Duplicate cards found');
  });

  it('should have 10 cards per suit', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const count = deck.filter(c => c.suit === suit).length;
      assert.equal(count, 10, `Suit ${suit} should have 10 cards, has ${count}`);
    }
  });

  it('should have 4 cards per value', () => {
    const deck = createDeck();
    for (const value of VALUES) {
      const count = deck.filter(c => c.value === value).length;
      assert.equal(count, 4, `Value ${value} should have 4 cards, has ${count}`);
    }
  });
});

// ===========================================================================
// SHUFFLE TESTS
// ===========================================================================

describe('Shuffle', () => {
  it('should return the same array reference', () => {
    const deck = createDeck();
    const result = shuffleDeck(deck);
    assert.equal(result, deck);
  });

  it('should maintain all 40 cards after shuffle', () => {
    const deck = createDeck();
    const originalIds = deck.map(c => cardId(c)).sort();
    shuffleDeck(deck);
    const shuffledIds = deck.map(c => cardId(c)).sort();
    assert.deepEqual(shuffledIds, originalIds);
  });

  it('should actually change the order (statistical test)', () => {
    // Shuffle 10 times and check that at least one produces a different order
    const original = createDeck();
    const originalIds = original.map(c => cardId(c)).join(',');
    let allSame = true;

    for (let i = 0; i < 10; i++) {
      const deck = createDeck();
      shuffleDeck(deck);
      if (deck.map(c => cardId(c)).join(',') !== originalIds) {
        allSame = false;
        break;
      }
    }
    assert.ok(!allSame, 'Shuffle should change the order');
  });
});

// ===========================================================================
// DEAL TESTS
// ===========================================================================

describe('Deal', () => {
  it('should deal correct number of cards to each player', () => {
    const deck = createDeck();
    shuffleDeck(deck);
    const players = ['A', 'B', 'C', 'D'];
    const hands = dealCards(deck, players, 3);

    for (const p of players) {
      assert.equal(hands[p].length, 3);
    }
  });

  it('should deal unique cards (no overlap between hands)', () => {
    const deck = createDeck();
    shuffleDeck(deck);
    const players = ['A', 'B', 'C', 'D', 'E'];
    const hands = dealCards(deck, players, 5);

    const allCards = [];
    for (const p of players) {
      allCards.push(...hands[p]);
    }

    const ids = allCards.map(c => cardId(c));
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, 'Dealt cards should be unique');
  });

  it('should remove dealt cards from the deck', () => {
    const deck = createDeck();
    shuffleDeck(deck);
    const players = ['A', 'B', 'C'];
    dealCards(deck, players, 4);
    assert.equal(deck.length, 40 - 3 * 4);
  });
});

// ===========================================================================
// CARD RANKING TESTS
// ===========================================================================

describe('Card Ranking', () => {
  it('should rank 2 as lowest (0)', () => {
    assert.equal(getCardRank(card('2')), 0);
  });

  it('should rank Ás as highest (9)', () => {
    assert.equal(getCardRank(card('Ás')), 9);
  });

  it('should follow exact hierarchy: 2 < 3 < 4 < 5 < 6 < Dama < Valete < Rei < 7 < Ás', () => {
    const expectedOrder = ['2', '3', '4', '5', '6', 'Dama', 'Valete', 'Rei', '7', 'Ás'];
    for (let i = 0; i < expectedOrder.length - 1; i++) {
      const lower = getCardRank(card(expectedOrder[i]));
      const higher = getCardRank(card(expectedOrder[i + 1]));
      assert.ok(
        lower < higher,
        `${expectedOrder[i]} (rank ${lower}) should be lower than ${expectedOrder[i + 1]} (rank ${higher})`
      );
    }
  });

  it('should rank 7 higher than Rei', () => {
    assert.ok(getCardRank(card('7')) > getCardRank(card('Rei')));
  });

  it('should rank Dama lower than Valete', () => {
    assert.ok(getCardRank(card('Dama')) < getCardRank(card('Valete')));
  });

  it('should compare cards correctly', () => {
    assert.ok(compareCards(card('Ás'), card('7')) > 0); // Ás > 7
    assert.ok(compareCards(card('2'), card('Ás')) < 0); // 2 < Ás
    assert.equal(compareCards(card('Rei', 'Espadas'), card('Rei', 'Copas')), 0); // same value
  });

  it('should throw for unknown card value', () => {
    assert.throws(() => getCardRank({ value: 'Joker' }), /Unknown card value/);
  });
});

// ===========================================================================
// TRICK RESOLUTION TESTS
// ===========================================================================

describe('Trick Resolution — Pair Cancellation', () => {
  // --- Basic: no cancellation ---
  it('all different values → highest card wins', () => {
    const result = resolveTrick([
      playedCard('A', 'Rei'),
      playedCard('B', 'Ás'),
      playedCard('C', 'Dama'),
    ]);
    assert.equal(result.winnerId, 'B');
  });

  it('Ás → 7 → Rei → 2 → no duplicates → Ás wins', () => {
    const result = resolveTrick([
      playedCard('A', 'Ás'),
      playedCard('B', '7'),
      playedCard('C', 'Rei'),
      playedCard('D', '2'),
    ]);
    assert.equal(result.winnerId, 'A');
  });

  it('last player does not automatically win', () => {
    const result = resolveTrick([
      playedCard('A', 'Ás'),
      playedCard('B', '7'),
      playedCard('C', 'Rei'),
      playedCard('D', '2'),
    ]);
    assert.notEqual(result.winnerId, 'D');
    assert.equal(result.winnerId, 'A');
  });

  it('single card wins by default', () => {
    const result = resolveTrick([
      playedCard('A', '2'),
    ]);
    assert.equal(result.winnerId, 'A');
  });

  it('should throw for empty cards array', () => {
    assert.throws(() => resolveTrick([]), /No cards played/);
  });

  // --- Pair cancellation: 2 of same value ---
  it('2 same value → both cancelled → last cutter wins (all cancelled)', () => {
    // Dama-Espadas + Dama-Copas → both cancelled, B is last cutter
    const result = resolveTrick([
      playedCard('A', 'Dama', 'Espadas'),
      playedCard('B', 'Dama', 'Copas'),
    ]);
    assert.equal(result.winnerId, 'B');
  });

  it('Ás → 7 → Ás → both Ás cancel → B wins with 7', () => {
    // A-Ás and C-Ás cancel, B-7 survives as highest active card
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', '7'),
      playedCard('C', 'Ás', 'Copas'),
    ]);
    assert.equal(result.winnerId, 'B');
  });

  it('Ás → 7 → Ás → 7 → all cancel → D wins (last cutter)', () => {
    // A-Ás + C-Ás cancel, B-7 + D-7 cancel. All cancelled → last cutter D
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', '7', 'Espadas'),
      playedCard('C', 'Ás', 'Copas'),
      playedCard('D', '7', 'Copas'),
    ]);
    assert.equal(result.winnerId, 'D');
  });

  // --- User's 5-player example ---
  it('Ás → 7 → Ás → 7 → Rei → Rei survives → E wins', () => {
    // A-Ás + C-Ás cancel, B-7 + D-7 cancel. E-Rei uncancelled → E wins
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', '7', 'Espadas'),
      playedCard('C', 'Ás', 'Copas'),
      playedCard('D', '7', 'Copas'),
      playedCard('E', 'Rei'),
    ]);
    assert.equal(result.winnerId, 'E');
  });

  // --- User's 6-player example (from clarification) ---
  it('6 players: Ás→7→Ás→Ás→Ás→7 → all cancel → F wins (last cutter)', () => {
    // Ás: A(1st), C(2nd) → pair cancel. D(3rd), E(4th) → pair cancel.
    // 7: B(1st), F(2nd) → pair cancel. All cancelled → last cutter F
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', '7', 'Espadas'),
      playedCard('C', 'Ás', 'Copas'),
      playedCard('D', 'Ás', 'Ouros'),
      playedCard('E', 'Ás', 'Paus'),
      playedCard('F', '7', 'Copas'),
    ]);
    assert.equal(result.winnerId, 'F');
  });

  // --- User's 7-player example with EA ---
  it('7 players: Ás→7→Ás→Ás→Ás→2→7 → EA survives with 2 → EA wins', () => {
    // Ás: A-C cancel, D-E cancel. 7: B-F cancel. EA-2 survives.
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', '7', 'Espadas'),
      playedCard('C', 'Ás', 'Copas'),
      playedCard('D', 'Ás', 'Ouros'),
      playedCard('E', 'Ás', 'Paus'),
      playedCard('EA', '2'),
      playedCard('F', '7', 'Copas'),
    ]);
    assert.equal(result.winnerId, 'EA');
  });

  // --- 3 of same value: 1st-2nd cancel, 3rd survives ---
  it('three of same value: 5→5→5 → first two cancel → C survives', () => {
    const result = resolveTrick([
      playedCard('A', '5', 'Espadas'),
      playedCard('B', '5', 'Copas'),
      playedCard('C', '5', 'Ouros'),
    ]);
    assert.equal(result.winnerId, 'C');
  });

  // --- Cut then higher card ---
  it('3→3→Ás → 3s cancel → Ás survives → C wins', () => {
    const result = resolveTrick([
      playedCard('A', '3', 'Espadas'),
      playedCard('B', '3', 'Copas'),
      playedCard('C', 'Ás'),
    ]);
    assert.equal(result.winnerId, 'C');
  });

  // --- 4 of same value: all cancel ---
  it('four of same value: Rei→Rei→Rei→Rei → all cancel → D wins (last cutter)', () => {
    const result = resolveTrick([
      playedCard('A', 'Rei', 'Espadas'),
      playedCard('B', 'Rei', 'Copas'),
      playedCard('C', 'Rei', 'Ouros'),
      playedCard('D', 'Rei', 'Paus'),
    ]);
    assert.equal(result.winnerId, 'D');
  });

  // --- Mixed: some cancel, survivor determines winner ---
  it('Ás→Ás→7 → Ás cancel → 7 survives → C wins', () => {
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', 'Ás', 'Copas'),
      playedCard('C', '7'),
    ]);
    assert.equal(result.winnerId, 'C');
  });

  it('2→Ás→Ás→3 → Ás cancel → 3 highest of survivors → D wins', () => {
    const result = resolveTrick([
      playedCard('A', '2', 'Espadas'),
      playedCard('B', 'Ás', 'Espadas'),
      playedCard('C', 'Ás', 'Copas'),
      playedCard('D', '3', 'Espadas'),
    ]);
    assert.equal(result.winnerId, 'D');
  });

  // --- Suits never matter ---
  it('suits are irrelevant — only value determines pairing and ranking', () => {
    // Two Ás of different suits cancel each other
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', 'Ás', 'Paus'),
    ]);
    assert.equal(result.winnerId, 'B'); // all cancelled, last cutter
  });

  // --- Complex: multiple pairs ---
  it('Ás→7→Rei→Ás→7→Rei → all cancel in pairs → F wins (last cutter)', () => {
    const result = resolveTrick([
      playedCard('A', 'Ás', 'Espadas'),
      playedCard('B', '7', 'Espadas'),
      playedCard('C', 'Rei', 'Espadas'),
      playedCard('D', 'Ás', 'Copas'),
      playedCard('E', '7', 'Copas'),
      playedCard('F', 'Rei', 'Copas'),
    ]);
    assert.equal(result.winnerId, 'F');
  });

  // --- Odd one out ---
  it('5→Rei→5→Rei→3 → both pairs cancel → 3 survives → E wins', () => {
    const result = resolveTrick([
      playedCard('A', '5', 'Espadas'),
      playedCard('B', 'Rei', 'Espadas'),
      playedCard('C', '5', 'Copas'),
      playedCard('D', 'Rei', 'Copas'),
      playedCard('E', '3'),
    ]);
    assert.equal(result.winnerId, 'E');
  });
});

// ===========================================================================
// BID VALIDATION TESTS
// ===========================================================================

describe('Bid Validation', () => {
  it('should accept bid of 0', () => {
    const result = validateBid(0, 3, [], false);
    assert.ok(result.valid);
  });

  it('should accept bid equal to cardsPerPlayer', () => {
    const result = validateBid(5, 5, [], false);
    assert.ok(result.valid);
  });

  it('should accept intermediate bid values', () => {
    const result = validateBid(3, 5, [1], false);
    assert.ok(result.valid);
  });

  it('should reject negative bid', () => {
    const result = validateBid(-1, 3, [], false);
    assert.ok(!result.valid);
  });

  it('should reject bid greater than cardsPerPlayer', () => {
    const result = validateBid(6, 5, [], false);
    assert.ok(!result.valid);
  });

  it('should reject non-integer bid', () => {
    const result = validateBid(1.5, 3, [], false);
    assert.ok(!result.valid);
  });

  it('should reject last bidder when sum would equal cardsPerPlayer', () => {
    // 5 tricks, existing bids sum to 4, bidding 1 would make sum = 5
    const result = validateBid(1, 5, [2, 1, 1], true);
    assert.ok(!result.valid);
  });

  it('should allow last bidder other values when one is forbidden', () => {
    // 5 tricks, existing bids sum to 4, forbidden = 1
    assert.ok(validateBid(0, 5, [2, 1, 1], true).valid);
    assert.ok(validateBid(2, 5, [2, 1, 1], true).valid);
    assert.ok(validateBid(3, 5, [2, 1, 1], true).valid);
    assert.ok(validateBid(4, 5, [2, 1, 1], true).valid);
    assert.ok(validateBid(5, 5, [2, 1, 1], true).valid);
  });

  it('non-last bidder is not restricted by sum rule', () => {
    // Even if sum would equal cardsPerPlayer, non-last bidder is free
    const result = validateBid(1, 5, [2, 1, 1], false);
    assert.ok(result.valid);
  });

  it('getForbiddenBid returns the correct forbidden value', () => {
    assert.equal(getForbiddenBid(5, [2, 1, 1]), 1);
    assert.equal(getForbiddenBid(3, [1, 1]), 1);
    assert.equal(getForbiddenBid(5, [0, 0, 0]), 5);
    assert.equal(getForbiddenBid(1, []), 1);
  });
});

// ===========================================================================
// ROUND SEQUENCE TESTS
// ===========================================================================

describe('Round Sequence', () => {
  it('should produce exact zigzag: 1,2,3,4,5,4,3,2,1,2,3,4,5,...', () => {
    const expected = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5];
    const actual = generateRoundSequence(expected.length);
    assert.deepEqual(actual, expected);
  });

  it('should start at 1', () => {
    const seq = generateRoundSequence(1);
    assert.deepEqual(seq, [1]);
  });

  it('should go up to 5 and back down to 1', () => {
    const seq = generateRoundSequence(9);
    assert.deepEqual(seq, [1, 2, 3, 4, 5, 4, 3, 2, 1]);
  });

  it('should repeat the zigzag pattern indefinitely', () => {
    const seq = generateRoundSequence(25);
    const cycle = [1, 2, 3, 4, 5, 4, 3, 2];

    // After the initial 1, every 8 elements repeat
    // The pattern is: 1, then [2,3,4,5,4,3,2,1] repeating
    for (let i = 0; i < seq.length; i++) {
      assert.ok(seq[i] >= 1 && seq[i] <= 5, `Value at index ${i} should be 1-5, got ${seq[i]}`);
    }

    // Verify the full expected sequence
    const expected = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1];
    assert.deepEqual(seq, expected);
  });

  it('should never jump (each step differs by exactly 1)', () => {
    const seq = generateRoundSequence(50);
    for (let i = 1; i < seq.length; i++) {
      const diff = Math.abs(seq[i] - seq[i - 1]);
      assert.equal(diff, 1, `Jump at index ${i}: ${seq[i - 1]} → ${seq[i]}`);
    }
  });

  it('should never go below 1 or above 5', () => {
    const seq = generateRoundSequence(100);
    for (const val of seq) {
      assert.ok(val >= 1 && val <= 5, `Value ${val} out of range`);
    }
  });

  it('getNextCardsPerPlayer flips direction at 5', () => {
    const result = getNextCardsPerPlayer(5, 1);
    assert.equal(result.cardsPerPlayer, 4);
    assert.equal(result.direction, -1);
  });

  it('getNextCardsPerPlayer flips direction at 1', () => {
    const result = getNextCardsPerPlayer(1, -1);
    assert.equal(result.cardsPerPlayer, 2);
    assert.equal(result.direction, 1);
  });
});

// ===========================================================================
// PLAYER ROTATION TESTS
// ===========================================================================

describe('Player Rotation', () => {
  const order = ['A', 'B', 'C', 'D', 'E'];

  it('first round starts with creator (first player)', () => {
    // The creator is 'A', so 'A' starts first
    const playOrder = getPlayOrder(order, 'A', order);
    assert.deepEqual(playOrder, ['A', 'B', 'C', 'D', 'E']);
  });

  it('normal rotation: A → B → C → D → E', () => {
    assert.equal(getNextStartingPlayer(order, 'A', order, []), 'B');
    assert.equal(getNextStartingPlayer(order, 'B', order, []), 'C');
    assert.equal(getNextStartingPlayer(order, 'C', order, []), 'D');
    assert.equal(getNextStartingPlayer(order, 'D', order, []), 'E');
    assert.equal(getNextStartingPlayer(order, 'E', order, []), 'A');
  });

  it('elimination: C eliminated → B starts next', () => {
    const active = ['A', 'B', 'D', 'E'];
    const next = getNextStartingPlayer(order, 'B', active, ['C']);
    assert.equal(next, 'B');
  });

  it('elimination: A eliminated → E starts next', () => {
    const active = ['B', 'C', 'D', 'E'];
    const next = getNextStartingPlayer(order, 'E', active, ['A']);
    assert.equal(next, 'E');
  });

  it('elimination: E eliminated → D starts next', () => {
    const active = ['A', 'B', 'C', 'D'];
    const next = getNextStartingPlayer(order, 'D', active, ['E']);
    assert.equal(next, 'D');
  });

  it('normal rotation skips eliminated players', () => {
    const active = ['A', 'B', 'D', 'E']; // C eliminated previously
    const next = getNextStartingPlayer(order, 'B', active, []);
    assert.equal(next, 'D'); // Skips C
  });

  it('play order respects original order and skips eliminated', () => {
    const active = ['A', 'B', 'D', 'E']; // C eliminated
    const playOrder = getPlayOrder(order, 'D', active);
    assert.deepEqual(playOrder, ['D', 'E', 'A', 'B']);
  });

  it('works with only 2 active players', () => {
    const active = ['B', 'D'];
    const next = getNextStartingPlayer(order, 'B', active, []);
    assert.equal(next, 'D');
  });

  it('returns only remaining player when 1 left', () => {
    const active = ['D'];
    const next = getNextStartingPlayer(order, 'B', active, []);
    assert.equal(next, 'D');
  });
});

// ===========================================================================
// ROUND EVALUATION (LIVES) TESTS
// ===========================================================================

describe('Round Evaluation', () => {
  it('correct prediction → 0 lives lost', () => {
    const results = evaluateRound(
      { A: 2, B: 1 },
      { A: 2, B: 1 },
      ['A', 'B']
    );
    assert.equal(results.A.livesLost, 0);
    assert.equal(results.B.livesLost, 0);
    assert.ok(results.A.bidCorrect);
    assert.ok(results.B.bidCorrect);
  });

  it('wrong prediction → lives lost equals absolute difference between bid and tricks', () => {
    const results = evaluateRound(
      { A: 2, B: 1 },
      { A: 0, B: 3 },
      ['A', 'B']
    );
    assert.equal(results.A.livesLost, 2); // |2 - 0| = 2
    assert.equal(results.B.livesLost, 2); // |1 - 3| = 2
    assert.ok(!results.A.bidCorrect);
    assert.ok(!results.B.bidCorrect);
  });

  it('magnitude of error determines lives lost', () => {
    const results = evaluateRound(
      { A: 5, B: 0 },
      { A: 0, B: 5 },
      ['A', 'B']
    );
    assert.equal(results.A.livesLost, 5); // |5 - 0| = 5
    assert.equal(results.B.livesLost, 5); // |0 - 5| = 5
  });

  it('mixed results', () => {
    const results = evaluateRound(
      { A: 2, B: 1, C: 0 },
      { A: 2, B: 0, C: 1 },
      ['A', 'B', 'C']
    );
    assert.equal(results.A.livesLost, 0); // correct
    assert.equal(results.B.livesLost, 1); // |1 - 0| = 1
    assert.equal(results.C.livesLost, 1); // |0 - 1| = 1
  });

  it('0 tricks won defaults correctly', () => {
    const results = evaluateRound(
      { A: 0 },
      {}, // no tricks won entry
      ['A']
    );
    assert.equal(results.A.tricksWon, 0);
    assert.equal(results.A.livesLost, 0); // bid 0, got 0 → correct
  });
});

// ===========================================================================
// BLIND BID TESTS
// ===========================================================================

describe('Blind Bid', () => {
  it('lives = 1 at round start → blind bid', () => {
    assert.ok(isBlindBid(1));
  });

  it('lives = 2 at round start → not blind', () => {
    assert.ok(!isBlindBid(2));
  });

  it('lives = 5 at round start → not blind', () => {
    assert.ok(!isBlindBid(5));
  });

  it('lives = 0 → not blind (should not happen, player is eliminated)', () => {
    assert.ok(!isBlindBid(0));
  });

  it('scenario: 2 lives → fail → 1 life → NOT blind this round, blind NEXT round', () => {
    // At round start: 2 lives
    assert.ok(!isBlindBid(2)); // Not blind this round

    // After round: loses 1 life → 1 life remaining
    // At NEXT round start: 1 life
    assert.ok(isBlindBid(1)); // Blind next round
  });
});

// ===========================================================================
// ELIMINATION TESTS
// ===========================================================================

describe('Elimination', () => {
  it('player with 0 lives is eliminated', () => {
    const result = checkEliminations(
      { A: 3, B: 0, C: 2 },
      ['A', 'B', 'C']
    );
    assert.deepEqual(result.eliminated, ['B']);
    assert.deepEqual(result.remaining, ['A', 'C']);
  });

  it('multiple players eliminated at once', () => {
    const result = checkEliminations(
      { A: 0, B: 0, C: 1 },
      ['A', 'B', 'C']
    );
    assert.deepEqual(result.eliminated, ['A', 'B']);
    assert.deepEqual(result.remaining, ['C']);
  });

  it('no one eliminated', () => {
    const result = checkEliminations(
      { A: 3, B: 2, C: 1 },
      ['A', 'B', 'C']
    );
    assert.deepEqual(result.eliminated, []);
    assert.deepEqual(result.remaining, ['A', 'B', 'C']);
  });

  it('1 life → fail → 0 → eliminated', () => {
    // Simulate: player had 1 life, failed prediction
    const lives = { A: 3, B: 0 }; // B had 1, lost 1 → 0
    const result = checkEliminations(lives, ['A', 'B']);
    assert.ok(result.eliminated.includes('B'));

    // After elimination, previous player starts next round
    const order = ['A', 'B', 'C', 'D'];
    const next = getNextStartingPlayer(order, 'A', ['A', 'C', 'D'], ['B']);
    assert.equal(next, 'A'); // A is immediately before B
  });
});

// ===========================================================================
// GAME OVER TESTS
// ===========================================================================

describe('Game Over', () => {
  it('game is not over with 2+ active players', () => {
    assert.ok(!checkGameOver(['A', 'B']).gameOver);
    assert.ok(!checkGameOver(['A', 'B', 'C']).gameOver);
  });

  it('game is over with 1 active player', () => {
    const result = checkGameOver(['A']);
    assert.ok(result.gameOver);
    assert.equal(result.winner, 'A');
  });

  it('game is over with 0 active players (edge case)', () => {
    const result = checkGameOver([]);
    assert.ok(result.gameOver);
    assert.equal(result.winner, null);
  });
});

// ===========================================================================
// CARD UTILITY TESTS
// ===========================================================================

describe('Card Utilities', () => {
  it('cardId produces unique string', () => {
    assert.equal(cardId(card('Ás', 'Espadas')), 'Ás-Espadas');
    assert.equal(cardId(card('7', 'Copas')), '7-Copas');
  });

  it('playerHasCard finds card in hand', () => {
    const hand = [card('Ás', 'Espadas'), card('7', 'Copas')];
    assert.ok(playerHasCard(hand, card('Ás', 'Espadas')));
    assert.ok(!playerHasCard(hand, card('Ás', 'Copas')));
  });

  it('removeCardFromHand returns new array without the card', () => {
    const hand = [card('Ás', 'Espadas'), card('7', 'Copas'), card('2', 'Paus')];
    const newHand = removeCardFromHand(hand, card('7', 'Copas'));
    assert.equal(newHand.length, 2);
    assert.ok(!playerHasCard(newHand, card('7', 'Copas')));
    assert.ok(playerHasCard(newHand, card('Ás', 'Espadas')));
    // Original hand unchanged
    assert.equal(hand.length, 3);
  });

  it('removeCardFromHand throws for missing card', () => {
    const hand = [card('Ás', 'Espadas')];
    assert.throws(() => removeCardFromHand(hand, card('2', 'Copas')), /not found/);
  });
});
