// =============================================================================
// Katrazado — Main App Controller
// =============================================================================
// Orchestrates screen transitions, user interactions, and socket events.
// =============================================================================

'use strict';

(function () {
  // =========================================================================
  // State
  // =========================================================================

  let currentState = null;
  let myId = null;
  let previousScreen = 'screen-home';

  // =========================================================================
  // Initialize
  // =========================================================================

  function init() {
    // Connect socket
    SocketClient.connect();

    // Register socket event handlers
    SocketClient.on({
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onGameState: handleGameState,
      onPlayerJoined: handlePlayerJoined,
      onPlayerLeft: handlePlayerLeft,
      onGameStarted: handleGameStarted,
      onRoundStarted: handleRoundStarted,
      onCardsDealt: handleCardsDealt,
      onCardsRevealed: handleCardsRevealed,
      onBidPlaced: handleBidPlaced,
      onBiddingComplete: handleBiddingComplete,
      onCardPlayed: handleCardPlayed,
      onHandUpdated: handleHandUpdated,
      onTrickResolved: handleTrickResolved,
      onRoundResults: handleRoundResults,
      onEliminationCheck: handleEliminationCheck,
      onNextRound: handleNextRound,
      onGameOver: handleGameOver,
    });

    // Register UI event handlers
    bindUIEvents();

    // Render rules content
    if (typeof renderRulesContent === 'function') {
      renderRulesContent();
    }

    // Expose card play callback
    window.onCardPlayed = handlePlayCard;
    window.onBidPlaced = handlePlaceBid;
  }

  // =========================================================================
  // UI Event Binding
  // =========================================================================

  function bindUIEvents() {
    // Home screen
    const createBtn = document.getElementById('btn-create-game');
    const joinBtn = document.getElementById('btn-join-game');
    const rulesBtn = document.getElementById('btn-show-rules');
    const nameInput = document.getElementById('player-name-input');

    if (createBtn) createBtn.addEventListener('click', handleCreateGame);
    if (joinBtn) joinBtn.addEventListener('click', handleJoinGame);
    if (rulesBtn) rulesBtn.addEventListener('click', () => showRules('screen-home'));

    // Enter key on inputs
    if (nameInput) {
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const codeInput = document.getElementById('game-code-input');
          if (codeInput && codeInput.value.trim()) {
            handleJoinGame();
          } else {
            handleCreateGame();
          }
        }
      });
    }

    const codeInput = document.getElementById('game-code-input');
    if (codeInput) {
      codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoinGame();
      });
    }

    // Lobby
    const startBtn = document.getElementById('btn-start-game');
    const leaveBtn = document.getElementById('btn-leave-lobby');
    const copyBtn = document.getElementById('btn-copy-code');

    if (startBtn) startBtn.addEventListener('click', handleStartGame);
    if (leaveBtn) leaveBtn.addEventListener('click', handleLeaveLobby);
    if (copyBtn) copyBtn.addEventListener('click', handleCopyCode);

    // Game screen rules
    const rulesGameBtn = document.getElementById('btn-show-rules-game');
    if (rulesGameBtn) rulesGameBtn.addEventListener('click', () => showRules('screen-game'));

    // Rules close
    const closeRulesBtn = document.getElementById('btn-close-rules');
    if (closeRulesBtn) closeRulesBtn.addEventListener('click', hideRules);

    // Game over
    const backHomeBtn = document.getElementById('btn-back-home');
    if (backHomeBtn) backHomeBtn.addEventListener('click', () => {
      UI.showScreen('screen-home');
      currentState = null;
    });
  }

  // =========================================================================
  // Rules
  // =========================================================================

  function showRules(from) {
    previousScreen = from;
    UI.showScreen('screen-rules');
  }

  function hideRules() {
    UI.showScreen(previousScreen);
  }

  // =========================================================================
  // Socket Event Handlers
  // =========================================================================

  function handleConnect(id) {
    myId = id;
    console.log('[App] Connected as:', id);
  }

  function handleDisconnect(reason) {
    console.log('[App] Disconnected:', reason);
  }

  function handleGameState(state) {
    currentState = state;
    myId = state.myId;

    // Route to appropriate screen based on game state
    switch (state.gameState) {
      case 'LOBBY':
        UI.showScreen('screen-lobby');
        UI.updateLobby(state);
        break;

      case 'ROUND_SETUP':
      case 'DEALING':
      case 'BIDDING':
      case 'TRICK_PLAY':
      case 'ROUND_RESULTS':
      case 'ELIMINATION_CHECK':
      case 'NEXT_ROUND':
        UI.showScreen('screen-game');
        UI.updateGameScreen(state);
        break;

      case 'GAME_OVER':
        // Handled by game-over event
        break;
    }
  }

  function handlePlayerJoined(data) {
    if (currentState) {
      currentState.players = data.players;
      UI.updateLobby(currentState);
    }
  }

  function handlePlayerLeft(data) {
    if (currentState) {
      currentState.players = data.players;
      UI.updateLobby(currentState);
    }
  }

  function handleGameStarted(data) {
    console.log('[App] Game started!', data);
    UI.showScreen('screen-game');
  }

  function handleRoundStarted(data) {
    console.log('[App] Round started:', data);
    // Hide any lingering overlays
    hideAllOverlays();
  }

  function handleCardsDealt(data) {
    console.log('[App] Cards dealt. Blind:', data.isBlind);
    if (currentState) {
      if (data.isBlind) {
        currentState.isBlind = true;
        currentState.myHand = null;
        currentState.handSize = data.cardsPerPlayer;
      } else {
        currentState.isBlind = false;
        currentState.myHand = data.hand;
      }
    }
  }

  function handleCardsRevealed(data) {
    console.log('[App] Cards revealed (blind bid complete)');
    if (currentState) {
      currentState.myHand = data.hand;
      currentState.isBlind = false;
      UI.updateGameScreen(currentState);
    }
  }

  function handleBidPlaced(data) {
    console.log(`[App] ${data.playerName} bid ${data.bid}${data.wasBlind ? ' (blind)' : ''}`);
  }

  function handleBiddingComplete(data) {
    console.log('[App] All bids placed:', data.bids);
  }

  function handleCardPlayed(data) {
    console.log(`[App] ${data.playerName} played ${data.card.value} ${data.card.suit}`);
  }

  function handleHandUpdated(data) {
    if (currentState) {
      currentState.myHand = data.hand;
    }
  }

  function handleTrickResolved(data) {
    console.log(`[App] Trick ${data.trickNumber} won by ${data.winnerName}`);
    UI.showTrickResult(data);
  }

  function handleRoundResults(data) {
    console.log('[App] Round results:', data);
    UI.showRoundResults(data);
  }

  function handleEliminationCheck(data) {
    console.log('[App] Elimination check:', data);
    if (data.eliminated && data.eliminated.length > 0) {
      UI.showElimination(data);
    }
  }

  function handleNextRound(data) {
    console.log('[App] Next round:', data);
  }

  function handleGameOver(data) {
    console.log('[App] Game over! Winner:', data.winner);
    UI.showGameOver(data);
  }

  // =========================================================================
  // User Actions
  // =========================================================================

  function handleCreateGame() {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      UI.showError('home-error', 'Escreve o teu nome primeiro!');
      return;
    }

    if (name.length < 2) {
      UI.showError('home-error', 'O nome deve ter pelo menos 2 caracteres.');
      return;
    }

    SocketClient.emit('create-game', { playerName: name }, (response) => {
      if (response.success) {
        currentState = response.state;
        UI.showScreen('screen-lobby');
        UI.updateLobby(currentState);
      } else {
        UI.showError('home-error', response.reason || 'Erro ao criar sala.');
      }
    });
  }

  function handleJoinGame() {
    const nameInput = document.getElementById('player-name-input');
    const codeInput = document.getElementById('game-code-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

    if (!name) {
      UI.showError('home-error', 'Escreve o teu nome primeiro!');
      return;
    }

    if (name.length < 2) {
      UI.showError('home-error', 'O nome deve ter pelo menos 2 caracteres.');
      return;
    }

    if (!code) {
      UI.showError('home-error', 'Escreve o código da sala!');
      return;
    }

    SocketClient.emit('join-game', { gameId: code, playerName: name }, (response) => {
      if (response.success) {
        currentState = response.state;
        UI.showScreen('screen-lobby');
        UI.updateLobby(currentState);
      } else {
        UI.showError('home-error', response.reason || 'Erro ao entrar na sala.');
      }
    });
  }

  function handleStartGame() {
    SocketClient.emit('start-game', {}, (response) => {
      if (!response.success) {
        UI.showError('lobby-error', response.reason || 'Erro ao iniciar jogo.');
      }
    });
  }

  function handleLeaveLobby() {
    // Just disconnect and reconnect
    window.location.reload();
  }

  function handleCopyCode() {
    const code = document.getElementById('lobby-game-code');
    if (code) {
      navigator.clipboard.writeText(code.textContent).then(() => {
        const btn = document.getElementById('btn-copy-code');
        if (btn) {
          const original = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = original; }, 1500);
        }
      }).catch(() => {
        // Fallback: select text
        const range = document.createRange();
        range.selectNodeContents(code);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
    }
  }

  function handlePlaceBid(bid) {
    SocketClient.emit('place-bid', { bid }, (response) => {
      if (!response.success) {
        console.warn('[App] Bid failed:', response.reason);
      }
    });
  }

  function handlePlayCard(card) {
    SocketClient.emit('play-card', { card }, (response) => {
      if (!response.success) {
        console.warn('[App] Play card failed:', response.reason);
      }
    });
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    const trickResult = document.getElementById('trick-result');
    if (trickResult) trickResult.classList.add('hidden');
  }

  // =========================================================================
  // Start
  // =========================================================================

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
