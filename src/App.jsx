import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { getDeploymentStatus, startDeployment } from './services/deploymentService.js'
import { diagnoseProblem } from './services/diagnosisService.js'

function formatEventLine(e) {
  const when = new Date(e.at).toLocaleString()
  return `${when} — ${e.type}: ${e.message}`
}

function renderAssistantPayload(payload) {
  if (payload == null) return null
  if (typeof payload === 'string') return <div className="msgText">{payload}</div>

  if (payload.kind === 'status') {
    return (
      <div className="msgText">
        <div className="kvGrid">
          <div className="k">App</div>
          <div className="v">{payload.appName}</div>
          <div className="k">Status</div>
          <div className="v">{payload.status}</div>
          <div className="k">Mode</div>
          <div className="v">{payload.mode ?? '—'}</div>
          <div className="k">Servers</div>
          <div className="v">{payload.servers ?? '—'}</div>
          <div className="k">Updated</div>
          <div className="v">{new Date(payload.lastUpdatedAt).toLocaleString()}</div>
        </div>
        {payload.lastError ? <div className="alert">Last error: {payload.lastError}</div> : null}
        {payload.recentEvents?.length ? (
          <div className="subBlock">
            <div className="subTitle">Recent events</div>
            <ul className="list">
              {payload.recentEvents.map((e) => (
                <li key={`${e.at}-${e.type}`}>{formatEventLine(e)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  if (payload.kind === 'diagnosis') {
    return (
      <div className="msgText">
        <div className="subTitle">Summary</div>
        <div className="paragraph">{payload.summary}</div>

        <div className="subTitle">Likely causes</div>
        <ul className="list">
          {payload.likelyCauses.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <div className="subTitle">Remedies</div>
        <ul className="list">
          {payload.remedies.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <div className="subTitle">Questions to confirm</div>
        <ul className="list">
          {payload.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>
    )
  }

  return <pre className="msgPre">{JSON.stringify(payload, null, 2)}</pre>
}

function App() {
  const [messages, setMessages] = useState(() => [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      payload:
        'Hi, I am Askmehow. Choose an action below or type a request. Supported actions: (1) deployment status for Application A, (2) deploy to single or multiple servers, (3) identify a problem and get remedies.',
      at: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [deployMode, setDeployMode] = useState('single')
  const [serverCount, setServerCount] = useState(3)
  const scrollRef = useRef(null)

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  function addMessage(role, payload) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        payload,
        at: Date.now(),
      },
    ])
  }

  async function handleStatus() {
    setBusy(true)
    try {
      const status = await getDeploymentStatus('Application A')
      addMessage('assistant', { kind: 'status', ...status })
    } catch (e) {
      addMessage('assistant', `Unable to fetch deployment status. ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeploy() {
    setBusy(true)
    try {
      const mode = deployMode === 'single' ? 'single_server' : 'multi_server'
      const servers = mode === 'single_server' ? 1 : Math.max(2, Number(serverCount) || 2)
      const targetNodes =
        mode === 'single_server'
          ? ['node-1']
          : Array.from({ length: servers }, (_, i) => `node-${i + 1}`)
      const status = await startDeployment({ appName: 'Application A', mode, servers, targetNodes })
      addMessage('assistant', { kind: 'status', ...status })
    } catch (e) {
      addMessage('assistant', `Unable to start deployment. ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleDiagnose(problemText) {
    setBusy(true)
    try {
      const result = await diagnoseProblem(problemText)
      addMessage('assistant', { kind: 'diagnosis', ...result })
    } catch (e) {
      addMessage('assistant', `Unable to diagnose problem. ${e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onSend() {
    const text = input.trim()
    if (!text) return

    addMessage('user', text)
    setInput('')

    const normalized = text.toLowerCase()
    if (normalized.includes('status') || normalized.includes('deployment status')) {
      await handleStatus()
      return
    }
    if (normalized.startsWith('deploy') || normalized.includes('deploy application')) {
      await handleDeploy()
      return
    }
    await handleDiagnose(text)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">Askmehow</div>
          <div className="brandSub">Chat system for deployment help</div>
        </div>
        <div className="actionsRow">
          <button className="btn" onClick={handleStatus} disabled={busy}>
            Status (App A)
          </button>
          <button className="btn" onClick={handleDeploy} disabled={busy}>
            Deploy
          </button>
        </div>
      </header>

      <main className="main">
        <section className="panel">
          <div className="panelTitle">Deploy options</div>
          <div className="field">
            <label className="label">Mode</label>
            <select className="select" value={deployMode} onChange={(e) => setDeployMode(e.target.value)} disabled={busy}>
              <option value="single">Single server</option>
              <option value="multi">Multiple servers</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Servers</label>
            <input
              className="input"
              type="number"
              min={2}
              value={deployMode === 'single' ? 1 : serverCount}
              onChange={(e) => setServerCount(e.target.value)}
              disabled={busy || deployMode === 'single'}
            />
          </div>
          <div className="hint">Deploy uses a local mock state machine (queued → running → verifying → succeeded/failed).</div>
        </section>

        <section className="chat">
          <div className="chatScroll" ref={scrollRef}>
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === 'user' ? 'msgUser' : 'msgAssistant'}`}>
                <div className="msgMeta">
                  <span className="msgRole">{m.role === 'user' ? 'You' : 'Askmehow'}</span>
                  <span className="msgTime">{new Date(m.at).toLocaleTimeString()}</span>
                </div>
                <div className="msgBody">{renderAssistantPayload(m.payload)}</div>
              </div>
            ))}
          </div>

          <div className="composer">
            <textarea
              className="composerInput"
              placeholder="Type: 'status', 'deploy', or describe a problem (e.g., health check failing)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              rows={2}
            />
            <div className="composerRight">
              <button className="btnPrimary" onClick={onSend} disabled={!canSend}>
                {busy ? 'Working…' : 'Send'}
              </button>
              <button
                className="btnSecondary"
                onClick={() => {
                  setMessages((prev) => prev.slice(0, 1))
                }}
                disabled={busy}
              >
                Clear
              </button>
              <button
                className="btnSecondary"
                onClick={async () => {
                  addMessage('user', 'diagnose: health check failing')
                  await handleDiagnose('health check failing')
                }}
                disabled={busy}
              >
                Example
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
