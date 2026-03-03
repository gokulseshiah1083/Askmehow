const DEFAULT_BASE_URL = 'http://localhost:8081'

export function getApiBaseUrl() {
  const raw = import.meta?.env?.VITE_API_BASE_URL
  return (raw && String(raw).trim()) || DEFAULT_BASE_URL
}

async function readJsonOrText(res) {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function apiFetch(path, { method = 'GET', headers, body } = {}) {
  const base = getApiBaseUrl().replace(/\/$/, '')
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const parsed = await readJsonOrText(res)
    throw new ApiError(`API request failed: ${method} ${path}`, {
      status: res.status,
      body: parsed,
    })
  }

  if (res.status === 204) return null
  return readJsonOrText(res)
}
