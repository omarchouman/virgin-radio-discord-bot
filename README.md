# Virgin Radio Lebanon — Discord Bot

A Discord bot (Node.js / [discord.js](https://discord.js.org)) that streams
**Virgin Radio Lebanon** into a voice channel.

## Commands

| Command | What it does |
| ------- | ------------ |
| `!play` | Joins the voice channel you're in and starts streaming the radio. |
| `!stop` | Stops the stream and leaves the voice channel. |

## How it works

- **discord.js v14** + **@discordjs/voice** handle the bot and the voice connection.
- **ffmpeg-static** bundles an FFmpeg binary with the install, so you don't need
  FFmpeg installed on the host.
- **opusscript** and **libsodium-wrappers** are pure-JavaScript, so there's no
  native compilation step (helps on restricted/shared hosting).
- A tiny HTTP server runs alongside the bot so platforms that expect a web
  process (like Hostinger shared hosting) keep it alive.

## Setup

1. **Requirements:** Node.js 18 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (copy from the template):
   ```bash
   cp .env.example .env
   ```
   Then fill in:
   ```
   DISCORD_TOKEN=your-bot-token
   VIRGIN_RADIO_URL=https://your-stream-url
   ```
4. In the [Discord Developer Portal](https://discord.com/developers/applications),
   open your application → **Bot** and enable the **Message Content Intent**
   (required for the `!` prefix commands).
5. Run it:
   ```bash
   npm start
   ```

## Deploying to Hostinger

### ⚠️ Important: shared hosting limitations

Hostinger **shared hosting** (the cPanel "Setup Node.js App" / Passenger setup)
is designed for web apps that respond to HTTP requests — **not** for a
long-running Discord voice bot. You may hit these issues:

- The app process can be **idled/killed** when there's no web traffic.
- **Outbound UDP** (needed for the Discord voice connection) may be blocked.
- FFmpeg runs as a bundled binary, but the host may restrict spawning processes.

If voice streaming doesn't work on shared hosting, the most reliable option is a
**Hostinger VPS** (see below), which behaves like a normal Linux server.

### Shared hosting (cPanel "Setup Node.js App")

1. Upload the project files (everything except `node_modules` and `.env`).
2. In cPanel → **Setup Node.js App**:
   - Set the **Application startup file** to `index.js`.
   - Set the Node.js version to 18+.
3. Add your environment variables (`DISCORD_TOKEN`, `VIRGIN_RADIO_URL`) in the
   app's **Environment variables** section, or upload a `.env` file.
4. Click **Run NPM Install**, then **Start/Restart** the app.
5. The keep-alive HTTP endpoint helps Passenger consider the app "alive."

### Hostinger VPS (recommended for reliability)

1. SSH into the VPS and install Node.js 18+.
2. Clone the repo and `cd` into it.
3. `npm install`
4. Create the `.env` file with your token and stream URL.
5. Keep it running 24/7 with [PM2](https://pm2.keymetrics.io/):
   ```bash
   npm install -g pm2
   pm2 start index.js --name virgin-radio-bot
   pm2 save
   pm2 startup   # follow the printed instructions to auto-start on reboot
   ```

## Configuration

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `DISCORD_TOKEN` | yes | Your Discord bot token. |
| `VIRGIN_RADIO_URL` | yes | The Virgin Radio Lebanon stream URL. |
| `PORT` | no | Port for the keep-alive HTTP server (defaults to `3000`). |
