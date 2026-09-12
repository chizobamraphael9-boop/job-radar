#!/usr/bin/env node
/**
 * Pull public job feeds, score them against data/profile.json, write public/data/.
 * Sources are official JSON APIs — no LinkedIn/Indeed scraping.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const profile = JSON.parse(await readFile(join(root, 'data/profile.json'), 'utf8'))

function hay(value) {
  return String(value || '').toLowerCase()
}

function scoreJob(job) {
  const blob = hay(`${job.title} ${job.company} ${job.location} ${job.description} ${job.tags.join(' ')}`)
  if (profile.exclude.some((word) => blob.includes(hay(word)))) {
    return { score: 0, reasons: ['excluded by profile'] }
  }
  let score = 0
  const reasons = []
  for (const title of profile.titles) {
    if (blob.includes(hay(title))) {
      score += 6
      reasons.push(`title: ${title}`)
    }
  }
  for (const skill of profile.skills) {
    if (blob.includes(hay(skill))) {
      score += 3
      reasons.push(`skill: ${skill}`)
    }
  }
  for (const loc of profile.locations) {
    if (blob.includes(hay(loc))) {
      score += 4
      reasons.push(`location: ${loc}`)
    }
  }
  const ageHours = (Date.now() - new Date(job.postedAt).getTime()) / 36e5
  if (ageHours <= 24) {
    score += 5
    reasons.push('posted in last 24h')
  } else if (ageHours <= 72) {
    score += 2
    reasons.push('posted this week')
  }
  return { score, reasons: [...new Set(reasons)].slice(0, 8) }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'job-radar/1.0 (personal job search; +https://github.com/chizobamraphael9-boop/job-radar)' },
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

async function fromRemoteOk() {
  const rows = await fetchJson('https://remoteok.com/api')
  return rows
    .filter((row) => row && row.id && row.position)
    .map((row) => ({
      id: `remoteok-${row.id}`,
      source: 'RemoteOK',
      title: row.position,
      company: row.company || 'Unknown company',
      location: row.location || 'Remote',
      url: row.url || row.apply_url || `https://remoteok.com/remote-jobs/${row.id}`,
      applyUrl: row.apply_url || row.url,
      tags: Array.isArray(row.tags) ? row.tags : [],
      description: String(row.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1200),
      postedAt: row.date || new Date().toISOString(),
    }))
}

async function fromArbeitnow() {
  const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api')
  const rows = Array.isArray(data?.data) ? data.data : []
  return rows.map((row) => ({
    id: `arbeitnow-${row.slug || row.url}`,
    source: 'Arbeitnow',
    title: row.title,
    company: row.company_name || 'Unknown company',
    location: (row.location || 'Remote') + (row.remote ? ' · Remote' : ''),
    url: row.url,
    applyUrl: row.url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: String(row.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1200),
    postedAt: row.created_at || new Date().toISOString(),
  }))
}

async function fromRemotive() {
  const data = await fetchJson('https://remotive.com/api/remote-jobs')
  const rows = Array.isArray(data?.jobs) ? data.jobs : []
  return rows.map((row) => ({
    id: `remotive-${row.id}`,
    source: 'Remotive',
    title: row.title,
    company: row.company_name || 'Unknown company',
    location: row.candidate_required_location || 'Remote',
    url: row.url,
    applyUrl: row.url,
    tags: Array.isArray(row.tags) ? row.tags : [row.category].filter(Boolean),
    description: String(row.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1200),
    postedAt: row.publication_date || new Date().toISOString(),
  }))
}

function unique(jobs) {
  const seen = new Set()
  return jobs.filter((job) => {
    const key = `${hay(job.company)}|${hay(job.title)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const collected = []
const errors = []
for (const [name, fn] of [
  ['RemoteOK', fromRemoteOk],
  ['Arbeitnow', fromArbeitnow],
  ['Remotive', fromRemotive],
]) {
  try {
    const batch = await fn()
    collected.push(...batch)
    console.log(`ok  ${name}: ${batch.length}`)
  } catch (error) {
    errors.push({ source: name, message: String(error.message || error) })
    console.warn(`fail ${name}: ${error.message}`)
  }
}

const jobs = unique(collected)
  .map((job) => {
    const { score, reasons } = scoreJob(job)
    return { ...job, score, reasons }
  })
  .filter((job) => job.score >= (profile.minScore || 0))
  .sort((a, b) => b.score - a.score)
  .slice(0, 120)

const payload = {
  scannedAt: new Date().toISOString(),
  profileHeadline: profile.headline,
  sourceErrors: errors,
  count: jobs.length,
  jobs,
}

const outDir = join(root, 'public/data')
await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'jobs.json'), JSON.stringify(payload, null, 2))
await writeFile(
  join(outDir, 'digest.md'),
  `# Job Radar digest (${payload.scannedAt.slice(0, 10)})\n\n${jobs
    .slice(0, 20)
    .map((j, i) => `${i + 1}. **${j.title}** — ${j.company} (${j.score})\n   ${j.url}`)
    .join('\n')}\n`,
)
console.log(`wrote ${jobs.length} matching jobs`)
