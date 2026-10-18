# CRISPY - HTML/CSS/JS Animator & Renderer

CRISPY is a web application that allows you to create, preview, tweak with AI, and render HTML/CSS/JS animations into video formats (MP4, WebM) or animated images (GIF, WebP).

---

## Features

- **Live Code Preview:** Instant preview with real-time scaling and transparent background toggling.
- **AI-Powered Code Tweaker:** Refine or generate animations via OpenAI prompt completions.
- **Full Video & GIF Exporter:** Local Puppeteer frame capture and FFmpeg compilation for high quality renders (MP4, WebM, GIF, WebP).
- **Cloudflare Workers Ready:** Deploy the frontend web app and AI generation backend seamlessly on Cloudflare Workers using Cloudflare Assets.

---

## Local Development (With Video/GIF Rendering)

To run CRISPY locally with full headless browser rendering and video export capabilities:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000`.

---

## Cloudflare Workers Setup & Deployment

You can host CRISPY online on Cloudflare Workers.

### 1. Prerequisites
Make sure you are logged into your Cloudflare account via Wrangler CLI:
```bash
npx wrangler login
```

### 2. Configure Environment Variables (Optional)
To provide a default OpenAI API Key for AI prompt completions on your Cloudflare Worker:
```bash
npx wrangler secret put OPENAI_API_KEY
```
*(Alternatively, users can enter their OpenAI API Key directly in the UI)*

### 3. Test Worker Locally
To preview your Cloudflare Worker deployment locally:
```bash
npm run dev:worker
```

### 4. Deploy to Cloudflare Workers
Deploy the application and static assets:
```bash
npm run deploy
```

---

## Architecture Note

- **AI Code Generation (`/api/generate-ai`):** Fully supported on both Node.js server and Cloudflare Workers edge environment.
- **Media Rendering (`/api/render`):** Full Puppeteer and FFmpeg binary frame capture requires a Node.js server environment (`npm start`). On Cloudflare Workers edge environments, the frontend displays clear guidance for video rendering requirements.
