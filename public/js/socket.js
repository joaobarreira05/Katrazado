// =============================================================================
// Katrazado — Socket.IO Client
// =============================================================================
// Manages the WebSocket connection and event binding.
// =============================================================================

'use strict';

const SocketClient = (() => {
  let socket = null;
  let eventHandlers = {};

  function connect() {
    socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Katrazado] Connected:', socket.id);
      if (eventHandlers.onConnect) eventHandlers.onConnect(socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Katrazado] Disconnected:', reason);
      if (eventHandlers.onDisconnect) eventHandlers.onDisconnect(reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Katrazado] Connection error:', err.message);
    });

    // --- Game Events ---

    socket.on('game-state', (state) => {
      if (eventHandlers.onGameState) eventHandlers.onGameState(state);
    });

    socket.on('player-joined', (data) => {
      if (eventHandlers.onPlayerJoined) eventHandlers.onPlayerJoined(data);
    });

    socket.on('player-left', (data) => {
      if (eventHandlers.onPlayerLeft) eventHandlers.onPlayerLeft(data);
    });

    socket.on('player-disconnected', (data) => {
      if (eventHandlers.onPlayerDisconnected) eventHandlers.onPlayerDisconnected(data);
    });

    socket.on('game-started', (data) => {
      if (eventHandlers.onGameStarted) eventHandlers.onGameStarted(data);
    });

    socket.on('round-started', (data) => {
      if (eventHandlers.onRoundStarted) eventHandlers.onRoundStarted(data);
    });

    socket.on('cards-dealt', (data) => {
      if (eventHandlers.onCardsDealt) eventHandlers.onCardsDealt(data);
    });

    socket.on('cards-revealed', (data) => {
      if (eventHandlers.onCardsRevealed) eventHandlers.onCardsRevealed(data);
    });

    socket.on('bid-placed', (data) => {
      if (eventHandlers.onBidPlaced) eventHandlers.onBidPlaced(data);
    });

    socket.on('bidding-complete', (data) => {
      if (eventHandlers.onBiddingComplete) eventHandlers.onBiddingComplete(data);
    });

    socket.on('card-played', (data) => {
      if (eventHandlers.onCardPlayed) eventHandlers.onCardPlayed(data);
    });

    socket.on('hand-updated', (data) => {
      if (eventHandlers.onHandUpdated) eventHandlers.onHandUpdated(data);
    });

    socket.on('trick-resolved', (data) => {
      if (eventHandlers.onTrickResolved) eventHandlers.onTrickResolved(data);
    });

    socket.on('round-results', (data) => {
      if (eventHandlers.onRoundResults) eventHandlers.onRoundResults(data);
    });

    socket.on('elimination-check', (data) => {
      if (eventHandlers.onEliminationCheck) eventHandlers.onEliminationCheck(data);
    });

    socket.on('next-round', (data) => {
      if (eventHandlers.onNextRound) eventHandlers.onNextRound(data);
    });

    socket.on('game-over', (data) => {
      if (eventHandlers.onGameOver) eventHandlers.onGameOver(data);
    });

    return socket;
  }

  function on(handlers) {
    eventHandlers = { ...eventHandlers, ...handlers };
  }

  function emit(event, data, callback) {
    if (socket && socket.connected) {
      socket.emit(event, data, callback);
    } else {
      console.warn('[Katrazado] Socket not connected, cannot emit:', event);
    }
  }

  function getId() {
    return socket ? socket.id : null;
  }

  function isConnected() {
    return socket && socket.connected;
  }

  return {
    connect,
    on,
    emit,
    getId,
    isConnected,
  };
})();
