'use strict';

const PF = {
  fontFamily: "'Press Start 2P', monospace",
  resolution: 3,
};

const PLAYER_SPEED = 280;
const INTERACT_RADIUS = 140;

const STATE_HEX = {
  success:   0x00ff00,
  running:   0xffd700,
  failed:    0xff0000,
  paused:    0x9999ff,
  queued:    0xffa500,
  never_run: 0xcccccc,
};

const STATE_RIBBON = {
  success:   'ribbon_blue',
  running:   'ribbon_yellow',
  failed:    'ribbon_red',
  paused:    'ribbon_blue',
  queued:    'ribbon_yellow',
  never_run: 'ribbon_blue',
};

const STATE_LABEL = {
  success:   'Success',
  running:   'Running',
  failed:    'Failed',
  paused:    'Paused',
  queued:    'Queued',
  never_run: 'New',
};

function getSpriteForDag(dag) {
  let buildingType = 'house';

  if (dag.tags.includes('critical') || dag.dag_id.includes('prod')) {
    buildingType = 'castle';
  } else if (dag.dag_id.includes('sync') || dag.dag_id.includes('etl')) {
    buildingType = 'tower';
  }

  if (dag.state === 'failed') {
    return `${buildingType}_construction`;
  }

  let color = 'blue';
  if (dag.is_paused) {
    color = 'purple';
  } else if (dag.state === 'running') {
    color = 'yellow';
  }

  return `${buildingType}_${color}`;
}
