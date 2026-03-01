'use strict';

/**
 * Wrapper around the Dagventure backend API.
 *
 * All Airflow operations are now handled server-side via apache-airflow-client.
 * The game page lives at /dagventure/game, so the relative base "api/"
 * resolves to /dagventure/api/ on any deployment.
 */
const AirflowApi = (() => {
  const BASE = 'api';

  async function getDags(limit = 100) {
    const response = await fetch(`${BASE}/dags?limit=${limit}`);
    if (!response.ok) throw new Error(`getDags failed: ${response.status}`);
    return response.json();
  }

  async function getDagRuns(dagId, { limit = 1, orderBy = '-start_date' } = {}) {
    const response = await fetch(
      `${BASE}/dags/${encodeURIComponent(dagId)}/runs?limit=${limit}&order_by=${orderBy}`
    );
    return response.ok ? response.json() : { dag_runs: [] };
  }

  async function getTaskInstances(dagId, runId) {
    const response = await fetch(
      `${BASE}/dags/${encodeURIComponent(dagId)}/runs/${encodeURIComponent(runId)}/tasks`
    );
    if (!response.ok) throw new Error(`getTaskInstances failed: ${response.status}`);
    return response.json();
  }

  /** Returns the raw Response so the caller can inspect content-type. */
  async function getTaskLogs(dagId, runId, taskId, tryNumber, mapIndex = -1) {
    const response = await fetch(
      `${BASE}/dags/${encodeURIComponent(dagId)}` +
      `/runs/${encodeURIComponent(runId)}` +
      `/tasks/${encodeURIComponent(taskId)}` +
      `/logs/${tryNumber || 1}?map_index=${mapIndex}`
    );
    if (!response.ok) throw new Error(`getTaskLogs failed: ${response.status}`);
    return response;
  }

  async function triggerDag(dagId) {
    return fetch(`${BASE}/dags/${encodeURIComponent(dagId)}/trigger`, {
      method: 'POST',
    });
  }

  async function setPaused(dagId, isPaused) {
    return fetch(
      `${BASE}/dags/${encodeURIComponent(dagId)}/pause?is_paused=${isPaused}`,
      { method: 'PATCH' }
    );
  }

  async function deleteDag(dagId) {
    return fetch(`${BASE}/dags/${encodeURIComponent(dagId)}`, {
      method: 'DELETE',
    });
  }

  return { getDags, getDagRuns, getTaskInstances, getTaskLogs, triggerDag, setPaused, deleteDag };
})();
