'use strict';

const GITHUB_URL = 'https://github.com/vojay-dev/airflow-dagventure';
const TILE = 64;

// ── Hardcoded island grid (0 = water, 1 = land) ──────────────────────────────
// 40 cols × 26 rows — large oval island
const ISLAND = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];
const ROWS = ISLAND.length;
const COLS = ISLAND[0].length;

function getTile(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return 0;
  return ISLAND[r][c];
}

// ── Building positions — all houses, all verified on land ─────────────────────
const BUILDINGS = [
  { key: 'house_yellow',       col: 20, row:  7 },
  { key: 'house_blue',         col: 12, row: 10 },
  { key: 'house_red',          col: 28, row: 10 },
  { key: 'house_construction', col:  9, row: 14 },
  { key: 'house_blue',         col: 20, row: 16 },
  { key: 'house_purple',       col: 31, row: 15 },
  { key: 'house_blue',         col: 16, row: 20 },
];

// ── Tree decorations — all verified on land ───────────────────────────────────
const TREES = [
  { col: 14, row:  4, frame:  0 },
  { col: 25, row:  3, frame:  3 },
  { col: 10, row:  7, frame:  6 },
  { col: 32, row:  8, frame:  9 },
  { col: 35, row: 11, frame:  2 },
  { col: 31, row: 17, frame:  5 },
  { col: 26, row: 20, frame:  8 },
  { col: 18, row: 21, frame:  1 },
  { col: 13, row: 19, frame:  4 },
  { col:  5, row: 15, frame:  7 },
  { col:  4, row: 10, frame: 10 },
  { col:  7, row: 18, frame:  0 },
  { col: 21, row: 22, frame:  3 },
  { col: 29, row:  6, frame:  6 },
];

// ─────────────────────────────────────────────────────────────────────────────
class LandingScene extends Phaser.Scene {
  constructor() { super({ key: 'LandingScene' }); }

  // ── Preload ──────────────────────────────────────────────────────────────
  preload() {
    this.load.image('water',   'assets/terrain/water/water.png');
    this.load.spritesheet('ground', 'assets/terrain/ground/tilemap_flat.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('warrior', 'assets/factions/knights/troops/warrior/blue/warrior_blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('goblin',  'assets/factions/goblins/troops/torch/blue/torch_blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tree',    'assets/resources/trees/tree.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('sheep_idle',   'assets/resources/sheep/happysheep_idle.png',    { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('sheep_bounce', 'assets/resources/sheep/happysheep_bouncing.png', { frameWidth: 128, frameHeight: 128 });
    this.load.image('ribbon_blue',   'assets/ui/ribbons/ribbon_blue_3slides.png');
    this.load.image('ribbon_red',    'assets/ui/ribbons/ribbon_red_3slides.png');
    this.load.image('ribbon_yellow', 'assets/ui/ribbons/ribbon_yellow_3slides.png');
    this.load.image('panel_frame',   'assets/ui/banners/carved_9slides.png');

    ['blue','red','yellow','purple','construction'].forEach(c => {
      this.load.image(`house_${c}`, `assets/factions/knights/buildings/house/house_${c}.png`);
    });

    for (let i = 1; i <= 8; i++) {
      this.load.image(`cloud_0${i}`, `assets/terrain/clouds/clouds_0${i}.png`);
    }
  }

  // ── Create ───────────────────────────────────────────────────────────────
  create() {
    window._landingGame = this;

    this._createAnims();
    this.obstacles = this.physics.add.staticGroup();

    const W = COLS * TILE;
    const H = ROWS * TILE;

    this._buildWorld(W, H);
    this._placeTrees();
    this._createBuildings();
    this._createSheep();
    this._createPlayer(W, H);
    this._createClouds(W, H);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
  }

  // ── World tiles + water-edge obstacles ───────────────────────────────────
  _buildWorld(W, H) {
    this.add.tileSprite(W / 2, H / 2, W * 6, H * 6, 'water').setOrigin(0.5).setDepth(0);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tx = c * TILE + 32;
        const ty = r * TILE + 32;
        if (getTile(r, c) === 1) {
          const up    = getTile(r-1, c) === 1;
          const down  = getTile(r+1, c) === 1;
          const left  = getTile(r, c-1) === 1;
          const right = getTile(r, c+1) === 1;
          let frame = 11;
          if      (!up && !left)    frame = 0;
          else if (!up && !right)   frame = 2;
          else if (!down && !left)  frame = 20;
          else if (!down && !right) frame = 22;
          else if (!up)    frame = 1;
          else if (!down)  frame = 21;
          else if (!left)  frame = 10;
          else if (!right) frame = 12;
          this.add.image(tx, ty, 'ground', frame).setDepth(1);
        } else {
          this.obstacles.create(tx, ty, null).setVisible(false).body.setSize(TILE, TILE);
        }
      }
    }
  }

  // ── Trees (decorative only, no collision) ────────────────────────────────
  _placeTrees() {
    TREES.forEach(({ col, row, frame }) => {
      const x = col * TILE + 32;
      const y = row * TILE + 64;
      this.add.image(x, y, 'tree', frame).setOrigin(0.5, 1).setScale(0.8).setDepth(y);
    });
  }

