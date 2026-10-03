// =============================================================================
// Katrazado — New Features Tests
// =============================================================================
// Tests:
// 1. Session token & player socket reconnection
// 2. Dynamic turn duration (reduced timer when only 1 card in hand)
// 3. Offline tracking & kick after 2 consecutive rounds offline
// =============================================================================

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Game, GAME_STATES } = require('../gameState');

describe('New Features — Session Persistence, Fast Turn & Inactivity Kick', () => {

  // =========================================================================
  // 1. Session Token and Socket Reconnection
  // =========================================================================
  describe('Session Token & Reconnection', () => {
    it('should assign unique sessionTokens to host and joining players', () => {
      const game = new Game('TEST1', 'socket_host', 'HostPlayer', 1, 5);
      const host = game.players.get('socket_host');
      assert.ok(host);
      assert.ok(host.sessionToken);
      assert.equal(typeof host.sessionToken, 'string');

      const joinResult = game.addPlayer('socket_p2', 'Player2', 2);
      assert.equal(joinResult.success, true);
      assert.ok(joinResult.sessionToken);
      assert.notEqual(host.sessionToken, joinResult.sessionToken);

      const p2 = game.players.get('socket_p2');
      assert.equal(p2.sessionToken, joinResult.sessionToken);
    });

    it('should update player socket ID seamlessly without losing game state', () => {
      const game = new Game('TEST2', 'sock_1', 'Alice', 1, 5);
      game.addPlayer('sock_2', 'Bob', 2);
      game.addPlayer('sock_3', 'Charlie', 3);

      game.startGame();
      game.setupRound();
      game.dealCards();

      // Ensure sock_2 has cards and lives
      assert.ok(game.hands['sock_2']);
      assert.equal(game.lives['sock_2'], 5);
      const originalHand = [...game.hands['sock_2']];

      // Simulate sock_2 disconnecting and reconnecting with new socket 'sock_2_new'
      game.removePlayer('sock_2');
      assert.equal(game.players.get('sock_2').connected, false);

      const updated = game.updatePlayerSocketId('sock_2', 'sock_2_new');
      assert.equal(updated, true);

      // Verify old socket is gone and new socket exists
      assert.equal(game.players.has('sock_2'), false);
      assert.equal(game.players.has('sock_2_new'), true);

      // Verify player attributes
      const player = game.players.get('sock_2_new');
      assert.equal(player.id, 'sock_2_new');
      assert.equal(player.name, 'Bob');
      assert.equal(player.connected, true);
      assert.equal(player.offlineRounds, 0);

      // Verify hands and lives preserved
      assert.deepEqual(game.hands['sock_2_new'], originalHand);
      assert.equal(game.hands['sock_2'], undefined);
      assert.equal(game.lives['sock_2_new'], 5);
      assert.equal(game.lives['sock_2'], undefined);

      // Verify order lists updated
      assert.ok(game.playerOrder.includes('sock_2_new'));
      assert.ok(!game.playerOrder.includes('sock_2'));
      assert.ok(game.activePlayers.includes('sock_2_new'));
      assert.ok(!game.activePlayers.includes('sock_2'));

      // Verify getStateForPlayer works for new socket
      const state = game.getStateForPlayer('sock_2_new');
      assert.equal(state.myId, 'sock_2_new');
      assert.equal(state.myName, 'Bob');
      assert.deepEqual(state.myHand, originalHand);
    });

    it('should update hostId when host reconnects with new socket', () => {
      const game = new Game('TEST3', 'host_old', 'HostMan', 1, 5);
      assert.equal(game.hostId, 'host_old');

      game.updatePlayerSocketId('host_old', 'host_new');
      assert.equal(game.hostId, 'host_new');

      const state = game.getStateForPlayer('host_new');
      assert.equal(state.isHost, true);
    });
  });

  // =========================================================================
  // 2. Dynamic Turn Duration (Reduced timer when 1 card in hand)
  // =========================================================================
  describe('Dynamic Turn Duration', () => {
    it('should return 6s turn duration when in TRICK_PLAY and player has only 1 card', () => {
      const game = new Game('TEST4', 's1', 'Player1', 1, 5);
      game.addPlayer('s2', 'Player2', 2);
      game.addPlayer('s3', 'Player3', 3);

      game.startGame();
      game.setupRound(); // 1 card round
      game.dealCards();

      // In round 1, cardsPerPlayer is 1, so hands have 1 card
      assert.equal(game.hands['s1'].length, 1);

      // Transition to TRICK_PLAY (sum of bids cannot equal 1)
      game.placeBid(game.trickPlayOrder[0], 0);
      game.placeBid(game.trickPlayOrder[1], 0);
      const bidRes = game.placeBid(game.trickPlayOrder[2], 0);
      assert.equal(bidRes.success, true);
      assert.equal(game.gameState, GAME_STATES.TRICK_PLAY);

      // Current player has only 1 card left in hand!
      const current = game.currentPlayer;
      assert.equal(game.hands[current].length, 1);

      const duration = game.getTurnDuration(current);
      assert.equal(duration, 6, 'Turn duration should be reduced to 6 seconds when 1 card in hand');

      const state = game.getStateForPlayer(current);
      assert.equal(state.turnDuration, 6);
      assert.equal(state.isOneCardLeft, true);
    });

    it('should return 18s turn duration when player has multiple cards in hand', () => {
      const game = new Game('TEST5', 's1', 'P1', 1, 5);
      game.addPlayer('s2', 'P2', 2);
      game.addPlayer('s3', 'P3', 3);

      game.startGame();
      game.cardsPerPlayer = 3;
      game.setupRound();
      game.dealCards();

      // Hand has 3 cards
      assert.equal(game.hands['s1'].length, 3);

      // Transition to TRICK_PLAY
      game.placeBid(game.trickPlayOrder[0], 1);
      game.placeBid(game.trickPlayOrder[1], 1);
      game.placeBid(game.trickPlayOrder[2], 0);
      assert.equal(game.gameState, GAME_STATES.TRICK_PLAY);

      const current = game.currentPlayer;
      assert.equal(game.hands[current].length, 3);

      const duration = game.getTurnDuration(current);
      assert.equal(duration, 18);

      const state = game.getStateForPlayer(current);
      assert.equal(state.turnDuration, 18);
      assert.equal(state.isOneCardLeft, false);
    });

    it('should return 4s fast turn duration when active player is disconnected', () => {
      const game = new Game('TEST6', 's1', 'P1', 1, 5);
      game.addPlayer('s2', 'P2', 2);
      game.addPlayer('s3', 'P3', 3);

      game.startGame();
      game.cardsPerPlayer = 3;
      game.setupRound();
      game.dealCards();

      // Mark s1 as disconnected
      game.removePlayer('s1');
      assert.equal(game.players.get('s1').connected, false);

      const duration = game.getTurnDuration('s1');
      assert.equal(duration, 4, 'Disconnected player should have fast 4s duration to prevent stalls');
    });
  });

  // =========================================================================
  // 3. Offline Tracking & Kick after 2 Consecutive Rounds
  // =========================================================================
  describe('Inactivity Kick (2 rounds offline)', () => {
    it('should increment offlineRounds when player remains disconnected across rounds', () => {
      const game = new Game('TEST7', 's1', 'P1', 1, 5);
      game.addPlayer('s2', 'P2', 2);
      game.addPlayer('s3', 'P3', 3);

      game.startGame();
      game.setupRound();
      game.dealCards();

      // Mark s3 as disconnected
      game.removePlayer('s3');
      assert.equal(game.players.get('s3').connected, false);
      assert.equal(game.players.get('s3').offlineRounds, 0);

      // Bids and trick play
      for (const p of game.trickPlayOrder) {
        game.placeBid(p, 0);
      }
      for (const p of [...game.trickPlayOrder]) {
        game.playCard(p, game.hands[p][0]);
      }

      // Evaluate round 1
      game.evaluateRound();
      assert.equal(game.players.get('s3').offlineRounds, 1);
      assert.equal(game.players.get('s1').offlineRounds, 0);

      // Check eliminations after 1 round offline: s3 should NOT be eliminated/kicked yet
      const elim1 = game.checkEliminations();
      const s3EliminatedRound1 = elim1.eliminated.some(e => e.playerId === 's3');
      assert.equal(s3EliminatedRound1, false, 'Player should not be kicked after only 1 round offline');

      // Round 2
      game.advanceToNextRound();
      game.setupRound();
      game.dealCards();

      // s3 is still disconnected
      assert.equal(game.players.get('s3').connected, false);

      // Complete round 2
      for (const p of game.trickPlayOrder) {
        game.placeBid(p, 0);
      }
      for (let t = 0; t < game.cardsPerPlayer; t++) {
        const order = [...game.trickPlayOrder];
        for (const p of order) {
          if (game.hands[p] && game.hands[p].length > 0) {
            game.playCard(p, game.hands[p][0]);
          }
        }
      }

      // Evaluate round 2
      game.evaluateRound();
      assert.equal(game.players.get('s3').offlineRounds, 2);

      // Check eliminations after 2 rounds offline: s3 MUST BE KICKED!
      const elim2 = game.checkEliminations();
      const s3Elim = elim2.eliminated.find(e => e.playerId === 's3');
      assert.ok(s3Elim, 's3 should be eliminated');
      assert.equal(s3Elim.kicked, true, 's3 should be marked kicked');
      assert.ok(s3Elim.reason.includes('offline'), 'Reason should mention offline');
      assert.equal(game.lives['s3'], 0, 's3 lives should be set to 0');
      assert.ok(!game.activePlayers.includes('s3'), 's3 should no longer be active');
    });

    it('should reset offlineRounds when player reconnects before 2nd round completes', () => {
      const game = new Game('TEST8', 's1', 'P1', 1, 5);
      game.addPlayer('s2', 'P2', 2);
      game.addPlayer('s3', 'P3', 3);

      game.startGame();
      game.setupRound();
      game.dealCards();

      // s2 disconnects
      game.removePlayer('s2');

      // Complete round 1
      for (const p of game.trickPlayOrder) game.placeBid(p, 0);
      for (const p of [...game.trickPlayOrder]) game.playCard(p, game.hands[p][0]);
      game.evaluateRound();
      assert.equal(game.players.get('s2').offlineRounds, 1);

      // s2 reconnects in round 2!
      game.updatePlayerSocketId('s2', 's2_reconnected');
      assert.equal(game.players.get('s2_reconnected').connected, true);
      assert.equal(game.players.get('s2_reconnected').offlineRounds, 0, 'offlineRounds must reset to 0 on reconnect');
    });
  });
});
