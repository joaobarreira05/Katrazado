// =============================================================================
// Katrazado — Socket.IO Event Handlers
// =============================================================================
// Handles all client-server communication. The server is the authority.
// =============================================================================

'use strict';

const { Game, GAME_STATES } = require('./gameState');

// Active games map: gameId → Game
const games = new Map();

// Player to game mapping: socketId → gameId
const playerGames = new Map();

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getGame(socketId) {
  const gameId = playerGames.get(socketId);
  if (!gameId) return null;
  return games.get(gameId) || null;
}

const turnTimers = new Map();

function clearTurnTimer(gameId) {
  if (turnTimers.has(gameId)) {
    clearTimeout(turnTimers.get(gameId));
    turnTimers.delete(gameId);
  }
}

function scheduleTurnTimer(io, game) {
  clearTurnTimer(game.gameId);

  if (game.gameState !== GAME_STATES.BIDDING && game.gameState !== GAME_STATES.TRICK_PLAY) {
    return;
  }

  const activePlayer = game.currentPlayer;
  if (!activePlayer) return;

  const timer = setTimeout(() => {
    console.log(`[Katrazado] 20s timer expired for ${game.getPlayerName(activePlayer)} in ${game.gameState}`);
    handleTimeoutAction(io, game, activePlayer);
  }, 20000);

  turnTimers.set(game.gameId, timer);
}

function handleTimeoutAction(io, game, playerId) {
  if (game.currentPlayer !== playerId) return;

  const engine = require('./gameEngine');

  if (game.gameState === GAME_STATES.BIDDING) {
    const isLastBidder = game.currentBidderIndex === game.trickPlayOrder.length - 1;
    let autoBid = 0;
    const forbidden = isLastBidder ? engine.getForbiddenBid(game.cardsPerPlayer, game.bidOrder) : null;
    if (forbidden === 0) autoBid = 1;

    const result = game.placeBid(playerId, autoBid);
    if (result.success) {
      broadcastToGame(io, game, 'bid-placed', {
        playerId,
        playerName: game.getPlayerName(playerId),
        bid: autoBid,
        wasBlind: result.wasBlind,
        auto: true,
      });
      if (result.wasBlind && result.hand) {
        io.to(playerId).emit('cards-revealed', { hand: result.hand });
      }
      broadcastGameState(io, game);
      if (result.biddingComplete) {
        broadcastToGame(io, game, 'bidding-complete', {
          bids: Object.entries(game.bids).map(([id, b]) => ({
            playerId: id,
            playerName: game.getPlayerName(id),
            bid: b,
          })),
        });
      }
    }
  } else if (game.gameState === GAME_STATES.TRICK_PLAY) {
    const hand = game.hands[playerId];
    if (hand && hand.length > 0) {
      const autoCard = hand[0];
      const result = game.playCard(playerId, autoCard);
      if (result.success) {
        broadcastToGame(io, game, 'card-played', {
          playerId,
          playerName: game.getPlayerName(playerId),
          card: autoCard,
          auto: true,
        });

        if (result.trickComplete) {
          broadcastToGame(io, game, 'trick-resolved', {
            trickNumber: result.trickNumber,
            cardsPlayed: result.cardsPlayed,
            winnerId: result.winnerId,
            winnerName: result.winnerName,
            winningCard: result.winningCard,
          });

          if (result.roundComplete) {
            setTimeout(() => {
              const roundResults = game.evaluateRound();
              broadcastToGame(io, game, 'round-results', roundResults);
              broadcastGameState(io, game);

              setTimeout(() => {
                advanceGameFlow(io, game);
              }, 3000);
            }, 5000);
          } else {
            setTimeout(() => {
              broadcastGameState(io, game);
            }, 5000);
          }
        } else {
          broadcastGameState(io, game);
        }

        io.to(playerId).emit('hand-updated', { hand: game.hands[playerId] });
      }
    }
  }
}

function broadcastGameState(io, game) {
  for (const [playerId] of game.players) {
    const state = game.getStateForPlayer(playerId);
    io.to(playerId).emit('game-state', state);
  }
  scheduleTurnTimer(io, game);
}

function broadcastToGame(io, game, event, data) {
  for (const [playerId] of game.players) {
    io.to(playerId).emit(event, data);
  }
}

// ---------------------------------------------------------------------------
// Auto-advance game flow
// ---------------------------------------------------------------------------

