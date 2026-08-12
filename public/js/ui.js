// =============================================================================
// Katrazado — UI Renderer
// =============================================================================
// All DOM manipulation and rendering logic.
// =============================================================================

'use strict';

const UI = (() => {
  // Suit symbols and colors
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

  // Short value display
  const VALUE_SHORT = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    'Dama': 'D', 'Valete': 'V', 'Rei': 'R', '7': '7', 'Ás': 'A',
  };

  // =========================================================================
  // Card Rendering
  // =========================================================================

  function createCardElement(card, options = {}) {
    const { clickable = false, onClick = null, disabled = false, cancelled = false, winner = false } = options;

    const el = document.createElement('div');
    const colorClass = SUIT_COLORS[card.suit] || 'black';
    let classes = `card ${colorClass}`;
    if (disabled) classes += ' disabled';
    if (cancelled) classes += ' cancelled';
    if (winner) classes += ' winner';
    el.className = classes;

    const shortValue = VALUE_SHORT[card.value] || card.value;
    const suitSymbol = SUIT_SYMBOLS[card.suit] || card.suit;

    el.innerHTML = `
      <div class="card-corner card-corner-top">
        <span>${shortValue}</span>
        <span class="corner-suit">${suitSymbol}</span>
      </div>
      <span class="card-value">${shortValue}</span>
      <span class="card-suit">${suitSymbol}</span>
      <div class="card-corner card-corner-bottom">
        <span>${shortValue}</span>
        <span class="corner-suit">${suitSymbol}</span>
      </div>
    `;

    if (clickable && !disabled && onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => onClick(card));
    }

    return el;
  }

  function createCardBackElement() {
    const el = document.createElement('div');
    el.className = 'card card-back';
    return el;
  }

  // =========================================================================
  // Screen Management
  // =========================================================================

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 5000);
    }
  }

  // =========================================================================
  // Lobby
  // =========================================================================

  function updateLobby(state) {
    const codeEl = document.getElementById('lobby-game-code');
    if (codeEl) codeEl.textContent = state.gameId;

    const countEl = document.getElementById('player-count-lobby');
    if (countEl) countEl.textContent = `(${state.players.length}/8)`;

    const listEl = document.getElementById('players-list-lobby');
    if (listEl) {
      listEl.innerHTML = state.players.map(p => `
        <li>
          <span class="player-name">${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="player-badge">Anfitrião</span>' : ''}
        </li>
      `).join('');
    }

    // Enable/disable start button
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.disabled = !state.isHost || state.players.length < 3;
      if (!state.isHost) {
        startBtn.textContent = 'A aguardar o anfitrião...';
      }
    }
  }

  // =========================================================================
  // Players Bar (in-game)
  // =========================================================================

  function updatePlayersBar(state) {
    const bar = document.getElementById('players-bar');
    if (!bar) return;

    bar.innerHTML = '';

    // Show all players (active + eliminated)
    const allPlayers = state.players || [];

    for (const player of allPlayers) {
      const chip = document.createElement('div');
      let chipClass = 'player-chip';
      if (player.eliminated) chipClass += ' eliminated';
      if (state.currentPlayer === player.id) chipClass += ' active-turn';

      // Check if blind
      const isBlind = state.blindBidPlayers &&
        state.blindBidPlayers.some(bp => bp.id === player.id) &&
        state.gameState === 'BIDDING';
      if (isBlind) chipClass += ' blind-indicator';

      chip.className = chipClass;

      const lives = player.lives || 0;
      const hearts = player.eliminated ? '💀' : '❤️'.repeat(Math.min(lives, 5)) + (lives > 5 ? `+${lives - 5}` : '');

      // Bid and tricks info
      let infoHtml = '';
      if (state.bids && state.bids[player.id] !== undefined) {
        const bid = state.bids[player.id].bid;
        const tricks = state.tricksWon && state.tricksWon[player.id] ? state.tricksWon[player.id].count : 0;
        infoHtml = `<span class="player-chip-info">P:${bid} V:${tricks}</span>`;
      }

      chip.innerHTML = `
        <span class="player-chip-name">${escapeHtml(player.name)}</span>
        <span class="player-chip-lives">${hearts}</span>
        ${player.eliminated ? '<span class="player-chip-eliminated">ELIMINADO</span>' : infoHtml}
      `;

      bar.appendChild(chip);
    }
  }

  let timerInterval = null;

  function updateTurnBanner(state) {
    const banner = document.getElementById('turn-banner');
    const textEl = document.getElementById('turn-banner-text');
    const timerSecs = document.getElementById('timer-seconds');
    const timerBox = document.getElementById('turn-timer');
    const fillEl = document.getElementById('turn-progress-fill');

    if (!banner || !textEl) return;

    if (state.gameState !== 'BIDDING' && state.gameState !== 'TRICK_PLAY') {
      banner.classList.add('hidden');
      if (timerInterval) clearInterval(timerInterval);
      return;
    }

    banner.classList.remove('hidden');

    const actionText = state.gameState === 'BIDDING' ? 'DECLARAR' : 'JOGAR';

    if (state.isMyTurn) {
      banner.className = 'turn-banner my-turn';
      textEl.textContent = `✨ É A TUA VEZ DE ${actionText}!`;
    } else {
      banner.className = 'turn-banner other-turn';
      textEl.textContent = `A aguardar por ${escapeHtml(state.currentPlayerName || '---')}...`;
    }

    if (timerInterval) clearInterval(timerInterval);

    const startTime = state.turnStartTime || Date.now();
    const durationSecs = state.turnDuration || 12;

    function tick() {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, Math.ceil(durationSecs - elapsed));

      if (timerSecs) timerSecs.textContent = remaining;

      const pct = Math.max(0, Math.min(100, ((durationSecs - elapsed) / durationSecs) * 100));
      if (fillEl) fillEl.style.width = `${pct}%`;

      if (timerBox) {
        if (remaining <= 4) {
          timerBox.classList.add('warning');
        } else {
          timerBox.classList.remove('warning');
        }
      }

      if (remaining <= 0 && timerInterval) {
        clearInterval(timerInterval);
      }
    }

    tick();
    timerInterval = setInterval(tick, 200);
  }

  // =========================================================================
  // Game State Rendering
  // =========================================================================

  function updateGameScreen(state) {
    // Round info
    const roundNumEl = document.getElementById('round-number');
    if (roundNumEl) roundNumEl.textContent = state.currentRound || '-';

    const cardsEl = document.getElementById('cards-per-player');
    if (cardsEl) cardsEl.textContent = state.cardsPerPlayer || '-';

    // Players bar
    updatePlayersBar(state);

    // Turn indicator
    const turnIndicator = document.getElementById('turn-indicator');
    const turnName = document.getElementById('turn-player-name');
    if (turnIndicator && turnName) {
      if (state.currentPlayer && (state.gameState === 'BIDDING' || state.gameState === 'TRICK_PLAY')) {
        turnIndicator.classList.remove('hidden');
        const label = state.gameState === 'BIDDING' ? 'Declara:' : 'Joga:';
        document.querySelector('.turn-label').textContent = label;
        turnName.textContent = state.currentPlayerName || '---';
      } else {
        turnIndicator.classList.add('hidden');
      }
    }

    // Blind bid warning
    const blindWarning = document.getElementById('blind-bid-warning');
    if (blindWarning) {
      if (state.isBlind && state.gameState === 'BIDDING' && state.isMyTurn) {
        blindWarning.classList.remove('hidden');
      } else {
        blindWarning.classList.add('hidden');
      }
    }

    // Turn banner & 12s timer
    updateTurnBanner(state);

    // Render hand
    renderHand(state);

    // Render game center based on state
    renderGameCenter(state);
  }

  // =========================================================================
  // Hand Rendering
  // =========================================================================

  function renderHand(state) {
    const handContainer = document.getElementById('hand-cards');
    if (!handContainer) return;

    handContainer.innerHTML = '';

    if (state.isBlind && state.gameState === 'BIDDING' && !state.bids[state.myId]) {
      // Show card backs for blind player who hasn't bid yet
      for (let i = 0; i < (state.handSize || state.cardsPerPlayer); i++) {
        handContainer.appendChild(createCardBackElement());
      }
      return;
    }

    if (!state.myHand || state.myHand.length === 0) return;

    const canPlay = state.gameState === 'TRICK_PLAY' && state.isMyTurn;

    state.myHand.forEach(card => {
      const cardEl = createCardElement(card, {
        clickable: canPlay,
        disabled: !canPlay,
        onClick: canPlay ? (c) => {
          if (typeof window.onCardPlayed === 'function') {
            window.onCardPlayed(c);
          }
        } : null,
      });
      handContainer.appendChild(cardEl);
    });
  }

  // =========================================================================
  // Game Center
  // =========================================================================

  function renderGameCenter(state) {
    const biddingArea = document.getElementById('bidding-area');
    const trickArea = document.getElementById('trick-area');

    if (state.gameState === 'BIDDING') {
      renderBiddingArea(state);
      if (biddingArea) biddingArea.classList.remove('hidden');
      if (trickArea) trickArea.innerHTML = '';
    } else if (state.gameState === 'TRICK_PLAY') {
      if (biddingArea) biddingArea.classList.add('hidden');
      renderTrickArea(state);
    } else {
      if (biddingArea) biddingArea.classList.add('hidden');
    }
  }

  // =========================================================================
  // Bidding Area
  // =========================================================================

  function renderBiddingArea(state) {
    const buttonsContainer = document.getElementById('bid-buttons');
    const forbiddenEl = document.getElementById('bid-forbidden');
    const biddingArea = document.getElementById('bidding-area');

    if (!buttonsContainer || !biddingArea) return;

    // Only show bid buttons if it's my turn to bid
    if (!state.isMyTurn || state.bids[state.myId] !== undefined) {
      if (state.bids[state.myId] !== undefined) {
        // Already bid — show confirmation
        biddingArea.classList.remove('hidden');
        buttonsContainer.innerHTML = `
          <div style="text-align:center;padding:16px;">
            <p style="color:var(--text-secondary);font-size:0.9rem;">Previsão registada</p>
            <p style="font-size:2rem;font-weight:800;color:var(--accent-gold);margin-top:8px;">${state.bids[state.myId].bid}</p>
          </div>
        `;
        if (forbiddenEl) forbiddenEl.classList.add('hidden');
      } else {
        // Waiting for others
        biddingArea.classList.remove('hidden');
        buttonsContainer.innerHTML = `
          <div style="text-align:center;padding:16px;">
            <p style="color:var(--text-secondary);font-size:0.9rem;">A aguardar...</p>
            <p style="color:var(--text-primary);font-weight:600;margin-top:4px;">${state.currentPlayerName || '---'}</p>
          </div>
        `;
        if (forbiddenEl) forbiddenEl.classList.add('hidden');
      }
      return;
    }

    // Determine forbidden bid
    let forbiddenBid = null;
    if (state.bidding && state.bidding.forbiddenBid !== null && state.bidding.forbiddenBid !== undefined) {
      forbiddenBid = state.bidding.forbiddenBid;
    }

    buttonsContainer.innerHTML = '';

    for (let i = 0; i <= state.cardsPerPlayer; i++) {
      const btn = document.createElement('button');
      btn.className = 'bid-btn';
      btn.textContent = i;

      if (forbiddenBid !== null && i === forbiddenBid) {
        btn.classList.add('forbidden');
        btn.disabled = true;
      }

      btn.addEventListener('click', () => {
        if (typeof window.onBidPlaced === 'function') {
          window.onBidPlaced(i);
        }
      });

      buttonsContainer.appendChild(btn);
    }

    // Show forbidden info
    if (forbiddenEl) {
      if (forbiddenBid !== null) {
        forbiddenEl.textContent = `Não podes declarar ${forbiddenBid} (soma seria igual ao nº de vazas)`;
        forbiddenEl.classList.remove('hidden');
      } else {
        forbiddenEl.classList.add('hidden');
      }
    }
  }

  // =========================================================================
  // Trick Area
  // =========================================================================

  function renderTrickArea(state) {
    const trickArea = document.getElementById('trick-area');
    if (!trickArea) return;

    trickArea.innerHTML = '';

    if (state.currentTrick && state.currentTrick.length > 0) {
      state.currentTrick.forEach(play => {
        const wrapper = document.createElement('div');
        wrapper.className = 'trick-card-wrapper';

        const nameLabel = document.createElement('span');
        nameLabel.className = 'trick-card-player';
        nameLabel.textContent = play.playerName;

        const cardEl = createCardElement(play.card);

        wrapper.appendChild(nameLabel);
        wrapper.appendChild(cardEl);
        trickArea.appendChild(wrapper);
      });
    } else {
      // Show empty state with trick info
      if (state.trickPlay) {
        trickArea.innerHTML = `
          <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;">
            <p>Vaza ${state.trickPlay.trickNumber} de ${state.trickPlay.totalTricks}</p>
          </div>
        `;
      }
    }
  }

  // =========================================================================
  // Trick Result
  // =========================================================================

  function showTrickResult(data) {
    const overlay = document.getElementById('trick-result');
    const text = document.getElementById('trick-result-text');
    if (!overlay || !text) return;

    text.textContent = `${data.winnerName} ganha a vaza!`;
    overlay.classList.remove('hidden');

    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 1800);
  }

  // =========================================================================
  // Round Results
  // =========================================================================

  function showRoundResults(data) {
    const overlay = document.getElementById('round-results-overlay');
    const table = document.getElementById('round-results-table');
    if (!overlay || !table) return;

    table.innerHTML = data.results.map(r => {
      const rowClass = r.bidCorrect ? 'correct' : 'wrong';
      const icon = r.bidCorrect ? '✅' : '❌';
      const blindTag = r.wasBlind ? ' 🙈' : '';
      return `
        <div class="result-row ${rowClass}">
          <div>
            <span class="result-player">${icon} ${escapeHtml(r.playerName)}${blindTag}</span>
          </div>
          <div class="result-details">
            <div class="result-bid-info">
              <span>Previsão: ${r.bid} | Vazas: ${r.tricksWon}</span>
              <span class="result-lives">${r.bidCorrect ? 'Mantém vidas' : '-1 vida'} → ${'❤️'.repeat(Math.max(0, r.livesRemaining))}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    overlay.classList.remove('hidden');

    // Auto-hide after delay
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 4500);
  }

  // =========================================================================
  // Elimination
  // =========================================================================

  function showElimination(data) {
    if (!data.eliminated || data.eliminated.length === 0) return;

    const overlay = document.getElementById('elimination-overlay');
    const details = document.getElementById('elimination-details');
    if (!overlay || !details) return;

    details.innerHTML = data.eliminated.map(p => `
      <p class="eliminated-player-name">${escapeHtml(p.playerName)}</p>
    `).join('') + '<p style="color:var(--text-secondary);margin-top:16px;">Eliminado(s) do jogo!</p>';

    overlay.classList.remove('hidden');

    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 2500);
  }

  // =========================================================================
  // Game Over
  // =========================================================================

  function showGameOver(data) {
    showScreen('screen-gameover');

    const winnerEl = document.getElementById('gameover-winner');
    if (winnerEl && data.winner) {
      winnerEl.textContent = `🏆 ${data.winner.playerName}`;
    }

    const statsEl = document.getElementById('gameover-stats');
    if (statsEl && data.roundHistory) {
      statsEl.innerHTML = `
        <div class="stat-row">
          <span class="stat-name">Total de rondas</span>
          <span class="stat-value">${data.roundHistory.length}</span>
        </div>
      `;
    }
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    showScreen,
    showError,
    updateLobby,
    updatePlayersBar,
    updateGameScreen,
    renderHand,
    renderBiddingArea,
    renderTrickArea,
    showTrickResult,
    showRoundResults,
    showElimination,
    showGameOver,
    createCardElement,
    createCardBackElement,
    escapeHtml,
  };
})();
