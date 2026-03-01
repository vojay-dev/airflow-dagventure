'use strict';

class MapGenerator {
  constructor(numDags) {
    const islandsCount = Math.max(1, Math.ceil(numDags / 3));
    this.cols = 60 + islandsCount * 12;
    this.rows = 40 + islandsCount * 8;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.islands = [];
    this.generate(islandsCount);
  }

  generate(count) {
    for (let i = 0; i < count; i++) {
      const cx = Phaser.Math.Between(15, this.cols - 15);
      const cy = Phaser.Math.Between(15, this.rows - 15);
      const radius = Phaser.Math.Between(10, 14);
      this.islands.push({ cx, cy, radius });
      this.drawBlob(cx, cy, radius);
    }

    for (let i = 0; i < this.islands.length - 1; i++) {
      this.drawBridge(this.islands[i], this.islands[i + 1]);
    }
  }

  drawBlob(cx, cy, r) {
    for (let row = cy - r - 3; row <= cy + r + 3; row++) {
      for (let col = cx - r - 3; col <= cx + r + 3; col++) {
        const dx = col - cx;
        const dy = row - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = (Math.sin(col * 0.4) + Math.cos(row * 0.4)) * 2;

        if (dist + noise < r) {
          if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            this.grid[row][col] = 1;
          }
        }
      }
    }
  }

  drawBridge(islandA, islandB) {
    const steps = 25;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.floor(Phaser.Math.Linear(islandA.cx, islandB.cx, t));
      const y = Math.floor(Phaser.Math.Linear(islandA.cy, islandB.cy, t));
      this.drawBlob(x, y, 4);
    }
  }

  getTile(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return 0;
    return this.grid[r][c];
  }

  getLandSpots(count) {
    const candidates = [];
    for (let r = 4; r < this.rows - 4; r++) {
      for (let c = 4; c < this.cols - 4; c++) {
        if (this.grid[r][c] === 1) {
          candidates.push({ c, r });
        }
      }
    }

    Phaser.Utils.Array.Shuffle(candidates);

    const selected = [];
    const minDistance = 7;

    for (const spot of candidates) {
      if (selected.length >= count) break;

      const isFarEnough = selected.every(existing =>
        Math.abs(existing.c - spot.c) > minDistance ||
        Math.abs(existing.r - spot.r) > minDistance
      );

      if (isFarEnough) {
        selected.push(spot);
      }
    }

    return selected;
  }
}
