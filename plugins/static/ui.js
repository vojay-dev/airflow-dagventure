'use strict';

if (typeof hljs !== 'undefined') {
  hljs.registerLanguage('airflow-log', () => ({
    contains: [
      { className: 'log-group',     match: /^::(?:group|endgroup)::.*/ },
      { className: 'log-ts',        match: /\[\d{4}-\d{2}-\d{2}T[\d:.]+Z?\]/ },
      { className: 'log-critical',  match: /\bCRITICAL\b/ },
      { className: 'log-error',     match: /\bERROR\b/ },
      { className: 'log-warning',   match: /\b(?:WARNING|WARN)\b/ },
      { className: 'log-info',      match: /\bINFO\b/ },
      { className: 'log-debug',     match: /\bDEBUG\b/ },
      { className: 'log-exception', match: /\b(?:Traceback|Exception)\b/ },
      { className: 'log-path',      match: /\/(?:[\w.\-_]+\/)*[\w.\-_]+\.py(?::\d+)?/ },
    ],
  }));
}

function _highlightLog(lines) {
  if (typeof hljs === 'undefined') {
    // Fallback: just escape HTML if highlight.js failed to load
    return lines
      .map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      .join('\n');
  }
  return lines
    .map(line => hljs.highlight(line, { language: 'airflow-log' }).value)
    .join('\n');
}

// --- Menu helpers ---

function _applyRibbonClass(titleEl, state) {
  titleEl.classList.remove('ribbon-blue', 'ribbon-red', 'ribbon-yellow', 'ribbon-green');
  if (state === 'success') titleEl.classList.add('ribbon-green');
  else if (state === 'failed') titleEl.classList.add('ribbon-red');
  else if (state === 'running' || state === 'queued') titleEl.classList.add('ribbon-yellow');
  else titleEl.classList.add('ribbon-blue');
}

function _makeButton(text, className, onClick) {
  const btn = document.createElement('button');
  btn.className = `menu-btn ${className}`;
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

// --- Public window API ---

window.openMenu = (dag) => {
  const menu  = document.getElementById('interaction-menu');
  const title = document.getElementById('menu-title');
  const state = document.getElementById('menu-state');
  const btns  = document.getElementById('menu-buttons');

  title.textContent = dag.dag_id;
  _applyRibbonClass(title, dag.state);

  state.innerHTML =
    `Status: <b style="color:${STATE_HEX[dag.state] || '#000'}">${STATE_LABEL[dag.state] || dag.state}</b>`;

  btns.innerHTML = '';
  btns.appendChild(_makeButton('▶ Run DAG Now', 'primary', () => window.triggerDag(dag.dag_id)));
  btns.appendChild(_makeButton(
    dag.is_paused ? '▷ Unpause' : '⏸ Pause DAG',
    'warning',
    () => dag.is_paused ? window.unpauseDag(dag.dag_id) : window.pauseDag(dag.dag_id)
  ));

  menu.classList.remove('hidden');
};

window.openConversation = async (dag) => {
  const menu  = document.getElementById('interaction-menu');
  const title = document.getElementById('menu-title');
  const state = document.getElementById('menu-state');
  const btns  = document.getElementById('menu-buttons');

  title.textContent = 'Worker Goblin';
  title.classList.remove('ribbon-blue', 'ribbon-red', 'ribbon-yellow', 'ribbon-green');
  title.classList.add('ribbon-blue');

  state.innerHTML = `"I'm working on <b>${dag.dag_id}</b>!"<br>Recent Tasks:`;
  btns.innerHTML = 'Loading tasks...';

  try {
    const runsData  = await AirflowApi.getDagRuns(dag.dag_id);
    const latestRun = runsData.dag_runs?.[0];

    if (!latestRun) {
      btns.innerHTML = 'No runs yet.';
      menu.classList.remove('hidden');
      return;
    }

    const tiData = await AirflowApi.getTaskInstances(dag.dag_id, latestRun.dag_run_id);
    btns.innerHTML = '';

    (tiData.task_instances || []).slice(0, 6).forEach(t => {
      const tryNum = t.try_number || 1;
      const mapIdx = t.map_index !== undefined ? t.map_index : -1;

      const row = document.createElement('div');
      row.className = 'task-row';
      row.innerHTML =
        `<span style="color:${STATE_HEX[t.state] || '#333'}">●</span>` +
        `<span class="task-name">${t.task_id}</span>` +
        `<div class="task-link" onclick="window.viewLog('${dag.dag_id}','${latestRun.dag_run_id}','${t.task_id}',${tryNum},${mapIdx})">LOGS</div>`;
      btns.appendChild(row);
    });
  } catch (e) {
    btns.innerHTML = 'Failed to load tasks';
  }

  menu.classList.remove('hidden');
};

window.viewLog = async (dagId, runId, taskId, tryNumber, mapIndex) => {
  document.getElementById('log-modal').classList.remove('hidden');
  const content = document.getElementById('log-content');
  content.textContent = 'Loading logs...';

  try {
    const mapIdx = mapIndex !== undefined ? mapIndex : -1;
    const r = await AirflowApi.getTaskLogs(dagId, runId, taskId, tryNumber, mapIdx);

    let lines;
    if ((r.headers.get('content-type') || '').includes('application/json')) {
      const data = await r.json();
      const raw  = data.content;
      if (Array.isArray(raw)) {
        lines = raw.map(e => {
          const ts  = e.timestamp || '';
          const msg = e.event ?? e.message ?? JSON.stringify(e);
          return ts ? `[${ts}] ${msg}` : msg;
        });
      } else {
        lines = (raw || data.logs || '').split('\n');
      }
    } else {
      lines = (await r.text()).split('\n');
    }

    content.innerHTML = _highlightLog(lines);
  } catch (e) {
    content.textContent = 'Error fetching logs.';
  }
};

window.closeMenu = () => {
  document.getElementById('interaction-menu').classList.add('hidden');
  if (window._game) window._game.menuOpen = false;
};

window.triggerDag = async (id) => {
  await AirflowApi.triggerDag(id);
  if (window._game) window._game._fetchDags();
  window.closeMenu();
};

window.pauseDag = async (id) => {
  await AirflowApi.setPaused(id, true);
  if (window._game) window._game._fetchDags();
  window.closeMenu();
};

window.unpauseDag = async (id) => {
  await AirflowApi.setPaused(id, false);
  if (window._game) window._game._fetchDags();
  window.closeMenu();
};

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('log-close').onclick  = () => document.getElementById('log-modal').classList.add('hidden');
  document.getElementById('menu-close').onclick = window.closeMenu;

  await document.fonts.ready;
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-canvas-container',
    backgroundColor: '#3da8b8',
    scene: [GameScene],
    render: { pixelArt: true, antialias: false },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
});