async function advanceGameFlow(io, game) {
  switch (game.gameState) {
    case GAME_STATES.ROUND_RESULTS: {
      // After showing results, check eliminations
      const eliminationResult = game.checkEliminations();
      broadcastToGame(io, game, 'elimination-check', eliminationResult);
      broadcastGameState(io, game);

      if (eliminationResult.gameOver) {
        broadcastToGame(io, game, 'game-over', {
          winner: eliminationResult.winner,
          roundHistory: game.roundHistory,
        });
        return;
      }

      // Small delay then advance to next round
      setTimeout(() => {
        const nextRoundInfo = game.advanceToNextRound();
        broadcastToGame(io, game, 'next-round', nextRoundInfo);

        // Auto-setup next round
        setTimeout(() => {
          startRound(io, game);
        }, 500);
      }, 1500);
      break;
    }
  }
}

function startRound(io, game) {
  const roundInfo = game.setupRound();
  broadcastToGame(io, game, 'round-started', roundInfo);

  // Deal cards
  const { hands } = game.dealCards();

  // Send hands privately (respecting blind bid)
  for (const playerId of game.activePlayers) {
    const isBlind = game.blindBidPlayers.has(playerId);
    io.to(playerId).emit('cards-dealt', {
      hand: isBlind ? null : hands[playerId],
      isBlind,
      cardsPerPlayer: game.cardsPerPlayer,
    });
  }

  // Broadcast bidding state
  broadcastGameState(io, game);
}

