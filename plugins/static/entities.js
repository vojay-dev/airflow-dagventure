'use strict';

function _spawnDamageText(scene, x, y) {
  const tx  = x + Phaser.Math.Between(-16, 16);
  const txt = scene.add.text(tx, y, '-1', {
    ...PF, fontSize: '14px', color: '#ff3333', stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5, 0.5).setDepth(y + 9999);
  scene.tweens.add({
    targets: txt, y: y - 55, alpha: 0, duration: 850, ease: 'Power2',
    onComplete: () => txt.destroy(),
  });
}

class ChatBubble extends Phaser.GameObjects.Container {
  constructor(scene, text, state) {
    super(scene, 0, 0);

    const ribbonKey = STATE_RIBBON[state] || 'ribbon_blue';
    this._bg = scene.add.nineslice(0, 0, ribbonKey, null, 100, 48, 24, 24, 20, 20);
    this._bg.setOrigin(0.5, 0.5);

    this._txt = scene.add.text(0, -10, text, {
      ...PF, fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    this.add([this._bg, this._txt]);
    this.redraw(text, state);
    scene.add.existing(this);
  }

  redraw(text, state) {
    this._bg.setTexture(STATE_RIBBON[state] || 'ribbon_blue');
    this._txt.setText(text);
    if (state === 'success') this._bg.setTint(0x88ff88);
    else this._bg.clearTint();
    this._bg.width = Math.max(100, this._txt.width + 48);
  }
}

const CORNER_BASE_SCALE  = 2.0;
const CORNER_PULSE_SCALE = 2.4;

class DagBuilding {
  constructor(scene, wx, wy, dag) {
    this.scene = scene;
    this.wx = wx;
    this.wy = wy;
    this.dag = dag;
    this.worker = null;
    this.hp = 3;
    this.isDestroyed = false;

    const spriteKey = getSpriteForDag(dag);
    this.sprite = scene.physics.add.sprite(wx, wy, spriteKey)
      .setOrigin(0.5, 1).setDepth(wy).setImmovable(true);

    this._resizeHitbox();

    this.label = scene.add.text(wx, wy + 10, dag.dag_id, {
      ...PF, fontSize: '8px', color: '#fff', stroke: '#000', strokeThickness: 3,
      backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 0).setDepth(wy + 1);

    this.bubble = new ChatBubble(scene, STATE_LABEL[dag.state] || dag.state, dag.state);
    this.bubble.setPosition(wx, wy - this.sprite.height - 25).setDepth(wy + 2000).setVisible(true);

    this.corners = this._createCorners();

    this.hearts = scene.add.group();
    for (let i = 0; i < 3; i++) {
      this.hearts.add(
        scene.add.image(wx - 24 + (i * 24), wy - this.sprite.height - 60, 'heart')
          .setScale(0.8).setDepth(wy + 2001).setVisible(false)
      );
    }

    this.updateState(dag);
  }

  _createCorners() {
    const padding  = 40;
    const halfWidth = this.sprite.width / 2 + padding;
    const topY    = this.wy - this.sprite.height - padding;
    const bottomY = this.wy + padding;
    const leftX   = this.wx - halfWidth;
    const rightX  = this.wx + halfWidth;

    // originX/Y anchors each bracket to its bounding-box corner so the "arms"
    // extend inward when scale increases, creating a reach-in pulse effect.
    return [
      { key: 'pointer_tl', x: leftX,  y: topY,    originX: 0, originY: 0 },
      { key: 'pointer_tr', x: rightX, y: topY,    originX: 1, originY: 0 },
      { key: 'pointer_bl', x: leftX,  y: bottomY, originX: 0, originY: 1 },
      { key: 'pointer_br', x: rightX, y: bottomY, originX: 1, originY: 1 },
    ].map(def =>
      this.scene.add.image(def.x, def.y, def.key)
        .setOrigin(def.originX, def.originY)
        .setScale(CORNER_BASE_SCALE)
        .setDepth(this.wy + 2002)
        .setVisible(false)
    );
  }

  _resizeHitbox() {
    const bodyWidth   = this.sprite.width  * 0.9;
    const bodyHeight  = Math.max(50, this.sprite.height * 0.3);
    const bodyOffsetX = this.sprite.width  * 0.05;
    const bodyOffsetY = this.sprite.height - bodyHeight;
    this.sprite.body.setSize(bodyWidth, bodyHeight).setOffset(bodyOffsetX, bodyOffsetY);
  }

  takeDamage() {
    if (this.isDestroyed) return;

    this.hp--;
    this.scene.cameras.main.shake(100, 0.005);

    this.hearts.getChildren().forEach((heart, index) => {
      heart.setVisible(true);
      if (index >= this.hp) heart.setAlpha(0.3).setTint(0x333333);
      else heart.setAlpha(1).clearTint();
    });

    this.scene.tweens.add({ targets: this.sprite, alpha: 0.5, duration: 50, yoyo: true, repeat: 3 });
    _spawnDamageText(this.scene, this.wx, this.wy - this.sprite.height * 0.55);

    if (this.hp <= 0) this.destroyBuilding();
  }

  _startSmoke() {
    if (this._smokeEmitter || this.isDestroyed) return;

    if (!this.scene.textures.exists('smoke_pixel')) {
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xbbbbbb, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('smoke_pixel', 4, 4);
      g.destroy();
    }

    this._smokeEmitter = this.scene.add.particles(this.wx, this.wy - this.sprite.height * 0.88, 'smoke_pixel', {
      x:        { min: -8,  max: 8   },
      speedY:   { min: -35, max: -65 },
      speedX:   { min: -12, max: 12  },
      lifespan: { min: 1100, max: 2000 },
      scale:    { start: 1.0, end: 4.5 },
      alpha:    { start: 0.85, end: 0  },
      tint:     [0xdddddd, 0xcccccc, 0xbbbbbb, 0xaaaaaa],
      frequency: 200,
      quantity:  2,
    }).setDepth(this.wy + 10);

    if (this.scene.minimap) this.scene.minimap.ignore(this._smokeEmitter);
  }

  _stopSmoke() {
    if (this._smokeEmitter) { this._smokeEmitter.destroy(); this._smokeEmitter = null; }
  }

  async destroyBuilding() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this._bracketTween) { this._bracketTween.stop(); this._bracketTween = null; }
    this._stopSmoke();

    const explosion = this.scene.add.sprite(this.wx, this.wy - 40, 'explosion').setDepth(this.wy + 5000).setScale(2);
    explosion.play('explode');
    explosion.on('animationcomplete', () => explosion.destroy());

    this.sprite.setVisible(false);
    this.label.setVisible(false);
    this.bubble.setVisible(false);
    this.corners.forEach(c => c.setVisible(false));
    this.hearts.clear(true, true);

    try {
      await AirflowApi.deleteDag(this.dag.dag_id);
    } catch (error) {
      console.error('Failed to delete DAG', error);
    }
  }

  updateState(dag) {
    if (this.isDestroyed) return;
    this.dag = dag;

    const key = getSpriteForDag(dag);
    if (this.sprite.texture.key !== key) { this.sprite.setTexture(key); this._resizeHitbox(); }

    this.bubble.redraw(STATE_LABEL[dag.state] || dag.state, dag.state);

    if (dag.state === 'running') { this._spawnWorker(); this._startSmoke(); }
    else                          { this._clearWorker(); this._stopSmoke();  }
  }

  _spawnWorker() {
    if (this.worker || this.isDestroyed) return;
    this.worker = this.scene.physics.add.sprite(this.wx + 60, this.wy + 20, 'goblin')
      .setScale(0.7).setDepth(this.wy + 20).setImmovable(true);
    this.worker.body.setSize(40, 20).setOffset(76, 130);
    this.worker.play('gob_torch');
    this.scene.buildingsGroup.add(this.worker);
  }

  _clearWorker() {
    if (this.worker) { this.worker.destroy(); this.worker = null; }
  }

  setNear(isNear) {
    if (this.isDestroyed) return;

    this.bubble.setVisible(true);
    this.corners.forEach(c => c.setVisible(isNear));

    if (isNear && !this._bracketTween) {
      this._bracketTween = this.scene.tweens.add({
        targets: this.corners,
        scale: { from: CORNER_BASE_SCALE, to: CORNER_PULSE_SCALE },
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (!isNear && this._bracketTween) {
      this._bracketTween.stop();
      this._bracketTween = null;
      this.corners.forEach(c => c.setScale(CORNER_BASE_SCALE));
    }

    this.hearts.getChildren().forEach(heart => heart.setVisible(isNear));
  }

  destroy() {
    if (this._bracketTween) { this._bracketTween.stop(); this._bracketTween = null; }
    this._stopSmoke();
    this.sprite.destroy();
    this.label.destroy();
    this.bubble.destroy();
    this.corners.forEach(c => c.destroy());
    this.hearts.destroy(true);
    this._clearWorker();
  }
}

class Sheep {
  constructor(scene, wx, wy) {
    this.scene  = scene;
    this.hp     = 3;
    this.isDead = false;

    this.sprite = scene.physics.add.sprite(wx, wy, 'sheep_idle_sheet').setScale(0.6).setDepth(wy);
    this.sprite.play('sheep_idle');

    this.hearts = scene.add.group();
    for (let i = 0; i < 3; i++) {
      this.hearts.add(
        scene.add.image(wx - 16 + (i * 16), wy - 40, 'heart')
          .setScale(0.5).setDepth(wy + 2001).setVisible(false)
      );
    }

    this.timer = scene.time.addEvent({
      delay: Phaser.Math.Between(3000, 10000),
      loop: true,
      callback: () => {
        if (this.isDead || !this.sprite.active) return;
        if (Math.random() > 0.5) {
          this.sprite.play('sheep_walk');
          const vx = Phaser.Math.Between(-40, 40);
          const vy = Phaser.Math.Between(-40, 40);
          this.sprite.setVelocity(vx, vy);
          this.sprite.setFlipX(vx < 0);
          scene.time.delayedCall(3000, () => {
            if (!this.isDead && this.sprite.active) {
              this.sprite.setVelocity(0);
              this.sprite.play('sheep_idle');
            }
          });
        }
      },
    });
  }

  takeDamage() {
    if (this.isDead) return;
    this.hp--;

    this.hearts.getChildren().forEach((heart, index) => {
      heart.setVisible(true);
      if (index >= this.hp) heart.setAlpha(0.3).setTint(0x333333);
      else heart.setAlpha(1).clearTint();
    });

    this.scene.tweens.add({ targets: this.sprite, alpha: 0.5, duration: 50, yoyo: true, repeat: 3 });
    _spawnDamageText(this.scene, this.sprite.x, this.sprite.y - 30);

    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.sprite.setVelocity(0);

    const explosion = this.scene.add.sprite(this.sprite.x, this.sprite.y, 'explosion')
      .setDepth(this.sprite.y + 10).setScale(1);
    explosion.play('explode');
    explosion.on('animationcomplete', () => explosion.destroy());

    this.sprite.destroy();
    this.hearts.destroy(true);
    this.timer.destroy();

    if (this.scene.onSheepKilled) this.scene.onSheepKilled();
  }

  update() {
    if (this.isDead || !this.sprite.active) return;

    this.sprite.setDepth(this.sprite.y);

    const distToPlayer = Phaser.Math.Distance.Between(
      this.scene.player.x, this.scene.player.y, this.sprite.x, this.sprite.y
    );
    const isNear = distToPlayer < 100;

    this.hearts.getChildren().forEach((heart, index) => {
      heart.setVisible(isNear);
      heart.setPosition(this.sprite.x - 16 + (index * 16), this.sprite.y - 40);
    });
  }
}
