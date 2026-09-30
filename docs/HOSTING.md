# Hosting the public demo ledger

The website (Vercel) is static and runs on sample data. The `Dockerfile`
at the repo root packages a **real Canton ledger** with the Mobilis model
and interface, so judges can click through a live ledger without
installing anything.

- It serves the interface at `/ui/` (for example `/ui/demo-wall.html`).
- It starts with the four demo parties and an empty agreement.
- It is shared by everyone who opens it, and resets to a clean start every
  `RESET_HOURS` (default 6). The app shows a "Public demo ledger" notice.
- It needs about **2 GB of memory** (the Canton sandbox and the JSON API
  are two JVMs), so free tiers with 512 MB are not enough.

## Option A: Fly.io (builds remotely, no Docker needed locally)

```bash
fly auth login
fly launch --no-deploy --name mobilis-demo --region ams --internal-port 7575
fly scale memory 2048
fly deploy
```

Then open `https://mobilis-demo.fly.dev/ui/demo-wall.html`.

## Option B: Render or Railway (deploy from GitHub)

Create a new **Web Service** from `github.com/angelraph/mobilis`, choose
**Docker**, set the port to `7575`, and pick an instance with at least
**2 GB** of memory. Every push to `master` redeploys it.

## Option C: any machine with Docker

```bash
docker build -t mobilis-demo .
docker run -d -p 7575:7575 --restart unless-stopped mobilis-demo
```

## Security note

This is a demo ledger. The interface mints its own tokens (see the note
at the top of `ui/app.js`), so anyone who opens it can act as any of the
four parties. That's intended for a public demo with made-up data, and
it's why the ledger resets on a schedule. A real deployment on Canton
DevNet or MainNet uses the participant's identity provider instead; see
[devnet-deployment.md](devnet-deployment.md).
