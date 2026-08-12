// =============================================================================
// Katrazado — Canvas Confetti FX
// =============================================================================
// Lightweight canvas particle confetti system for trick and game victories.
// =============================================================================

'use strict';

const FX = (() => {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animId = null;

  function initCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fx-canvas';
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
  }

  function resize() {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  function launchConfetti(count = 80) {
    initCanvas();
    if (!ctx) return;

    const colors = ['#f0c040', '#e74c3c', '#2ed573', '#3498db', '#9b59b6', '#ffffff'];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: canvas.height / 2 + (Math.random() * 100 - 50),
        vx: (Math.random() * 12 - 6),
        vy: (Math.random() * -14 - 4),
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() * 10 - 5),
        gravity: 0.35,
        opacity: 1,
      });
    }

    if (!animId) {
      loop();
    }
  }

  function loop() {
    if (!ctx || particles.length === 0) {
      animId = null;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rSpeed;
      p.opacity -= 0.012;

      if (p.opacity <= 0 || p.y > canvas.height + 20) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    animId = requestAnimationFrame(loop);
  }

  return {
    launchConfetti,
  };
})();
