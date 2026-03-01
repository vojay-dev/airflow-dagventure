'use strict';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('water', 'assets/terrain/water/water.png');
    this.load.spritesheet('foam', 'assets/terrain/water/foam/foam.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('ground', 'assets/terrain/ground/tilemap_flat.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('elevation', 'assets/terrain/ground/tilemap_elevation.png', { frameWidth: 64, frameHeight: 64 });
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

    this.load.image('ribbon_blue',            'assets/ui/ribbons/ribbon_blue_3slides.png');
    this.load.image('ribbon_red',             'assets/ui/ribbons/ribbon_red_3slides.png');
    this.load.image('ribbon_yellow',          'assets/ui/ribbons/ribbon_yellow_3slides.png');
    this.load.image('ribbon_connector_left',  'assets/ui/ribbons/ribbon_blue_connection_left.png');
    this.load.image('ribbon_connector_right', 'assets/ui/ribbons/ribbon_blue_connection_right.png');
    this.load.image('minimap_frame', 'assets/ui/banners/carved_9slides.png');
    this.load.spritesheet('tree', 'assets/resources/trees/tree.png', { frameWidth: 192, frameHeight: 192 });

    for (let i = 1; i <= 18; i++) {
      this.load.image(`deco${i}`, `assets/deco/${String(i).padStart(2, '0')}.png`);
    }

    this.load.image('pointer_tl', 'assets/ui/pointers/03.png');
    this.load.image('pointer_tr', 'assets/ui/pointers/04.png');
    this.load.image('pointer_bl', 'assets/ui/pointers/05.png');
    this.load.image('pointer_br', 'assets/ui/pointers/06.png');
  }

  create() {
    window._game = this;
    this._createAnims();

    this.buildings = [];
    this.npcs = [];
    this.sheepsKilled = 0;
    this.obstacles = this.physics.add.staticGroup();
    this.buildingsGroup = this.physics.add.group({ immovable: true });

    this._fetchDags();
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: this._fetchDags,
      callbackScope: this,
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.input.keyboard.on('keydown-E',   () => this._handleInteract());
    this.input.keyboard.on('keydown-SPACE', () => this._handleAttack());
    this.input.keyboard.on('keydown-ESC', () => {
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
    this.anims.create({
      key: 'p_idle',
      frames: this.anims.generateFrameNumbers('warrior', { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'p_walk',
      frames: this.anims.generateFrameNumbers('warrior', { start: 6, end: 11 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: 'p_attack',
      frames: this.anims.generateFrameNumbers('warrior', { start: 12, end: 17 }),
      frameRate: 15,
      repeat: 0,
    });
    this.anims.create({
      key: 'gob_torch',
      frames: this.anims.generateFrameNumbers('goblin', { start: 0, end: 6 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'sheep_idle',
      frames: this.anims.generateFrameNumbers('sheep_idle_sheet', { start: 0, end: 7 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: 'sheep_walk',
      frames: this.anims.generateFrameNumbers('sheep_bounce_sheet', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'explode',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 8 }),
      frameRate: 12,
      repeat: 0,
    });
  }

  async _fetchDags() {
    try {
      const dagsData = await AirflowApi.getDags();
      const rawDags = (dagsData.dags || []).filter(dag => dag.is_active !== false);

      const runResults = await Promise.all(
        rawDags.map(dag => AirflowApi.getDagRuns(dag.dag_id))
      );

      const dags = rawDags.map((rawDag, index) => {
        const latestRun = runResults[index].dag_runs?.[0];

        let state;
        if (rawDag.is_paused) {
          state = 'paused';
        } else if (!latestRun) {
          state = 'never_run';
        } else {
          state = latestRun.state || 'never_run';
        }

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

      document.getElementById('hud-dags').textContent = `${dags.length} DAGs Online`;

      if (!this.dags) {
        // First fetch — build the entire world
        this.dags = dags;
        this._initWorld(dags);
        return;
      }

      // Subsequent fetches — update incrementally without rebuilding
      this.dags = dags;

      // Update state on buildings that still exist in the API response
      this.buildings.forEach(building => {
        if (building.isDestroyed) return;
        const matchingDag = dags.find(dag => dag.dag_id === building.dag.dag_id);
        if (matchingDag) {
          building.updateState(matchingDag);
        }
      });

      // Remove buildings for DAGs that were destroyed or deleted externally
      const activeDagIds = new Set(dags.map(dag => dag.dag_id));
      this.buildings = this.buildings.filter(building => {
        if (building.isDestroyed) return false;
        if (!activeDagIds.has(building.dag.dag_id)) {
          building.destroy();
          return false;
        }
        return true;
      });

      // Spawn buildings for brand-new DAGs
      const existingDagIds = new Set(this.buildings.map(building => building.dag.dag_id));
      const newDags = dags.filter(dag => !existingDagIds.has(dag.dag_id));

      for (const dag of newDags) {
        const spot = this._allSpots?.[this._nextSpotIdx];
        if (spot) {
          const worldX = spot.c * 64 + 32;
          const worldY = spot.r * 64 + 32;
          const building = new DagBuilding(this, worldX, worldY, dag);
          this.buildings.push(building);
          this.buildingsGroup.add(building.sprite);
          this._nextSpotIdx++;
        }
      }
    } catch (error) {
      if (!this.dags) {
        // API unreachable on first load — use demo data
        const demoDags = Array.from({ length: 15 }, (_, i) => ({
          dag_id:    `dag_${i + 1}`,
          state:     'success',
          is_paused: false,
          tags:      [],
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
    const worldWidth = this.gen.cols * 64;
    const worldHeight = this.gen.rows * 64;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.waterBg = this.add.tileSprite(0, 0, worldWidth, worldHeight, 'water')
      .setOrigin(0)
      .setDepth(0);

    // Place ground tiles and water collision blocks
    for (let row = 0; row < this.gen.rows; row++) {
      for (let col = 0; col < this.gen.cols; col++) {
        const tileX = col * 64 + 32;
        const tileY = row * 64 + 32;

        if (this.gen.grid[row][col] === 1) {
          // Land tile — pick edge/corner frame based on neighbours
          const hasUp    = this.gen.getTile(row - 1, col) === 1;
          const hasDown  = this.gen.getTile(row + 1, col) === 1;
          const hasLeft  = this.gen.getTile(row, col - 1) === 1;
          const hasRight = this.gen.getTile(row, col + 1) === 1;

          let tileFrame = 11; // interior tile (default)
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
          // Water tile — invisible static body to block movement
          this.obstacles.create(tileX, tileY, null).setVisible(false).body.setSize(64, 64);
        }
      }
    }

    // Extra 50 spots buffered so new DAGs can be placed without a world rebuild
    const totalSpots = dags.length + 1 + 50;
    const spots = this.gen.getLandSpots(totalSpots);
    this._allSpots = spots;
    this._nextSpotIdx = dags.length + 1; // first slot after player + initial buildings

    // Place initial buildings
    dags.forEach((dag, index) => {
      const spot = spots[index + 1] || spots[1];
      const worldX = spot.c * 64 + 32;
      const worldY = spot.r * 64 + 32;
      const building = new DagBuilding(this, worldX, worldY, dag);
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

    // Minimap setup
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

    // Sheep kill counter banner
    this.sheepBanner = this.add.nineslice(
      20, window.innerHeight - 20,
      'minimap_frame', null, 240, 60, 32, 32, 32, 32
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(10000);

    this.sheepText = this.add.text(
      40, window.innerHeight - 50,
      `Sheeps Killed: ${this.sheepsKilled}/3`,
      { ...PF, fontSize: '10px', color: '#fff' }
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10001);

    // Exclude HUD elements from minimap
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

    this._bannerTitle = this.add.text(bx, by + bannerH / 2, 'DAGVENTURE', {
      ...PF,
      fontSize: '14px',
      color:    '#ffffff',
      stroke:   '#1a3a50',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10003);

    this.minimap.ignore([this._bannerCenter, this._bannerTitle]);
  }

  _makeCloudTex(key, puffs, gridW, gridH) {
    if (this.textures.exists(key)) return;

    const pixelSize = 8;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff, 1);

    for (let row = 0; row < gridH; row++) {
      for (let col = 0; col < gridW; col++) {
        const isInsidePuff = puffs.some(([centerX, centerY, radiusX, radiusY]) => {
          const normalizedDX = (col + 0.5 - centerX) / radiusX;
          const normalizedDY = (row + 0.5 - centerY) / radiusY;
          return normalizedDX * normalizedDX + normalizedDY * normalizedDY <= 1;
        });

        if (isInsidePuff) {
          graphics.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
        }
      }
    }

    graphics.generateTexture(key, gridW * pixelSize, gridH * pixelSize);
    graphics.destroy();
  }

  _createClouds(worldWidth, worldHeight) {
    this._makeCloudTex('cloud_sm', [[6.5, 2, 3.5, 2], [3, 3.5, 2.5, 1.5], [10, 3.5, 2.5, 1.5]], 13, 5);
    this._makeCloudTex('cloud_md', [[10, 2.5, 5, 2.5], [3.5, 4, 3, 2], [16.5, 4, 3, 2]], 20, 6);
    this._makeCloudTex('cloud_lg', [[13, 2.5, 7, 3], [5, 4, 4, 2.5], [9, 3.5, 4, 2.5], [17, 3.5, 4, 2.5], [21, 4, 4, 2.5]], 26, 7);

    const cloudKeys = ['cloud_sm', 'cloud_sm', 'cloud_md', 'cloud_md', 'cloud_lg'];
    this.clouds = [];

    for (let i = 0; i < 15; i++) {
      const key = Phaser.Utils.Array.GetRandom(cloudKeys);
      const cloud = this.add.image(
        Phaser.Math.Between(0, worldWidth),
        Phaser.Math.Between(0, worldHeight),
        key
      ).setDepth(9000).setAlpha(Phaser.Math.FloatBetween(0.45, 0.8));

      cloud._driftSpeed = Phaser.Math.FloatBetween(0.3, 0.8);
      cloud._worldWidth = worldWidth;
      this.clouds.push(cloud);
    }

    this.minimap.ignore(this.clouds);
  }

  onSheepKilled() {
    this.sheepsKilled++;

    if (this.sheepText) {
      this.sheepText.setText(`Sheeps Killed: ${this.sheepsKilled}/3`);
    }

    if (this.sheepsKilled === 3) {
      this.buildings.forEach(building => building.destroyBuilding());

      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'BE NICE TO SHEEP! ALL DAGS DELETED!';
        toast.style.opacity = '1';
        toast.style.backgroundColor = 'rgba(255,0,0,0.8)';
        toast.style.color = 'white';
        setTimeout(() => { toast.style.opacity = '0'; }, 5000);
      }
    }
  }

  _scatterDecorations() {
    for (let i = 0; i < this.dags.length * 8; i++) {
      const row = Phaser.Math.Between(0, this.gen.rows - 1);
      const col = Phaser.Math.Between(0, this.gen.cols - 1);

      if (this.gen.grid[row][col] !== 1) continue;

      const tileX = col * 64 + 32;
      const tileY = row * 64 + 64;

      if (Math.random() > 0.6) {
        const treeVariant = Phaser.Math.Between(0, 11);
        this.add.image(tileX, tileY, 'tree', treeVariant)
          .setOrigin(0.5, 1)
          .setDepth(tileY)
          .setScale(0.8);
      } else {
        const decoIndex = Phaser.Math.Between(1, 18);
        this.add.image(tileX, tileY - 10, `deco${decoIndex}`)
          .setOrigin(0.5, 1)
          .setDepth(tileY);
      }
    }
  }

  _createPlayer(spawnSpot) {
    const spawnX = spawnSpot ? spawnSpot.c * 64 + 32 : 500;
    const spawnY = spawnSpot ? spawnSpot.r * 64 + 32 : 500;

    this.player = this.physics.add.sprite(spawnX, spawnY, 'warrior')
      .setScale(0.75)
      .setDepth(spawnY);
    this.player.body.setSize(32, 16).setOffset(80, 170);
    this.player.play('p_idle');

    // Floating prompt shown under the player when near a building/worker
    if (this._playerHint) this._playerHint.destroy();
    this._playerHint = this.add.text(spawnX, spawnY + 52, 'E: INTERACT   SPACE: ATTACK', {
      ...PF,
      fontSize: '7px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#00000077',
      padding: { x: 7, y: 4 },
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
      const distanceToBuilding = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        building.wx, building.wy - 20
      );
      if (distanceToBuilding < 120) {
        building.takeDamage();
      }
    });

    this.sheeps.forEach(sheep => {
      if (sheep.isDead) return;
      const distanceToSheep = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sheep.sprite.x, sheep.sprite.y
      );
      if (distanceToSheep < 80) {
        sheep.takeDamage();
      }
    });

    this.player.once('animationcomplete', () => {
      this.isAttacking = false;
      this.player.play('p_idle');
    });
  }

  update() {
    if (!this.player) return;

    // Keep minimap and its frame anchored to screen corners
    if (this.minimap && this.miniFrame) {
      this.minimap.setPosition(window.innerWidth - 220, window.innerHeight - 220);
      this.miniFrame.setPosition(window.innerWidth - 120, window.innerHeight - 120);
    }

    if (this.sheepBanner && this.sheepText) {
      this.sheepBanner.setPosition(20, window.innerHeight - 20);
      this.sheepText.setPosition(40, window.innerHeight - 50);
    }

    if (this._bannerCenter) {
      const bx = window.innerWidth / 2;
      this._bannerCenter.setX(bx);
      this._bannerTitle.setX(bx);
    }

    this.sheeps.forEach(sheep => sheep.update());

    // Block movement while menu is open or attack animation is playing
    if (this.menuOpen) {
      this.player.setVelocity(0);
      return;
    }
    if (this.isAttacking) {
      return;
    }

    // Player movement
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      velocityX = -PLAYER_SPEED;
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      velocityX = PLAYER_SPEED;
    }

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      velocityY = -PLAYER_SPEED;
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      velocityY = PLAYER_SPEED;
    }

    // Normalize diagonal movement so it doesn't move faster
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    this.player.setVelocity(velocityX, velocityY);

    // Flip sprite to face movement direction
    if (velocityX < 0) {
      this.player.setFlipX(true);
    } else if (velocityX > 0) {
      this.player.setFlipX(false);
    }

    // Play walk or idle animation
    const isMoving = velocityX !== 0 || velocityY !== 0;
    if (isMoving) {
      this.player.play('p_walk', true);
    } else {
      this.player.play('p_idle', true);
    }

    this.player.setDepth(this.player.y);

    // Animate water background
    this.waterBg.tilePositionX += 0.4;
    this.waterBg.tilePositionY += 0.2;

    // Find the nearest building or worker within interact radius
    let nearestBuilding = null;
    let nearestDistance = INTERACT_RADIUS;
    let nearestIsWorker = false;

    this.buildings.forEach(building => {
      if (building.isDestroyed) return;

      const distanceToBuilding = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        building.wx, building.wy - 30
      );
      if (distanceToBuilding < nearestDistance) {
        nearestBuilding = building;
        nearestDistance = distanceToBuilding;
        nearestIsWorker = false;
      }

      if (building.worker) {
        const distanceToWorker = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          building.worker.x, building.worker.y
        );
        if (distanceToWorker < nearestDistance) {
          nearestBuilding = building;
          nearestDistance = distanceToWorker;
          nearestIsWorker = true;
        }
      }
    });

    this.buildings.forEach(building => building.setNear(building === nearestBuilding));
    this.nearBuilding = nearestBuilding;
    this.interactWithWorker = nearestIsWorker;

    // Floating interaction prompt beneath the player
    if (this._playerHint) {
      if (nearestBuilding) {
        this._playerHint
          .setPosition(this.player.x, this.player.y + 52)
          .setDepth(this.player.y + 9000)
          .setVisible(true);
      } else {
        this._playerHint.setVisible(false);
      }
    }

    this.npcs.forEach(npc => npc.setDepth(npc.y));

    // Drift clouds slowly across the world
    if (this.clouds) {
      this.clouds.forEach(cloud => {
        cloud.x += cloud._driftSpeed;
        if (cloud.x > cloud._worldWidth) {
          cloud.x = 0;
        }
      });
    }
  }

  _handleInteract() {
    if (this.nearBuilding && !this.nearBuilding.isDestroyed) {
      this.menuOpen = true;
      if (this.interactWithWorker) {
        window.openConversation(this.nearBuilding.dag);
      } else {
        window.openMenu(this.nearBuilding.dag);
      }
    }
  }
}
