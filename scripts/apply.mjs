#!/usr/bin/env node
/**
 * Queue applications for today's top matches.
 * This does NOT log into LinkedIn/Indeed or POST to an ATS.
 * It writes letters + official apply URLs so you (or a human) submit them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const profile = JSON.parse(await readFile(join(root, 'data/profile.json'), 'utf8'))
const scan = JSON.parse(await readFile(join(root, 'public/data/jobs.json'), 'utf8'))
const logPath = join(root, 'data/applications.json')

let log = { applications: [] }
try {
  log = JSON.parse(await readFile(logPath, 'utf8'))
} catch {
  /* first run */
}

const appliedIds = new Set(log.applications.map((row) => row.jobId))
const limit = Number(process.env.APPLY_LIMIT || profile.dailyApplyLimit || 5)
const queue = scan.jobs.filter((job) => !appliedIds.has(job.id)).slice(0, limit)

function letter(job) {
  return profile.coverLetterTemplate
    .replaceAll('{title}', job.title)
    .replaceAll('{company}', job.company)
    .replaceAll('{location}', job.location)
    .replaceAll('{source}', job.source)
    .replaceAll('{skills}', profile.skills.slice(0, 5).join(', '))
    .replaceAll('{name}', profile.fullName)
    .replaceAll('{email}', profile.email)
}

const day = new Date().toISOString().slice(0, 10)
const outboxDir = join(root, 'outbox')
await mkdir(outboxDir, { recursive: true })

const lines = [`# Applications queued ${day}\n`, `Submit these on the employer site. Job Radar does not send them for you.\n`]

for (const job of queue) {
  const cover = letter(job)
  log.applications.unshift({
    jobId: job.id,
    title: job.title,
    company: job.company,
    url: job.applyUrl || job.url,
    queuedAt: new Date().toISOString(),
    status: 'queued',
    coverLetter: cover,
  })
  lines.push(`## ${job.title} — ${job.company}\n- Apply: ${job.applyUrl || job.url}\n- Score: ${job.score}\n\n${cover}\n`)
}

await writeFile(logPath, JSON.stringify(log, null, 2))
await writeFile(join(outboxDir, `${day}.md`), lines.join('\n'))
console.log(`queued ${queue.length} applications -> outbox/${day}.md`)
if (!queue.length) console.log('Nothing new to queue. Run npm run scan first, or you already queued today\'s matches.')
