'use strict';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('water', 'assets/terrain/water/water.png');
    this.load.spritesheet('ground', 'assets/terrain/ground/tilemap_flat.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('warrior', 'assets/factions/knights/troops/warrior/blue/warrior_blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('goblin', 'assets/factions/goblins/troops/torch/blue/torch_blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('sheep_idle_sheet', 'assets/resources/sheep/happysheep_idle.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('sheep_bounce_sheet', 'assets/resources/sheep/happysheep_bouncing.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('explosion', 'assets/effects/explosion/explosions.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('heart', 'assets/ui/icons/regular_01.png');

    const buildingsBasePath = 'assets/factions/knights/buildings/';
    ['blue', 'red', 'yellow', 'purple', 'construction'].forEach(color => {
      this.load.image(`house_${color}`,   `${buildingsBasePath}house/house_${color}.png`);
      this.load.image(`castle_${color}`,  `${buildingsBasePath}castle/castle_${color}.png`);
      this.load.image(`tower_${color}`,   `${buildingsBasePath}tower/tower_${color}.png`);
    });

    this.load.image('ribbon_blue',   'assets/ui/ribbons/ribbon_blue_3slides.png');
    this.load.image('ribbon_red',    'assets/ui/ribbons/ribbon_red_3slides.png');
    this.load.image('ribbon_yellow', 'assets/ui/ribbons/ribbon_yellow_3slides.png');
    this.load.image('minimap_frame', 'assets/ui/banners/carved_9slides.png');
    this.load.spritesheet('tree', 'assets/resources/trees/tree.png', { frameWidth: 192, frameHeight: 192 });

    for (let i = 1; i <= 18; i++) {
      this.load.image(`deco${i}`, `assets/deco/${String(i).padStart(2, '0')}.png`);
    }

    this.load.image('pointer_tl', 'assets/ui/pointers/03.png');
    this.load.image('pointer_tr', 'assets/ui/pointers/04.png');
    this.load.image('pointer_bl', 'assets/ui/pointers/05.png');
    this.load.image('pointer_br', 'assets/ui/pointers/06.png');

    for (let i = 1; i <= 8; i++) {
      this.load.image(`cloud_0${i}`, `assets/terrain/clouds/clouds_0${i}.png`);
    }
    for (let i = 1; i <= 4; i++) {
      this.load.spritesheet(`bushe${i}`, `assets/deco/bushe${i}.png`, { frameWidth: 128, frameHeight: 128 });
      this.load.image(`rock${i}`, `assets/deco/rock${i}.png`);
    }
  }

  create() {
    window._game = this;
    this._createAnims();

    this.buildings = [];
    this.npcs = [];
    this.sheepsKilled = 0;
    this.dagSuccessCount = 0;
    this._playerLevel = 1;
    this.obstacles = this.physics.add.staticGroup();
    this.buildingsGroup = this.physics.add.group({ immovable: true });

    this._fetchDags();
    this.time.addEvent({ delay: 10000, loop: true, callback: this._fetchDags, callbackScope: this });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.input.keyboard.on('keydown-E',     () => this._handleInteract());
    this.input.keyboard.on('keydown-SPACE', () => this._handleAttack());
    this.input.keyboard.on('keydown-ESC',   () => {
      const logModal = document.getElementById('log-modal');
      const interactionMenu = document.getElementById('interaction-menu');
      if (!logModal.classList.contains('hidden')) {
        logModal.classList.add('hidden');
      } else if (!interactionMenu.classList.contains('hidden')) {
        window.closeMenu();
      }
    });
  }

  _createAnims() {
    this.anims.create({ key: 'p_idle',    frames: this.anims.generateFrameNumbers('warrior',          { start: 0, end: 5 }), frameRate: 8,  repeat: -1 });
    this.anims.create({ key: 'p_walk',    frames: this.anims.generateFrameNumbers('warrior',          { start: 6, end: 11 }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'p_attack',  frames: this.anims.generateFrameNumbers('warrior',          { start: 12, end: 17 }), frameRate: 15, repeat: 0 });
    this.anims.create({ key: 'gob_torch', frames: this.anims.generateFrameNumbers('goblin',           { start: 0, end: 6 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'sheep_idle',frames: this.anims.generateFrameNumbers('sheep_idle_sheet', { start: 0, end: 7 }), frameRate: 6,  repeat: -1 });
    this.anims.create({ key: 'sheep_walk',frames: this.anims.generateFrameNumbers('sheep_bounce_sheet',{ start: 0, end: 5 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'explode',   frames: this.anims.generateFrameNumbers('explosion',        { start: 0, end: 8 }), frameRate: 12, repeat: 0 });
  }

  async _fetchDags() {
    try {
      const dagsData = await AirflowApi.getDags();
      const rawDags = (dagsData.dags || []).filter(dag => dag.is_active !== false);

      const runResults = await Promise.all(rawDags.map(dag => AirflowApi.getDagRuns(dag.dag_id)));

      const dags = rawDags.map((rawDag, index) => {
        const latestRun = runResults[index].dag_runs?.[0];
        let state;
        if (rawDag.is_paused)  state = 'paused';
        else if (!latestRun)   state = 'never_run';
        else                   state = latestRun.state || 'never_run';

        return {
          dag_id:      rawDag.dag_id,
          is_paused:   rawDag.is_paused,
          state,
          last_run:    latestRun?.start_date || null,
          last_run_id: latestRun?.dag_run_id || null,
          description: rawDag.description || '',
          tags:        (rawDag.tags || []).map(tag => tag.name ?? tag),
        };
      });

      document.getElementById('hud-dags').innerHTML = `<span class="hud-count">${dags.length}</span> Dags Online`;

      if (this._dagStateCache) {
        const changed = dags.filter(d => this._dagStateCache[d.dag_id] && this._dagStateCache[d.dag_id] !== d.state);
        const failed   = changed.find(d => d.state === 'failed');
        const successes = changed.filter(d => d.state === 'success');
        if (failed)                this.showToast(`${failed.dag_id} FAILED!`, 'danger');
        else if (successes.length) this.showToast(`${successes[0].dag_id} COMPLETE`, 'success');
        successes.forEach(() => this._onDagSuccess());
      }
      this._dagStateCache = Object.fromEntries(dags.map(d => [d.dag_id, d.state]));

      if (!this.dags) {
        this.dags = dags;
        this._initWorld(dags);
        return;
      }

      this.dags = dags;

      this.buildings.forEach(building => {
        if (building.isDestroyed) return;
        const match = dags.find(dag => dag.dag_id === building.dag.dag_id);
        if (match) building.updateState(match);
      });

      const activeDagIds = new Set(dags.map(dag => dag.dag_id));
      this.buildings = this.buildings.filter(building => {
        if (building.isDestroyed) return false;
        if (!activeDagIds.has(building.dag.dag_id)) { building.destroy(); return false; }
        return true;
      });

      const existingIds = new Set(this.buildings.map(b => b.dag.dag_id));
      for (const dag of dags.filter(d => !existingIds.has(d.dag_id))) {
        const spot = this._allSpots?.[this._nextSpotIdx];
        if (spot) {
          const building = new DagBuilding(this, spot.c * 64 + 32, spot.r * 64 + 32, dag);
          this.buildings.push(building);
          this.buildingsGroup.add(building.sprite);
          this._nextSpotIdx++;
        }
      }
    } catch (error) {
      if (!this.dags) {
        const demoDags = Array.from({ length: 15 }, (_, i) => ({
          dag_id: `dag_${i + 1}`, state: 'success', is_paused: false, tags: [],
        }));
        this.dags = demoDags;
        this._initWorld(demoDags);
      }
    }
  }

  _initWorld(dags) {
    this.children.removeAll();
    this.obstacles.clear(true, true);
    this.buildingsGroup.clear(true, true);
    this.buildings = [];
    this.npcs = [];

    this.gen = new MapGenerator(dags.length);
    const worldWidth  = this.gen.cols * 64;
    const worldHeight = this.gen.rows * 64;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.waterBg = this.add.image(0, 0, 'water').setOrigin(0).setDepth(0).setDisplaySize(worldWidth, worldHeight);

    for (let row = 0; row < this.gen.rows; row++) {
      for (let col = 0; col < this.gen.cols; col++) {
        const tileX = col * 64 + 32;
        const tileY = row * 64 + 32;

        if (this.gen.grid[row][col] === 1) {
          // Pick the correct edge/corner frame by checking all four neighbours
          const hasUp    = this.gen.getTile(row - 1, col) === 1;
          const hasDown  = this.gen.getTile(row + 1, col) === 1;
          const hasLeft  = this.gen.getTile(row, col - 1) === 1;
          const hasRight = this.gen.getTile(row, col + 1) === 1;

          let tileFrame = 11;
          if      (!hasUp   && !hasLeft)  tileFrame = 0;
          else if (!hasUp   && !hasRight) tileFrame = 2;
          else if (!hasDown && !hasLeft)  tileFrame = 20;
          else if (!hasDown && !hasRight) tileFrame = 22;
          else if (!hasUp)                tileFrame = 1;
          else if (!hasDown)              tileFrame = 21;
          else if (!hasLeft)              tileFrame = 10;
          else if (!hasRight)             tileFrame = 12;

          this.add.image(tileX, tileY, 'ground', tileFrame).setDepth(1);
        } else {
          // Invisible static body — blocks the player from walking on water
          this.obstacles.create(tileX, tileY, null).setVisible(false).body.setSize(64, 64);
        }
      }
    }

    // +50 buffer slots so new Dags can appear without a full world rebuild
    const spots = this.gen.getLandSpots(dags.length + 1 + 50);
    this._allSpots    = spots;
    this._nextSpotIdx = dags.length + 1;

    dags.forEach((dag, index) => {
      const spot  = spots[index + 1] || spots[1];
      const building = new DagBuilding(this, spot.c * 64 + 32, spot.r * 64 + 32, dag);
      this.buildings.push(building);
      this.buildingsGroup.add(building.sprite);
    });

    this._createPlayer(spots[0]);
    this._createNPCs();
    this._scatterDecorations();

    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.sheeps.map(sheep => sheep.sprite), this.obstacles);

    this.cameras.main
      .setBounds(0, 0, worldWidth, worldHeight)
      .startFollow(this.player, true, 0.1, 0.1);

    if (this.minimap) this.cameras.remove(this.minimap);
    if (this.miniFrame) this.miniFrame.destroy();

    this.minimap = this.cameras
      .add(window.innerWidth - 220, window.innerHeight - 220, 200, 200)
      .setZoom(0.12)
      .setBackgroundColor(0x002244)
      .setBounds(0, 0, worldWidth, worldHeight)
      .startFollow(this.player, true, 0.1, 0.1);

    this.miniFrame = this.add.nineslice(
      window.innerWidth - 120, window.innerHeight - 120,
      'minimap_frame', null, 230, 230, 32, 32, 32, 32
    ).setOrigin(0.5).setScrollFactor(0).setDepth(10000);

    this.minimap.ignore(this.miniFrame);

    this.sheepBanner = this.add.nineslice(
      20, window.innerHeight - 20,
      'minimap_frame', null, 240, 60, 32, 32, 32, 32
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(10000);

    this.sheepText = this.add.text(
      40, window.innerHeight - 50,
      `Sheeps Killed: ${this.sheepsKilled}/3`,
      { ...PF, fontSize: '10px', color: '#fff' }
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10001);

    this.sheeps.forEach(sheep => {
      this.minimap.ignore(sheep.sprite);
      this.minimap.ignore(sheep.hearts);
    });
    this.buildings.forEach(building => {
      this.minimap.ignore(building.hearts);
      this.minimap.ignore(building.corners);
    });
    this.minimap.ignore([this.sheepBanner, this.sheepText]);

    this._createClouds(worldWidth, worldHeight);
    this._initDayNight();
    this._createTitleBanner();
  }

  _createTitleBanner() {
    if (this._bannerCenter) this._bannerCenter.destroy();
    if (this._bannerTitle)  this._bannerTitle.destroy();

    const bx      = window.innerWidth / 2;
    const by      = 6;
    const bannerW = 360;
    const bannerH = 52;

    this._bannerCenter = this.add.nineslice(
      bx, by, 'ribbon_blue', null, bannerW, bannerH, 24, 24, 14, 14
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10002);

    this._bannerTitle = this.add.text(bx, by + bannerH * 0.38, 'DAGVENTURE', {
      ...PF, fontSize: '14px', color: '#ffffff', stroke: '#1a3a50', strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10003);

    this.minimap.ignore([this._bannerCenter, this._bannerTitle]);
  }

  _createClouds(worldWidth, worldHeight) {
    const cloudKeys = ['cloud_01','cloud_02','cloud_03','cloud_04','cloud_05','cloud_06','cloud_07','cloud_08'];
    this.clouds = [];
    for (let i = 0; i < 60; i++) {
      const key   = Phaser.Utils.Array.GetRandom(cloudKeys);
      const cloud = this.add.image(
        Phaser.Math.Between(0, worldWidth),
        Phaser.Math.Between(0, worldHeight),
        key
      ).setDepth(9000).setAlpha(Phaser.Math.FloatBetween(0.55, 0.85)).setScale(0.5);
      cloud._driftSpeed = Phaser.Math.FloatBetween(0.3, 0.8);
      cloud._worldWidth = worldWidth;
      this.clouds.push(cloud);
    }
    this.minimap.ignore(this.clouds);
  }

  showToast(msg, type = 'danger') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    toast.textContent = msg;
    toast.dataset.type = type;
    toast.style.removeProperty('background-color');
    toast.style.opacity = '1';
    this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
  }

  _createLightTextures() {
    const makeBlob = (key, size) => {
      if (this.textures.exists(key)) return;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const r    = size / 2;
      const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0,    'rgba(255,255,255,1.0)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      grad.addColorStop(0.65, 'rgba(255,255,255,0.30)');
      grad.addColorStop(1,    'rgba(255,255,255,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      this.textures.addCanvas(key, canvas);
    };
    makeBlob('light_lg', 300); // player  ~150px radius
    makeBlob('light_sm', 180); // goblin   ~90px radius
  }

  _initDayNight() {
    this._cycleTime     = 0;
    this._cycleDuration = 150000;
    this._nightR        = 0;
    this._nightG        = 0;
    this._nightB        = 0;
    this._nightAlpha    = 0;

    this._createLightTextures();
    this._rebuildLightMask();

    // Rebuild whenever the canvas is resized (e.g. browser window resize)
    this.scale.off('resize', this._rebuildLightMask, this);
    this.scale.on('resize',  this._rebuildLightMask, this);
  }

  _rebuildLightMask() {
    const w = this.scale.width  + 400;
    const h = this.scale.height + 400;
    if (this._lightMask) this._lightMask.destroy();
    this._lightMask = this.add.renderTexture(-200, -200, w, h)
      .setScrollFactor(0).setDepth(9490).setOrigin(0).setVisible(false);
    if (this.minimap) this.minimap.ignore(this._lightMask);
  }

  _showTimeLabel(text) {
    const el = document.getElementById('time-label');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    if (this._timeLabelTimer) clearTimeout(this._timeLabelTimer);
    this._timeLabelTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
  }

  _updateDayNight(delta) {
    const lerp  = (a, b, p) => a + (b - a) * p;
    const prevT = this._cycleTime / this._cycleDuration;
    this._cycleTime = (this._cycleTime + delta) % this._cycleDuration;
    const t = this._cycleTime / this._cycleDuration;

    if (prevT < 0.30 && t >= 0.30) this._showTimeLabel('SUNSET APPROACHES...');
    if (prevT < 0.55 && t >= 0.55) this._showTimeLabel('NIGHTFALL');
    if (prevT < 0.70 && t >= 0.70) this._showTimeLabel('DAWN BREAKS');

    let r, g, b, a;
    if (t < 0.30) {
      r = 0; g = 0; b = 0; a = 0;
    } else if (t < 0.45) {
      const p = (t - 0.30) / 0.15;
      r = Math.round(lerp(0, 85, p)); g = Math.round(lerp(0, 28, p)); b = 0;
      a = lerp(0, 0.48, p);
    } else if (t < 0.55) {
      const p = (t - 0.45) / 0.10;
      r = Math.round(lerp(85, 0, p)); g = Math.round(lerp(28, 5, p)); b = Math.round(lerp(0, 45, p));
      a = lerp(0.48, 0.74, p);
    } else if (t < 0.70) {
      r = 0; g = 5; b = 45; a = 0.74;
    } else if (t < 0.80) {
      const p = (t - 0.70) / 0.10;
      r = Math.round(lerp(0, 85, p)); g = Math.round(lerp(5, 28, p)); b = Math.round(lerp(45, 0, p));
      a = lerp(0.74, 0.48, p);
    } else if (t < 0.95) {
      const p = (t - 0.80) / 0.15;
      r = Math.round(lerp(85, 0, p)); g = Math.round(lerp(28, 0, p)); b = 0;
      a = lerp(0.48, 0, p);
    } else {
      r = 0; g = 0; b = 0; a = 0;
    }

    this._nightR = r; this._nightG = g; this._nightB = b; this._nightAlpha = a;

    // markerPos: 0 = full day, 1 = full night
    const markerPos = t <= 0.55 ? t / 0.55 : 1 - (t - 0.55) / 0.45;
    const marker = document.getElementById('time-marker');
    if (marker) marker.style.left = `${(markerPos * 100).toFixed(1)}%`;
  }

  _updateLightMask() {
    if (!this._lightMask) return;
    if (this._nightAlpha < 0.02) { this._lightMask.setVisible(false); return; }

    this._lightMask.setVisible(true);
    this._lightMask.clear();
    this._lightMask.fill((this._nightR << 16) | (this._nightG << 8) | this._nightB, this._nightAlpha);

    const cam = this.cameras.main;
    const ox  = 200; // compensate for the -200px origin offset of the render texture
    const LG  = 150; // half of light_lg (300px)
    const SM  = 90;  // half of light_sm (180px)

    if (this.player) {
      const px = (this.player.x - cam.scrollX) + ox;
      const py = (this.player.y - cam.scrollY) + ox;
      this._lightMask.erase('light_lg', px - LG, py - LG);
    }

    this.buildings.forEach(b => {
      if (b.isDestroyed || !b.worker) return;
      const wx = (b.worker.x - cam.scrollX) + ox;
      const wy = (b.worker.y - cam.scrollY) + ox;
      this._lightMask.erase('light_sm', wx - SM, wy - SM);
    });
  }

  onSheepKilled() {
    this.sheepsKilled++;
    if (this.sheepText) this.sheepText.setText(`Sheeps Killed: ${this.sheepsKilled}/3`);
    if (this.sheepsKilled === 3) {
      this.buildings.forEach(building => building.destroyBuilding());
      this.showToast('BE NICE TO SHEEP! ALL DAGS DELETED!', 'danger');
    }
  }

  _scatterDecorations() {
    const decoPool = [];
    for (let i = 1; i <= 18; i++) decoPool.push({ key: `deco${i}`, frame: undefined });
    for (let i = 1; i <= 4; i++) {
      for (let f = 0; f < 8; f++) decoPool.push({ key: `bushe${i}`, frame: f });
    }
    for (let i = 1; i <= 4; i++) decoPool.push({ key: `rock${i}`, frame: undefined });

    for (let i = 0; i < this.dags.length * 8; i++) {
      const row = Phaser.Math.Between(0, this.gen.rows - 1);
      const col = Phaser.Math.Between(0, this.gen.cols - 1);
      if (this.gen.grid[row][col] !== 1) continue;

      const tileX = col * 64 + 32;
      const tileY = row * 64 + 64;

      if (Math.random() > 0.6) {
        this.add.image(tileX, tileY, 'tree', Phaser.Math.Between(0, 11))
          .setOrigin(0.5, 1).setDepth(tileY).setScale(0.8);
      } else {
        const d = Phaser.Utils.Array.GetRandom(decoPool);
        this.add.image(tileX, tileY - 10, d.key, d.frame)
          .setOrigin(0.5, 1).setDepth(tileY);
      }
    }
  }

  _createPlayer(spawnSpot) {
    const spawnX = spawnSpot ? spawnSpot.c * 64 + 32 : 500;
    const spawnY = spawnSpot ? spawnSpot.r * 64 + 32 : 500;

    this.player = this.physics.add.sprite(spawnX, spawnY, 'warrior').setScale(0.75).setDepth(spawnY);
    this.player.body.setSize(32, 16).setOffset(80, 170);
    this.player.play('p_idle');

    if (this._playerHint) this._playerHint.destroy();
    this._playerHint = this.add.text(spawnX, spawnY + 52, 'E: INTERACT   SPACE: ATTACK', {
      ...PF, fontSize: '7px', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#00000077', padding: { x: 7, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(1).setDepth(spawnY + 9000).setVisible(false);

    if (this.minimap) this.minimap.ignore(this._playerHint);
  }

  _createNPCs() {
    this.sheeps = [];
    for (let i = 0; i < 40; i++) {
      const row = Phaser.Math.Between(5, this.gen.rows - 5);
      const col = Phaser.Math.Between(5, this.gen.cols - 5);
      if (this.gen.grid[row][col] !== 1) continue;
      this.sheeps.push(new Sheep(this, col * 64 + 32, row * 64 + 32));
    }
  }

  _handleAttack() {
    if (this.isAttacking || this.menuOpen) return;
    this.isAttacking = true;
    this.player.play('p_attack');

    this.buildings.forEach(building => {
      if (building.isDestroyed) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, building.wx, building.wy - 20) < 120) {
        building.takeDamage();
      }
    });

    this.sheeps.forEach(sheep => {
      if (sheep.isDead) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, sheep.sprite.x, sheep.sprite.y) < 80) {
        sheep.takeDamage();
      }
    });

    this.player.once('animationcomplete', () => {
      this.isAttacking = false;
      this.player.play('p_idle');
    });
  }

  _onDagSuccess() {
    this.dagSuccessCount++;
    const newLevel = Math.min(10, this.dagSuccessCount + 1);
    if (newLevel > this._playerLevel) {
      this._playerLevel = newLevel;
      this._onLevelUp(newLevel);
    }
  }

  _onLevelUp(level) {
    const levelText = document.getElementById('level-text');
    const levelName = document.getElementById('level-name');
    const levelPanel = document.getElementById('level-panel');
    const flash = document.getElementById('level-flash');

    if (levelText) levelText.textContent = `LVL ${level}`;
    if (levelName) levelName.textContent = LEVEL_NAMES[level] || '';

    if (levelPanel) {
      levelPanel.classList.remove('level-up-pulse');
      void levelPanel.offsetWidth; // force reflow to restart animation
      levelPanel.classList.add('level-up-pulse');
      levelPanel.addEventListener('animationend', () => levelPanel.classList.remove('level-up-pulse'), { once: true });
    }

    if (flash) {
      flash.style.opacity = '0.4';
      setTimeout(() => { flash.style.opacity = '0'; }, 50);
    }

    this.showToast(`LEVEL UP!  LVL ${level} — ${LEVEL_NAMES[level] || ''}`, 'success');
  }

  _repositionHud() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (this.minimap && this.miniFrame) {
      this.minimap.setPosition(W - 220, H - 220);
      this.miniFrame.setPosition(W - 120, H - 120);
    }
    if (this.sheepBanner) this.sheepBanner.setPosition(20, H - 20);
    if (this.sheepText)   this.sheepText.setPosition(40, H - 50);
    if (this._bannerCenter) {
      this._bannerCenter.setX(W / 2);
      this._bannerTitle.setX(W / 2);
    }
  }

  update(time, delta) {
    if (!this.player) return;

    if (this._cycleTime !== undefined) this._updateDayNight(delta);
    this._updateLightMask();
    this._repositionHud();

    this.sheeps.forEach(sheep => sheep.update());

    if (this.menuOpen) { this.player.setVelocity(0); return; }
    if (this.isAttacking) return;

    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown  || this.wasd.A.isDown) velocityX = -PLAYER_SPEED;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) velocityX =  PLAYER_SPEED;

    if (this.cursors.up.isDown    || this.wasd.W.isDown) velocityY = -PLAYER_SPEED;
    else if (this.cursors.down.isDown  || this.wasd.S.isDown) velocityY =  PLAYER_SPEED;

    if (velocityX !== 0 && velocityY !== 0) {
      // 0.707 ≈ 1/√2 — keeps diagonal speed equal to cardinal speed
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    this.player.setVelocity(velocityX, velocityY);

    if (velocityX < 0) this.player.setFlipX(true);
    else if (velocityX > 0) this.player.setFlipX(false);

    const isMoving = velocityX !== 0 || velocityY !== 0;
    this.player.play(isMoving ? 'p_walk' : 'p_idle', true);
    this.player.setDepth(this.player.y);

    let nearestBuilding = null;
    let nearestDistance = INTERACT_RADIUS;
    let nearestIsWorker = false;

    this.buildings.forEach(building => {
      if (building.isDestroyed) return;
      const dBuilding = Phaser.Math.Distance.Between(this.player.x, this.player.y, building.wx, building.wy - 30);
      if (dBuilding < nearestDistance) {
        nearestBuilding = building; nearestDistance = dBuilding; nearestIsWorker = false;
      }
      if (building.worker) {
        const dWorker = Phaser.Math.Distance.Between(this.player.x, this.player.y, building.worker.x, building.worker.y);
        if (dWorker < nearestDistance) {
          nearestBuilding = building; nearestDistance = dWorker; nearestIsWorker = true;
        }
      }
    });

    this.buildings.forEach(building => building.setNear(building === nearestBuilding));
    this.nearBuilding    = nearestBuilding;
    this.interactWithWorker = nearestIsWorker;

    if (this._playerHint) {
      if (nearestBuilding) {
        this._playerHint.setPosition(this.player.x, this.player.y + 52).setDepth(this.player.y + 9000).setVisible(true);
      } else {
        this._playerHint.setVisible(false);
      }
    }

    this.npcs.forEach(npc => npc.setDepth(npc.y));

    if (this.clouds) {
      this.clouds.forEach(cloud => {
        cloud.x += cloud._driftSpeed;
        if (cloud.x > cloud._worldWidth) cloud.x = 0;
      });
    }
  }

  _handleInteract() {
    if (this.nearBuilding && !this.nearBuilding.isDestroyed) {
      this.menuOpen = true;
      if (this.interactWithWorker) window.openConversation(this.nearBuilding.dag);
      else window.openMenu(this.nearBuilding.dag);
    }
  }
}
