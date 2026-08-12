// =============================================================================
// Katrazado — Game State Machine
// =============================================================================
// Manages game state and transitions through the game lifecycle.
// All game logic delegates to gameEngine.js pure functions.
// =============================================================================

'use strict';

const engine = require('./gameEngine');

// ---------------------------------------------------------------------------
// Game States
// ---------------------------------------------------------------------------

const GAME_STATES = {
  LOBBY: 'LOBBY',
  ROUND_SETUP: 'ROUND_SETUP',
  DEALING: 'DEALING',
  BIDDING: 'BIDDING',
  TRICK_PLAY: 'TRICK_PLAY',
  ROUND_RESULTS: 'ROUND_RESULTS',
  ELIMINATION_CHECK: 'ELIMINATION_CHECK',
  NEXT_ROUND: 'NEXT_ROUND',
  GAME_OVER: 'GAME_OVER',
};

// ---------------------------------------------------------------------------
// Game Class
// ---------------------------------------------------------------------------

class Game {
  /**
   * @param {string} gameId - Unique game identifier (room code)
   * @param {string} hostId - Socket ID of the host player
   * @param {string} hostName - Display name of the host
   * @param {number} [initialLives=5] - Starting lives per player
   */
  constructor(gameId, hostId, hostName, initialLives = engine.DEFAULT_LIVES) {
    this.gameId = gameId;
    this.hostId = hostId;
    this.initialLives = initialLives;

    // Players
    this.players = new Map(); // socketId → { id, name, connected }
    this.playerOrder = []; // Original order (never changes)
    this.activePlayers = []; // Currently alive players
    this.eliminatedPlayers = []; // Eliminated player IDs

    // Lives
    this.lives = {}; // playerId → lives
    this.livesAtRoundStart = {}; // snapshot at round start (for blind bid check)

    // Round tracking
    this.currentRound = 0;
    this.cardsPerPlayer = 1;
    this.roundDirection = 1; // +1 going up, -1 going down
    this.startingPlayer = null;
    this.currentPlayer = null;

    // Cards
    this.deck = [];
    this.hands = {}; // playerId → [cards]
    this.blindBidPlayers = new Set(); // Players bidding blind this round
    this.revealedPlayers = new Set(); // Blind players who have bid and can now see cards

    // Bids
    this.bids = {}; // playerId → bid
    this.bidOrder = []; // Order in which bids were placed
    this.currentBidderIndex = 0;

    // Tricks
    this.tricksWon = {}; // playerId → trick count this round
    this.currentTrick = []; // [{playerId, card}]
    this.currentTrickNumber = 0;
    this.trickLeader = null; // Who leads the current trick
    this.currentTrickPlayerIndex = 0;
    this.trickPlayOrder = []; // Order for current trick

    // History
    this.playedCardsHistory = []; // All cards played this round [{trickNum, playerId, card}]
    this.roundHistory = []; // History of all rounds [{round, cardsPerPlayer, results}]

    // State
    this.gameState = GAME_STATES.LOBBY;

    // Add host as first player
    this.addPlayer(hostId, hostName);
  }

  // =========================================================================
  // Player Management
  // =========================================================================

  addPlayer(socketId, name) {
    if (this.gameState !== GAME_STATES.LOBBY) {
      return { success: false, reason: 'O jogo já começou.' };
    }
    if (this.players.size >= engine.MAX_PLAYERS) {
      return { success: false, reason: `Máximo de ${engine.MAX_PLAYERS} jogadores.` };
    }
    if (this.players.has(socketId)) {
      return { success: false, reason: 'Já estás na sala.' };
    }

    // Check for duplicate names
    for (const [, player] of this.players) {
      if (player.name.toLowerCase() === name.toLowerCase()) {
        return { success: false, reason: 'Já existe um jogador com esse nome.' };
      }
    }

    this.players.set(socketId, { id: socketId, name, connected: true });
    this.playerOrder.push(socketId);

    return { success: true };
  }

