import { apiFetch, ApiError } from './apiClient.js'

const STORAGE_KEY = 'askmehow.deployments.v1'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { deployments: {} }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { deployments: {} }
    if (!parsed.deployments || typeof parsed.deployments !== 'object') return { deployments: {} }
    return parsed
  } catch {
    return { deployments: {} }
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function nowIso() {
  return new Date().toISOString()
}

function ensureApp(state, appName) {
  if (!state.deployments[appName]) {
    state.deployments[appName] = {
      appName,
      status: 'not_started',
      lastUpdatedAt: nowIso(),
      mode: null,
      servers: 0,
      history: [],
      lastError: null,
    }
  }
  return state.deployments[appName]
}

function pushEvent(app, type, message, extra = {}) {
  const event = {
    at: nowIso(),
    type,
    message,
    ...extra,
  }
  app.history = Array.isArray(app.history) ? app.history : []
  app.history.push(event)
  app.lastUpdatedAt = event.at
  return event
}

function normalizeStatusResponse(appName, data) {
  if (!data || typeof data !== 'object') {
    throw new ApiError('Invalid status response shape', { status: 0, body: data })
  }

  const recentEvents = Array.isArray(data.recentEvents)
    ? data.recentEvents
    : Array.isArray(data.history)
      ? data.history
      : []

  return {
    appName: data.appName || appName,
    status: data.status,
    mode: data.mode ?? null,
    servers: data.servers ?? data.targetNodes?.length ?? 0,
    lastUpdatedAt: data.lastUpdatedAt || data.updatedAt || new Date().toISOString(),
    lastError: data.lastError || data.error || null,
    recentEvents: recentEvents.slice(-5).reverse(),
  }
}

async function tryGetDeploymentStatusFromApi(appName) {
  const data = await apiFetch(`/api/apps/${encodeURIComponent(appName)}/deployment`)
  return normalizeStatusResponse(appName, data)
}

async function tryStartDeploymentFromApi({ appName, mode, servers, targetNodes }) {
  const payload = {
    appName,
    mode,
    servers,
    targetNodes,
  }
  const data = await apiFetch(`/api/apps/${encodeURIComponent(appName)}/deploy`, {
    method: 'POST',
    body: payload,
  })
  return normalizeStatusResponse(appName, data)
}

export async function getDeploymentStatus(appName) {
  try {
    return await tryGetDeploymentStatusFromApi(appName)
  } catch (e) {
    if (e instanceof TypeError || e instanceof ApiError) {
      return getDeploymentStatusLocal(appName)
    }
    throw e
  }
}

function getDeploymentStatusLocal(appName) {
  const state = loadState()
  const app = ensureApp(state, appName)
  saveState(state)
  return {
    appName: app.appName,
    status: app.status,
    mode: app.mode,
    servers: app.servers,
    lastUpdatedAt: app.lastUpdatedAt,
    lastError: app.lastError,
    recentEvents: (app.history || []).slice(-5).reverse(),
  }
}

export async function startDeployment({ appName, mode, servers, targetNodes }) {
  try {
    return await tryStartDeploymentFromApi({ appName, mode, servers, targetNodes })
  } catch (e) {
    if (!(e instanceof TypeError || e instanceof ApiError)) throw e
  }

  const state = loadState()
  const app = ensureApp(state, appName)

  app.mode = mode
  app.servers = servers
  app.status = 'queued'
  app.lastError = null
  pushEvent(app, 'queued', `Deployment queued (${mode}, ${servers} server${servers === 1 ? '' : 's'})`) 
  saveState(state)

  scheduleProgress(appName)

  return getDeploymentStatusLocal(appName)
}

function setStatus(appName, status, eventType, message, extra) {
  const state = loadState()
  const app = ensureApp(state, appName)
  app.status = status
  pushEvent(app, eventType, message, extra)
  saveState(state)
}

function scheduleProgress(appName) {
  setTimeout(() => {
    const cur = getDeploymentStatus(appName)
    if (cur.status !== 'queued') return
    setStatus(appName, 'running', 'running', 'Deployment started')
  }, 600)

  setTimeout(() => {
    const cur = getDeploymentStatus(appName)
    if (cur.status !== 'running') return
    setStatus(appName, 'verifying', 'verifying', 'Running health checks')
  }, 1600)

  setTimeout(() => {
    const cur = getDeploymentStatus(appName)
    if (cur.status !== 'verifying') return

    const shouldFail = Math.random() < 0.15
    if (shouldFail) {
      const state = loadState()
      const app = ensureApp(state, appName)
      app.status = 'failed'
      app.lastError = 'Health check failures detected on one or more instances.'
      pushEvent(app, 'failed', 'Deployment failed', { errorCode: 'HEALTHCHECK_FAILED' })
      saveState(state)
      return
    }

    setStatus(appName, 'succeeded', 'succeeded', 'Deployment succeeded')
  }, 2600)
}