// ---------------------------------------------------------------------------
// Socket Handler Registration
// ---------------------------------------------------------------------------

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Katrazado] Player connected: ${socket.id}`);

    // -----------------------------------------------------------------------
    // CREATE GAME
    // -----------------------------------------------------------------------
    socket.on('create-game', ({ playerName, initialLives }, callback) => {
      // Generate unique code
      let code;
      do {
        code = generateGameCode();
      } while (games.has(code));

      const game = new Game(code, socket.id, playerName, initialLives || 5);
      games.set(code, game);
      playerGames.set(socket.id, code);
      socket.join(code);

      console.log(`[Katrazado] Game created: ${code} by ${playerName}`);

      const response = {
        success: true,
        gameId: code,
        state: game.getStateForPlayer(socket.id),
      };

      if (callback) callback(response);
    });

    // -----------------------------------------------------------------------
    // JOIN GAME
    // -----------------------------------------------------------------------
    socket.on('join-game', ({ gameId, playerName }, callback) => {
      const code = gameId.toUpperCase().trim();
      const game = games.get(code);

      if (!game) {
        if (callback) callback({ success: false, reason: 'Sala não encontrada.' });
        return;
      }

      const result = game.addPlayer(socket.id, playerName);
      if (!result.success) {
        if (callback) callback({ success: false, reason: result.reason });
        return;
      }

      playerGames.set(socket.id, code);
      socket.join(code);

      console.log(`[Katrazado] ${playerName} joined game: ${code}`);

      // Notify all players
      broadcastToGame(io, game, 'player-joined', {
        playerId: socket.id,
        playerName,
        players: game.getPlayerList(),
      });

      if (callback) {
        callback({
          success: true,
          gameId: code,
          state: game.getStateForPlayer(socket.id),
        });
      }
    });

    // -----------------------------------------------------------------------
    // START GAME
    // -----------------------------------------------------------------------
    socket.on('start-game', (_, callback) => {
      const game = getGame(socket.id);
      if (!game) {
        if (callback) callback({ success: false, reason: 'Não estás numa sala.' });
        return;
      }
      if (socket.id !== game.hostId) {
        if (callback) callback({ success: false, reason: 'Apenas o anfitrião pode iniciar.' });
        return;
      }

      const result = game.startGame();
      if (!result.success) {
        if (callback) callback({ success: false, reason: result.reason });
        return;
      }

      console.log(`[Katrazado] Game started: ${game.gameId}`);

      broadcastToGame(io, game, 'game-started', {
        players: game.getPlayerList(),
        initialLives: game.initialLives,
      });

      // Start first round
      setTimeout(() => {
        startRound(io, game);
      }, 500);

      if (callback) callback({ success: true });
    });

    // -----------------------------------------------------------------------
    // PLACE BID
    // -----------------------------------------------------------------------
    socket.on('place-bid', ({ bid }, callback) => {
      const game = getGame(socket.id);
      if (!game) {
        if (callback) callback({ success: false, reason: 'Não estás numa sala.' });
        return;
      }

      const result = game.placeBid(socket.id, bid);
      if (!result.success) {
        if (callback) callback({ success: false, reason: result.reason });
        return;
      }

      console.log(`[Katrazado] ${game.getPlayerName(socket.id)} bid ${bid} (blind: ${result.wasBlind})`);

      // Notify all players about the bid
      broadcastToGame(io, game, 'bid-placed', {
        playerId: socket.id,
        playerName: game.getPlayerName(socket.id),
        bid,
        wasBlind: result.wasBlind,
      });

      // If blind player, send them their revealed cards
      if (result.wasBlind && result.hand) {
        io.to(socket.id).emit('cards-revealed', { hand: result.hand });
      }

      // Update everyone's state
      broadcastGameState(io, game);

      if (result.biddingComplete) {
        broadcastToGame(io, game, 'bidding-complete', {
          bids: Object.entries(game.bids).map(([id, b]) => ({
            playerId: id,
            playerName: game.getPlayerName(id),
            bid: b,
          })),
        });
      }

      if (callback) callback({ success: true, bid });
    });

    // -----------------------------------------------------------------------
    // PLAY CARD
    // -----------------------------------------------------------------------
    socket.on('play-card', ({ card }, callback) => {
      const game = getGame(socket.id);
      if (!game) {
        if (callback) callback({ success: false, reason: 'Não estás numa sala.' });
        return;
      }

      const result = game.playCard(socket.id, card);
      if (!result.success) {
        if (callback) callback({ success: false, reason: result.reason });
        return;
      }

      console.log(`[Katrazado] ${game.getPlayerName(socket.id)} played ${card.value} ${card.suit}`);

      // Notify all players about the card played
      broadcastToGame(io, game, 'card-played', {
        playerId: socket.id,
        playerName: game.getPlayerName(socket.id),
        card,
      });

      if (result.trickComplete) {
        // Broadcast trick result
        broadcastToGame(io, game, 'trick-resolved', {
          trickNumber: result.trickNumber,
          cardsPlayed: result.cardsPlayed,
          winnerId: result.winnerId,
          winnerName: result.winnerName,
          winningCard: result.winningCard,
        });

        if (result.roundComplete) {
          // Evaluate round and show results
          setTimeout(() => {
            const roundResults = game.evaluateRound();
            broadcastToGame(io, game, 'round-results', roundResults);
            broadcastGameState(io, game);

            // Auto-advance after showing results
            setTimeout(() => {
              advanceGameFlow(io, game);
            }, 3000);
          }, 5000);
        } else {
          // More tricks to play — update state after 5 seconds so players can see all cards
          setTimeout(() => {
            broadcastGameState(io, game);
          }, 5000);
        }
      } else {
        // Update state for next player
        broadcastGameState(io, game);
      }

      // Send updated hand to the player
      io.to(socket.id).emit('hand-updated', { hand: game.hands[socket.id] });

      if (callback) callback({ success: true });
    });

    // -----------------------------------------------------------------------
    // REQUEST STATE (for reconnection)
    // -----------------------------------------------------------------------
    socket.on('request-state', (_, callback) => {
      const game = getGame(socket.id);
      if (!game) {
        if (callback) callback({ success: false, reason: 'Não estás numa sala.' });
        return;
      }

      if (callback) {
        callback({
          success: true,
          state: game.getStateForPlayer(socket.id),
        });
      }
    });

    // -----------------------------------------------------------------------
    // DISCONNECT
    // -----------------------------------------------------------------------
    socket.on('disconnect', () => {
      console.log(`[Katrazado] Player disconnected: ${socket.id}`);

      const game = getGame(socket.id);
      if (game) {
        const result = game.removePlayer(socket.id);

        if (result.removed) {
          // Player fully removed (lobby)
          playerGames.delete(socket.id);

          broadcastToGame(io, game, 'player-left', {
            playerId: socket.id,
            players: game.getPlayerList(),
          });

          // Clean up empty games
          if (game.players.size === 0) {
            games.delete(game.gameId);
            console.log(`[Katrazado] Game ${game.gameId} deleted (empty)`);
          }
        } else {
          // Player disconnected mid-game
          broadcastToGame(io, game, 'player-disconnected', {
            playerId: socket.id,
            playerName: game.getPlayerName(socket.id),
          });
        }
      }
    });
  });
}

module.exports = { registerSocketHandlers, games };
