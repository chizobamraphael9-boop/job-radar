import { useEffect, useMemo, useState } from 'react'

const STORAGE = 'job-radar-applications-v1'

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || '{"applied":[]}')
  } catch {
    return { applied: [] }
  }
}

export default function App() {
  const [scan, setScan] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [source, setSource] = useState('all')
  const [applied, setApplied] = useState(loadLocal().applied)
  const [active, setActive] = useState(null)

  useEffect(() => {
    fetch('/data/jobs.json')
      .then((r) => r.json())
      .then(setScan)
      .catch(() => setError('Could not load scan results. Run npm run scan.'))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify({ applied }))
  }, [applied])

  const jobs = useMemo(() => {
    const list = scan?.jobs || []
    return list.filter((job) => {
      if (source !== 'all' && job.source !== source) return false
      if (!q) return true
      const blob = `${job.title} ${job.company} ${job.location}`.toLowerCase()
      return blob.includes(q.toLowerCase())
    })
  }, [scan, q, source])

  function markApplied(job) {
    if (applied.some((row) => row.id === job.id)) return
    setApplied((rows) => [
      { id: job.id, title: job.title, company: job.company, at: new Date().toISOString(), url: job.applyUrl || job.url },
      ...rows,
    ])
    window.open(job.applyUrl || job.url, '_blank', 'noopener')
    setActive(null)
  }

  const sources = ['all', ...new Set((scan?.jobs || []).map((j) => j.source))]

  return (
    <div className="shell">
      <header className="mast">
        <div>
          <h1>Job Radar</h1>
          <p>
            Daily scan of public job APIs, scored against your profile. Apply opens the
            employer’s official posting — it does not log into LinkedIn or auto-submit forms.
          </p>
        </div>
        <div className="stats">
          <div>
            <strong>{scan?.count ?? '—'}</strong>
            matches
          </div>
          <div>
            <strong>{applied.length}</strong>
            applied
          </div>
        </div>
      </header>

      {error ? <p className="warn">{error}</p> : null}
      {!scan?.scannedAt ? (
        <p className="warn">
          No scan yet. In a terminal: <code>npm run scan</code> then refresh. GitHub Actions can
          run this every morning.
        </p>
      ) : (
        <p className="meta">Last scan {new Date(scan.scannedAt).toLocaleString()}</p>
      )}

      <div className="toolbar">
        <input placeholder="Filter title or company" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          {sources.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {jobs.length === 0 ? <p className="empty">No jobs in view. Scan first or loosen data/profile.json.</p> : null}

      {jobs.map((job) => {
        const done = applied.some((row) => row.id === job.id)
        return (
          <article className="job" key={job.id}>
            <div className="row">
              <h2>{job.title}</h2>
              <span className="score">{job.score}</span>
            </div>
            <p className="meta">
              {job.company} · {job.location} · {job.source}
            </p>
            <p>{job.description.slice(0, 240)}…</p>
            <p className="reasons">{job.reasons?.join(' · ')}</p>
            <div className="row">
              <button type="button" disabled={done} onClick={() => setActive(job)}>
                {done ? 'Queued / opened' : 'Review & apply'}
              </button>
              <a href={job.url} target="_blank" rel="noreferrer">
                Posting
              </a>
            </div>
          </article>
        )
      })}

      {active ? (
        <dialog open onClose={() => setActive(null)}>
          <h2>Apply on the company site</h2>
          <p>
            {active.title} at {active.company}. Job Radar will open the official URL and mark this
            as applied on your machine. You still submit the form yourself.
          </p>
          <div className="row">
            <button type="button" onClick={() => markApplied(active)}>
              Open apply page
            </button>
            <button type="button" className="ghost" onClick={() => setActive(null)}>
              Cancel
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  )
}
