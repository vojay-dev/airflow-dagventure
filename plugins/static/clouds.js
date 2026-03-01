'use strict';

const CLOUD_SHAPES = {
  cloud_sm: {
    puffs: [[6.5, 2, 3.5, 2], [3, 3.5, 2.5, 1.5], [10, 3.5, 2.5, 1.5]],
    gridW: 13, gridH: 5,
  },
  cloud_md: {
    puffs: [[10, 2.5, 5, 2.5], [3.5, 4, 3, 2], [16.5, 4, 3, 2]],
    gridW: 20, gridH: 6,
  },
  cloud_lg: {
    puffs: [[13, 2.5, 7, 3], [5, 4, 4, 2.5], [9, 3.5, 4, 2.5], [17, 3.5, 4, 2.5], [21, 4, 4, 2.5]],
    gridW: 26, gridH: 7,
  },
};

const PX = 8;

function _drawCloud(ctx, shape, x, y, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  const { puffs, gridW, gridH } = shape;
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const inside = puffs.some(([cx, cy, rx, ry]) => {
        const dx = (col + 0.5 - cx) / rx;
        const dy = (row + 0.5 - cy) / ry;
        return dx * dx + dy * dy <= 1;
      });
      if (inside) ctx.fillRect(x + col * PX, y + row * PX, PX, PX);
    }
  }
  ctx.globalAlpha = 1;
}

function initClouds() {
  const canvas = document.getElementById('cloud-canvas');
  if (!canvas) return;

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const ctx = canvas.getContext('2d');
  const keys = ['cloud_sm', 'cloud_sm', 'cloud_md', 'cloud_md', 'cloud_lg'];

  // Keep initial screen offsets; world positions are set once camera is ready
  const clouds = Array.from({ length: 12 }, () => {
    const key = keys[Math.floor(Math.random() * keys.length)];
    return {
      shape:    CLOUD_SHAPES[key],
      initSX:   Math.random() * (window.innerWidth  + 400) - 200,
      initSY:   30 + Math.random() * Math.floor(window.innerHeight * 0.5),
      worldX:   0,
      worldY:   0,
      speed:    0.12 + Math.random() * 0.28,
      alpha:    0.45 + Math.random() * 0.4,
    };
  });

  let ready = false;

  (function tick() {
    const cam  = window._game?.cameras?.main;
    const camX = cam ? cam.scrollX : 0;
    const camY = cam ? cam.scrollY : 0;

    // Place clouds in world space once the camera has settled on the player
    if (cam && !ready) {
      for (const c of clouds) {
        c.worldX = camX + c.initSX;
        c.worldY = camY + c.initSY;
      }
      ready = true;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const c of clouds) {
      // Drift slowly in world space
      c.worldX += c.speed;

      // Screen position = world position minus camera scroll (same as any world object)
      const sx = Math.round(c.worldX - camX);
      const sy = Math.round(c.worldY - camY);

      // Wrap when fully off-screen so there are always clouds visible
      const w = c.shape.gridW * PX;
      const h = c.shape.gridH * PX;
      if (sx >  canvas.width  + w) c.worldX -= canvas.width  + 2 * w;
      if (sx < -w)                 c.worldX += canvas.width  + 2 * w;
      if (sy >  canvas.height + h) c.worldY -= canvas.height + 2 * h;
      if (sy < -h)                 c.worldY += canvas.height + 2 * h;

      _drawCloud(ctx, c.shape, sx, sy, c.alpha);
    }

    requestAnimationFrame(tick);
  })();
}

document.addEventListener('DOMContentLoaded', initClouds);
