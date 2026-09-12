# Job Radar

**Problem:** Checking five job boards by hand every morning, then losing track of what you already applied to.

**What it does:** Pulls public job APIs once a day, scores each posting against `data/profile.json`, and helps you apply through the **employer’s own apply link**. A GitHub Action can run the scan at 05:00 UTC.

This tool does **not** log into LinkedIn, Indeed, or Greenhouse as you. It does **not** auto-submit application forms. Silent mass-apply bots get accounts banned and send sloppy applications. Radar queues the work; you send it.

## Daily loop

```bash
npm install
npm run scan      # refresh public/data/jobs.json
npm run apply     # queue today’s top matches into outbox/YYYY-MM-DD.md
npm run dev       # dashboard at http://localhost:5173
```

`npm run daily` = scan + queue.

Edit `data/profile.json` (skills, titles, locations, exclude list, daily cap, cover letter template) before you rely on scores.

## Apply file

`npm run apply` writes:

- `data/applications.json` — log
- `outbox/YYYY-MM-DD.md` — cover letters + official URLs to submit

## Sources

RemoteOK, Arbeitnow, and Remotive public JSON APIs. No scraping of authenticated boards.

## GitHub Action

`.github/workflows/daily-scan.yml` commits a fresh digest every day. Enable Actions on the repo after the first push.
