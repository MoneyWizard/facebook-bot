# Facebook Bot 🤖

A Facebook profile scraper bot built with **Node.js**, **Playwright** (stealth), and **GPT-4o** AI analysis.

> [!CAUTION]
> **FOR EDUCATIONAL AND RESEARCH USE ONLY.**
> This tool may violate Meta's Terms of Service and data privacy laws (GDPR, CCPA).
> You assume all legal responsibility for its use. Do not scrape private user data.

---

## Features

- 🕵️ **Stealth Scraping** — Playwright + stealth plugin to evade bot detection
- 👤 **Profile Scraping** — Name, bio, location, work, education, public posts
- 🔍 **People Search** — Search Facebook's people directory by name/location
- 🤖 **GPT-4o Analysis** — Summarize, categorize, privacy audit, sentiment analysis
- ⏰ **Scheduled Jobs** — cron-based recurring scrapes
- 🗃️ **SQLite Storage** — All results stored locally
- 🖥️ **REST API** — Express server with full API
- 💻 **CLI Interface** — Command-line tool with colored output

---

## Prerequisites

- **Node.js v18+** — [Download](https://nodejs.org)
- **OpenAI API Key** — [Get one here](https://platform.openai.com/api-keys)
- **Proxy** *(optional but strongly recommended)* — See proxy section below

---

## Installation

```bash
# 1. Install dependencies
cd D:\facebook-bot
npm install

# 2. Install Playwright's Chromium browser
npx playwright install chromium

# 3. Set up your environment
copy .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

---

## Setting Up Session Cookies (Required for full access)

Without cookies the bot runs as a logged-out user — most profile data will be hidden behind Facebook's login wall.

**Steps:**

1. Install the **Cookie-Editor** Chrome extension:
   [https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)

2. Log in to **Facebook** normally in Chrome.

3. Click the **Cookie-Editor** icon → click **Export** → **Export as JSON**

4. Save the downloaded file as **`cookies/session.json`** inside this project folder.

5. The bot will automatically inject your session on every run.

> [!WARNING]
> Keep `cookies/session.json` private — it contains your Facebook session. It is listed in `.gitignore` by default.

---

## Setting Up a Proxy

Facebook blocks datacenter IPs quickly. A **residential proxy** dramatically improves success rates.

### Free Option — Webshare.io
1. Sign up at [https://webshare.io](https://webshare.io) (10 free residential IPs/month)
2. Go to **Proxy List** → copy your proxy credentials
3. Add to `.env`:
   ```
   PROXY_URL=http://username:password@proxy.webshare.io:80
   ```

### Paid Options (Better reliability)
| Service | URL | Price |
|---|---|---|
| Bright Data | https://brightdata.com | ~\$15/GB |
| Oxylabs | https://oxylabs.io | ~\$15/GB |
| Smartproxy | https://smartproxy.com | ~\$7/GB |

---

## REST API Usage

### Start the server

```bash
npm start
# Server runs at http://localhost:3000
```

### Endpoints

#### Health Check
```bash
curl http://localhost:3000/api/health
```

#### Scrape a Profile
```bash
curl -X POST http://localhost:3000/api/scrape/profile \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.facebook.com/zuck"}'
```

#### Search People
```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -d '{"query": "John Smith", "location": "New York", "maxPages": 2}'
```

#### Analyze with GPT-4o
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"profileId": 1, "mode": "summarize"}'

# Modes: summarize | categorize | privacy_audit | sentiment | custom
```

#### Get Stored Results
```bash
curl http://localhost:3000/api/results/profiles
curl http://localhost:3000/api/results/profiles/1
curl http://localhost:3000/api/results/searches
```

---

## CLI Usage

```bash
# Scrape a profile
node cli.js scrape:profile zuck
node cli.js scrape:profile https://www.facebook.com/zuck
node cli.js scrape:profile zuck --json

# Search people
node cli.js scrape:search "John Smith"
node cli.js scrape:search "John Smith" --location "New York" --pages 3

# Analyze with AI
node cli.js analyze 1 --mode summarize
node cli.js analyze 1 --mode categorize
node cli.js analyze 1 --mode privacy_audit
node cli.js analyze 1 --mode sentiment
node cli.js analyze 1 --mode custom --prompt "What sports does this person like?"

# List analysis modes
node cli.js analyze:modes

# View stored profiles
node cli.js results
node cli.js results --name "John"
node cli.js results --json

# Schedule a recurring scrape (cron format)
node cli.js schedule:add --id job1 --name "Daily Zuck" \
  --urls "https://www.facebook.com/zuck" \
  --cron "0 9 * * *"

node cli.js schedule:list
node cli.js schedule:remove job1

# Start scheduler standalone
npm run scheduler
```

---

## Project Structure

```
facebook-bot/
├── src/
│   ├── browser/
│   │   ├── launcher.js       # Stealth browser launcher
│   │   └── cookies.js        # Cookie session management
│   ├── scrapers/
│   │   ├── profile.js        # Profile scraper
│   │   └── search.js         # People search scraper
│   ├── ai/
│   │   └── analyzer.js       # GPT-4o analysis
│   ├── scheduler/
│   │   └── cron.js           # Scheduled jobs
│   ├── server/
│   │   ├── app.js            # Express server
│   │   └── routes/           # API route handlers
│   ├── utils/
│   │   ├── humanBehavior.js  # Anti-bot evasion helpers
│   │   ├── logger.js         # Winston logger
│   │   └── storage.js        # SQLite database
│   └── config.js             # Config + validation
├── cookies/
│   └── session.json          # (gitignored) Your FB cookies
├── data/
│   └── facebook-bot.db       # SQLite database
├── logs/
│   ├── app.log
│   └── errors.log
├── cli.js                    # CLI interface
├── .env.example
└── package.json
```

---

## Tips for Better Success Rates

1. **Always use session cookies** — Never let the bot automate login
2. **Use a residential proxy** — Datacenter IPs get blocked fast
3. **Run with `HEADLESS=false`** to debug — set in `.env`
4. **Increase delays** — Increase `SCRAPE_DELAY_MIN/MAX` if getting blocked
5. **Rotate sessions** — Export new cookies periodically (sessions expire)

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Login wall / no data | Export and load session cookies |
| Blocked / CAPTCHA | Use a residential proxy (`PROXY_URL`) |
| Browser not found | Run `npx playwright install chromium` |
| OpenAI errors | Check `OPENAI_API_KEY` in `.env` |
| Empty results | Try `HEADLESS=false` to debug visually |
