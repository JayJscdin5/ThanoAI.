# ThanoAI

A small Express chat app powered by the Gemini API. The API key stays on the server; it must never be placed in `public/` or in browser JavaScript.

## Run locally

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and put your Gemini API key in `.env`.
4. Run `npm start` and open `http://localhost:3000`.

## Deploy

Deploy this folder as a Node web service on a host that supports Node.js. Set the start command to `npm start`, then add these private environment variables in the host dashboard:

- `GEMINI_API_KEY`: your Google AI Studio API key
- `GEMINI_MODEL`: `gemini-3.1-flash-lite` (optional)
- `MAX_OUTPUT_TOKENS`: `384` (optional; lower values cap reply length)
- `DAILY_LIMIT_PER_IP`: `50` (optional; per-IP daily request limit)
- `DAILY_LIMIT_TOTAL`: `1000` (optional; total daily request limit across the app)

The app listens on the host-provided `PORT` and serves both the website and `/api/chat` from the same service. Do not upload `.env` or share your API key.

Usage limits are held in memory and reset at UTC midnight or when the server restarts. They are basic request caps, not a hard spending cap. Check your API provider's billing and quota settings before sharing a public link. A public site can use your API allowance, and school network restrictions may still block it.