  // ── Buildings (decorative only, no collision) ────────────────────────────
  _createBuildings() {
    BUILDINGS.forEach(def => {
      const wx = def.col * TILE + 32;
      const wy = def.row * TILE + 64;
      this.add.image(wx, wy, def.key).setOrigin(0.5, 1).setDepth(wy);
    });
  }

  // ── Player ───────────────────────────────────────────────────────────────
  _createPlayer(W, H) {
    const spawnX = 20 * TILE + 32;
    const spawnY = 13 * TILE + 32;
    this.player = this.physics.add.sprite(spawnX, spawnY, 'warrior')
      .setScale(0.75).setDepth(spawnY);
    this.player.body.setSize(32, 16).setOffset(80, 170);
    this.player.play('p_idle');
    // Only water-edge collision — no tree or building blockers
    this.physics.add.collider(this.player, this.obstacles);
  }

  // ── Sheep ────────────────────────────────────────────────────────────────
  _createSheep() {
    const spots = [
      { col: 20, row: 11 },
      { col: 26, row: 15 },
      { col: 14, row: 15 },
    ];
    this._sheep = spots.map(({ col, row }) => {
      const x = col * TILE + 32;
      const y = row * TILE + 32;
      const sp = this.physics.add.sprite(x, y, 'sheep_idle')
        .setScale(0.65).setDepth(y);
      sp.play('sheep_idle_anim');
      sp._vx = 0; sp._vy = 0;
      this.time.addEvent({
        delay: Phaser.Math.Between(2000, 4000),
        loop: true,
        callback: () => {
          if (Math.random() < 0.45) {
            sp._vx = 0; sp._vy = 0;
            sp.play('sheep_idle_anim', true);
          } else {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 35;
            sp._vx = Math.cos(angle) * spd;
            sp._vy = Math.sin(angle) * spd;
            sp.play('sheep_walk_anim', true);
            sp.setFlipX(sp._vx < 0);
          }
        },
      });
      return sp;
    });
  }

  // ── Clouds ───────────────────────────────────────────────────────────────
  _createClouds(W, H) {
    const keys = ['cloud_01','cloud_02','cloud_03','cloud_04','cloud_05','cloud_06','cloud_07','cloud_08'];
    this._clouds = [];
    for (let i = 0; i < 30; i++) {
      const c = this.add.image(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        Phaser.Utils.Array.GetRandom(keys)
      ).setDepth(9000).setAlpha(Phaser.Math.FloatBetween(0.55, 0.85)).setScale(0.5);
      c._drift  = Phaser.Math.FloatBetween(0.25, 0.65);
      c._worldW = W;
      this._clouds.push(c);
    }
  }

  // ── Animations ───────────────────────────────────────────────────────────
  _createAnims() {
    const A = this.anims;
    if (!A.exists('p_idle'))
      A.create({ key: 'p_idle',  frames: A.generateFrameNumbers('warrior', { start: 0,  end: 5  }), frameRate: 8,  repeat: -1 });
    if (!A.exists('p_walk'))
      A.create({ key: 'p_walk',  frames: A.generateFrameNumbers('warrior', { start: 6,  end: 11 }), frameRate: 12, repeat: -1 });
    if (!A.exists('sheep_idle_anim'))
      A.create({ key: 'sheep_idle_anim', frames: A.generateFrameNumbers('sheep_idle',   { start: 0, end: 7 }), frameRate: 8,  repeat: -1 });
    if (!A.exists('sheep_walk_anim'))
      A.create({ key: 'sheep_walk_anim', frames: A.generateFrameNumbers('sheep_bounce', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(time, delta) {
    if (!this.player) return;

    // Clouds drift
    this._clouds.forEach(c => {
      c.x += c._drift;
      if (c.x > c._worldW) c.x = 0;
    });

    // Sheep wander with soft boundary nudge
    const cx = COLS * TILE / 2;
    const cy = ROWS * TILE / 2;
    this._sheep.forEach(sp => {
      sp.x += sp._vx * (delta / 1000);
      sp.y += sp._vy * (delta / 1000);
      sp.setDepth(sp.y);
      if (sp.x < 3*TILE || sp.x > (COLS-3)*TILE ||
          sp.y < 3*TILE || sp.y > (ROWS-3)*TILE) {
        sp._vx += (cx - sp.x) * 0.002;
        sp._vy += (cy - sp.y) * 0.002;
      }
    });

    // Player movement
    const speed = 220;
    let vx = 0, vy = 0;
    if (this.wasd.A.isDown || this.wasd.LEFT.isDown)   vx = -speed;
    else if (this.wasd.D.isDown || this.wasd.RIGHT.isDown) vx =  speed;
    if (this.wasd.W.isDown || this.wasd.UP.isDown)     vy = -speed;
    else if (this.wasd.S.isDown || this.wasd.DOWN.isDown)  vy =  speed;
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }

    const moving = vx !== 0 || vy !== 0;
    this.player.setVelocity(vx, vy);
    if (vx < 0) this.player.setFlipX(true);
    else if (vx > 0) this.player.setFlipX(false);
    this.player.play(moving ? 'p_walk' : 'p_idle', true);
    this.player.setDepth(this.player.y);
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await document.fonts.ready;

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1a5a72',
    scene: [LandingScene],
    render: { pixelArt: true, antialias: false },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.RESIZE },
  });
});