  removePlayer(socketId) {
    if (this.gameState === GAME_STATES.LOBBY) {
      this.players.delete(socketId);
      this.playerOrder = this.playerOrder.filter(id => id !== socketId);

      // If host left and there are others, reassign host
      if (socketId === this.hostId && this.playerOrder.length > 0) {
        this.hostId = this.playerOrder[0];
      }

      return { removed: true };
    }

    // During game, mark as disconnected but don't remove
    const player = this.players.get(socketId);
    if (player) {
      player.connected = false;
    }
    return { removed: false, disconnected: true };
  }

  reconnectPlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      player.connected = true;
      return true;
    }
    return false;
  }

  getPlayerName(socketId) {
    const player = this.players.get(socketId);
    return player ? player.name : 'Desconhecido';
  }

  getPlayerList() {
    return this.playerOrder.map(id => {
      const player = this.players.get(id);
      return {
        id,
        name: player.name,
        connected: player.connected,
        isHost: id === this.hostId,
        lives: this.lives[id] ?? this.initialLives,
        eliminated: this.eliminatedPlayers.includes(id),
      };
    });
  }

  // =========================================================================
  // Game Start
  // =========================================================================

  startGame() {
    if (this.gameState !== GAME_STATES.LOBBY) {
      return { success: false, reason: 'O jogo já começou.' };
    }
    if (this.players.size < engine.MIN_PLAYERS) {
      return { success: false, reason: `Mínimo de ${engine.MIN_PLAYERS} jogadores.` };
    }

    // Initialize game state
    this.activePlayers = [...this.playerOrder];
    this.eliminatedPlayers = [];

    for (const playerId of this.playerOrder) {
      this.lives[playerId] = this.initialLives;
    }

    // First round setup
    this.currentRound = 0;
    this.cardsPerPlayer = 1;
    this.roundDirection = 1;
    this.startingPlayer = this.playerOrder[0]; // Creator starts first

    return { success: true };
  }

  // =========================================================================
  // Round Setup
  // =========================================================================

  setupRound() {
    this.gameState = GAME_STATES.ROUND_SETUP;
    this.currentRound++;

    // Snapshot lives at round start (for blind bid detection)
    this.livesAtRoundStart = {};
    for (const playerId of this.activePlayers) {
      this.livesAtRoundStart[playerId] = this.lives[playerId];
    }

    // Determine blind bid players
    this.blindBidPlayers = new Set();
    this.revealedPlayers = new Set();
    for (const playerId of this.activePlayers) {
      if (engine.isBlindBid(this.livesAtRoundStart[playerId])) {
        this.blindBidPlayers.add(playerId);
      }
    }

    // Reset round data
    this.bids = {};
    this.bidOrder = [];
    this.tricksWon = {};
    this.currentTrick = [];
    this.currentTrickNumber = 0;
    this.playedCardsHistory = [];

    for (const playerId of this.activePlayers) {
      this.tricksWon[playerId] = 0;
    }

    // Play order for this round
    this.trickPlayOrder = engine.getPlayOrder(
      this.playerOrder,
      this.startingPlayer,
      this.activePlayers
    );

    return {
      round: this.currentRound,
      cardsPerPlayer: this.cardsPerPlayer,
      startingPlayer: this.startingPlayer,
      playOrder: this.trickPlayOrder,
      blindBidPlayers: [...this.blindBidPlayers],
    };
  }

  // =========================================================================
  // Dealing
  // =========================================================================

  dealCards() {
    this.gameState = GAME_STATES.DEALING;

    // Create and shuffle deck
    this.deck = engine.createDeck();
    engine.shuffleDeck(this.deck);

    // Deal cards
    this.hands = engine.dealCards(this.deck, this.activePlayers, this.cardsPerPlayer);

    this.gameState = GAME_STATES.BIDDING;

    // Set up bidding order (same as play order)
    this.currentBidderIndex = 0;
    this.currentPlayer = this.trickPlayOrder[0];

    return {
      // Each player gets their own hand sent privately
      hands: this.hands,
    };
  }

  // =========================================================================
  // Bidding
  // =========================================================================

  /**
   * Get the current bidding state for a specific player.
   */
  getBiddingState(playerId) {
    const isBlind = this.blindBidPlayers.has(playerId) && !this.revealedPlayers.has(playerId);
    const isCurrentBidder = this.currentPlayer === playerId;
    const isLastBidder = this.currentBidderIndex === this.trickPlayOrder.length - 1;

    let forbiddenBid = null;
    if (isCurrentBidder && isLastBidder) {
      forbiddenBid = engine.getForbiddenBid(this.cardsPerPlayer, this.bidOrder);
    }

    return {
      isBlind,
      isCurrentBidder,
      isLastBidder,
      forbiddenBid,
      currentBidder: this.currentPlayer,
      currentBidderName: this.getPlayerName(this.currentPlayer),
      bidsPlaced: Object.entries(this.bids).map(([id, bid]) => ({
        playerId: id,
        playerName: this.getPlayerName(id),
        bid,
      })),
      remainingBidders: this.trickPlayOrder.slice(this.currentBidderIndex).map(id => ({
        playerId: id,
        playerName: this.getPlayerName(id),
      })),
    };
  }

  /**
   * Place a bid for the current bidder.
   */
  placeBid(playerId, bid) {
    if (this.gameState !== GAME_STATES.BIDDING) {
      return { success: false, reason: 'Não é fase de declarações.' };
    }
    if (playerId !== this.currentPlayer) {
      return { success: false, reason: 'Não é a tua vez de declarar.' };
    }

    const isLastBidder = this.currentBidderIndex === this.trickPlayOrder.length - 1;
    const validation = engine.validateBid(bid, this.cardsPerPlayer, this.bidOrder, isLastBidder);

    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    // Record the bid
    this.bids[playerId] = bid;
    this.bidOrder.push(bid);

    // If this player was blind, reveal their cards now
    const wasBlind = this.blindBidPlayers.has(playerId);
    if (wasBlind) {
      this.revealedPlayers.add(playerId);
    }

    // Move to next bidder or start trick play
    this.currentBidderIndex++;

    if (this.currentBidderIndex >= this.trickPlayOrder.length) {
      // All bids placed — transition to trick play
      this.startTrickPlay();
      return {
        success: true,
        bid,
        wasBlind,
        biddingComplete: true,
        hand: wasBlind ? this.hands[playerId] : null,
      };
    }

    // More bidders remaining
    this.currentPlayer = this.trickPlayOrder[this.currentBidderIndex];

    return {
      success: true,
      bid,
      wasBlind,
      biddingComplete: false,
      hand: wasBlind ? this.hands[playerId] : null,
    };
  }

  // =========================================================================
  // Trick Play
  // =========================================================================

  startTrickPlay() {
    this.gameState = GAME_STATES.TRICK_PLAY;
    this.currentTrickNumber = 1;
    this.currentTrick = [];
    this.trickLeader = this.trickPlayOrder[0]; // First player leads first trick
    this.currentTrickPlayerIndex = 0;
    this.currentPlayer = this.trickLeader;
  }

  /**
   * Get the current trick play state.
   */
  getTrickPlayState() {
    // Build the play order for this trick (starting from trick leader)
    const trickOrder = engine.getPlayOrder(
      this.playerOrder,
      this.trickLeader,
      this.activePlayers
    );

    return {
      trickNumber: this.currentTrickNumber,
      totalTricks: this.cardsPerPlayer,
      currentPlayer: this.currentPlayer,
      currentPlayerName: this.getPlayerName(this.currentPlayer),
      trickLeader: this.trickLeader,
      cardsOnTable: this.currentTrick.map(c => ({
        playerId: c.playerId,
        playerName: this.getPlayerName(c.playerId),
        card: c.card,
      })),
      trickOrder,
    };
  }

  /**
   * Play a card in the current trick.
   */
  playCard(playerId, card) {
    if (this.gameState !== GAME_STATES.TRICK_PLAY) {
      return { success: false, reason: 'Não é fase de jogo.' };
    }
    if (playerId !== this.currentPlayer) {
      return { success: false, reason: 'Não é a tua vez de jogar.' };
    }

    // Verify player has this card
    if (!engine.playerHasCard(this.hands[playerId], card)) {
      return { success: false, reason: 'Não tens essa carta.' };
    }

    // Remove card from hand
    this.hands[playerId] = engine.removeCardFromHand(this.hands[playerId], card);

    // Add to current trick
    this.currentTrick.push({ playerId, card });
    this.playedCardsHistory.push({
      trickNum: this.currentTrickNumber,
      playerId,
      card,
    });

    // Check if trick is complete (all active players played)
    if (this.currentTrick.length >= this.activePlayers.length) {
      return this.resolveTrick();
    }

    // Move to next player in trick order
    const trickOrder = engine.getPlayOrder(
      this.playerOrder,
      this.trickLeader,
      this.activePlayers
    );
    const currentIdx = trickOrder.indexOf(playerId);
    this.currentPlayer = trickOrder[currentIdx + 1];

    return {
      success: true,
      trickComplete: false,
      card,
    };
  }

  /**
   * Resolve the current trick — determine winner.
   */
  resolveTrick() {
    const result = engine.resolveTrick(this.currentTrick);

    // Award trick to winner
    this.tricksWon[result.winnerId] = (this.tricksWon[result.winnerId] || 0) + 1;

    const trickResult = {
      success: true,
      trickComplete: true,
      trickNumber: this.currentTrickNumber,
      cardsPlayed: this.currentTrick.map(c => ({
        playerId: c.playerId,
        playerName: this.getPlayerName(c.playerId),
        card: c.card,
      })),
      winnerId: result.winnerId,
      winnerName: this.getPlayerName(result.winnerId),
      winningCard: result.winningCard,
    };

    // Check if all tricks for this round are done
    if (this.currentTrickNumber >= this.cardsPerPlayer) {
      // Round is over
      trickResult.roundComplete = true;
      return trickResult;
    }

    // Start next trick — in Katrazado, startingPlayer always leads every trick in the round
    this.currentTrickNumber++;
    this.currentTrick = [];
    this.trickLeader = this.startingPlayer;
    this.currentPlayer = this.startingPlayer;

    trickResult.roundComplete = false;
    return trickResult;
  }

  // =========================================================================
  // Round Results
  // =========================================================================

  evaluateRound() {
    this.gameState = GAME_STATES.ROUND_RESULTS;

    const results = engine.evaluateRound(this.bids, this.tricksWon, this.activePlayers);

    // Apply life changes
    for (const playerId of this.activePlayers) {
      this.lives[playerId] -= results[playerId].livesLost;
    }

    // Build round summary
    const roundSummary = {
      round: this.currentRound,
      cardsPerPlayer: this.cardsPerPlayer,
      results: this.activePlayers.map(id => ({
        playerId: id,
        playerName: this.getPlayerName(id),
        bid: results[id].bid,
        tricksWon: results[id].tricksWon,
        bidCorrect: results[id].bidCorrect,
        livesLost: results[id].livesLost,
        livesRemaining: this.lives[id],
        wasBlind: this.blindBidPlayers.has(id),
      })),
    };

    this.roundHistory.push(roundSummary);

    return roundSummary;
  }

  // =========================================================================
  // Elimination Check
  // =========================================================================

  checkEliminations() {
    this.gameState = GAME_STATES.ELIMINATION_CHECK;

    const { eliminated, remaining } = engine.checkEliminations(this.lives, this.activePlayers);

    const eliminationResult = {
      eliminated: eliminated.map(id => ({
        playerId: id,
        playerName: this.getPlayerName(id),
      })),
      remaining: remaining.map(id => ({
        playerId: id,
        playerName: this.getPlayerName(id),
        lives: this.lives[id],
      })),
    };

    // Update active/eliminated lists
    this.eliminatedPlayers.push(...eliminated);
    this.activePlayers = remaining;

    // Check game over
    const gameOverCheck = engine.checkGameOver(this.activePlayers);
    if (gameOverCheck.gameOver) {
      this.gameState = GAME_STATES.GAME_OVER;
      eliminationResult.gameOver = true;
      eliminationResult.winner = gameOverCheck.winner
        ? {
            playerId: gameOverCheck.winner,
            playerName: this.getPlayerName(gameOverCheck.winner),
          }
        : null;
      return eliminationResult;
    }

    eliminationResult.gameOver = false;
    return eliminationResult;
  }

  // =========================================================================
  // Next Round
  // =========================================================================

  advanceToNextRound() {
    this.gameState = GAME_STATES.NEXT_ROUND;

    // Determine next starting player
    const newlyEliminated = this.roundHistory.length > 0
      ? this.roundHistory[this.roundHistory.length - 1].results
          .filter(r => r.livesRemaining <= 0)
          .map(r => r.playerId)
      : [];

    this.startingPlayer = engine.getNextStartingPlayer(
      this.playerOrder,
      this.startingPlayer,
      this.activePlayers,
      newlyEliminated
    );

    // Advance cards per player (zigzag)
    const next = engine.getNextCardsPerPlayer(this.cardsPerPlayer, this.roundDirection);
    this.cardsPerPlayer = next.cardsPerPlayer;
    this.roundDirection = next.direction;

    return {
      nextRound: this.currentRound + 1,
      cardsPerPlayer: this.cardsPerPlayer,
      startingPlayer: this.startingPlayer,
      startingPlayerName: this.getPlayerName(this.startingPlayer),
    };
  }

  // =========================================================================
  // State Serialization (for sending to clients)
  // =========================================================================

  /**
   * Get game state for a specific player (respects privacy).
   * Never sends other players' cards.
   */
  getStateForPlayer(playerId) {
    const state = {
      gameId: this.gameId,
      gameState: this.gameState,
      players: this.getPlayerList(),
      activePlayers: this.activePlayers.map(id => ({
        id,
        name: this.getPlayerName(id),
        lives: this.lives[id],
      })),
      eliminatedPlayers: this.eliminatedPlayers.map(id => ({
        id,
        name: this.getPlayerName(id),
      })),
      currentRound: this.currentRound,
      cardsPerPlayer: this.cardsPerPlayer,
      startingPlayer: this.startingPlayer,
      startingPlayerName: this.startingPlayer ? this.getPlayerName(this.startingPlayer) : null,
      currentPlayer: this.currentPlayer,
      currentPlayerName: this.currentPlayer ? this.getPlayerName(this.currentPlayer) : null,
      isHost: playerId === this.hostId,
      isMyTurn: playerId === this.currentPlayer,
      myId: playerId,
      myName: this.getPlayerName(playerId),
    };

    // Add player-specific data
    if (this.hands[playerId]) {
      const isBlind = this.blindBidPlayers.has(playerId) && !this.revealedPlayers.has(playerId);
      state.myHand = isBlind ? null : this.hands[playerId];
      state.isBlind = isBlind;
      state.handSize = this.hands[playerId].length;
    }

    // Bids (public info)
    state.bids = {};
    for (const [id, bid] of Object.entries(this.bids)) {
      state.bids[id] = { bid, playerName: this.getPlayerName(id) };
    }

    // Tricks won (public info)
    state.tricksWon = {};
    for (const [id, count] of Object.entries(this.tricksWon)) {
      state.tricksWon[id] = { count, playerName: this.getPlayerName(id) };
    }

    // Current trick cards on table (public)
    state.currentTrick = this.currentTrick.map(c => ({
      playerId: c.playerId,
      playerName: this.getPlayerName(c.playerId),
      card: c.card,
    }));

    // Play order
    state.playOrder = this.trickPlayOrder.map(id => ({
      id,
      name: this.getPlayerName(id),
    }));

    // Round history
    state.roundHistory = this.roundHistory;

    // Blind players info
    state.blindBidPlayers = [...this.blindBidPlayers].map(id => ({
      id,
      name: this.getPlayerName(id),
    }));

    // Bidding-specific info
    if (this.gameState === GAME_STATES.BIDDING) {
      const biddingState = this.getBiddingState(playerId);
      state.bidding = biddingState;
    }

    // Trick-play specific info
    if (this.gameState === GAME_STATES.TRICK_PLAY) {
      state.trickPlay = this.getTrickPlayState();
    }

    return state;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  GAME_STATES,
  Game,
};
