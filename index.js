require("dotenv").config();

const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Events,
} = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require("@discordjs/voice");
const { FFmpeg } = require("prism-media");
const ffmpegPath = require("ffmpeg-static");

// Point prism-media at the FFmpeg binary bundled by ffmpeg-static so we don't
// depend on FFmpeg being installed on the host (important for shared hosting).
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

const TOKEN = process.env.DISCORD_TOKEN;
const VIRGIN_RADIO_URL = process.env.VIRGIN_RADIO_URL;
const PREFIX = "!";

if (!TOKEN || !VIRGIN_RADIO_URL) {
  console.error(
    "Missing config. Make sure DISCORD_TOKEN and VIRGIN_RADIO_URL are set in your .env file."
  );
  process.exit(1);
}

// Bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Build an FFmpeg-backed audio resource for the radio stream. The reconnect
// flags mirror the original Python bot so the stream recovers from drops.
function createRadioResource() {
  const transcoder = new FFmpeg({
    args: [
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_delay_max", "5",
      "-i", VIRGIN_RADIO_URL,
      "-analyzeduration", "0",
      "-loglevel", "error",
      "-vn",
      "-f", "s16le",
      "-ar", "48000",
      "-ac", "2",
    ],
  });
  // Surface FFmpeg failures (bad URL, can't spawn binary, etc.) in the logs.
  transcoder.process?.stderr?.on("data", (chunk) => {
    console.error("[ffmpeg]", chunk.toString().trim());
  });
  transcoder.on("error", (err) => {
    console.error("[ffmpeg] transcoder error:", err.message);
  });
  return createAudioResource(transcoder, { inputType: StreamType.Raw });
}

async function handlePlay(message) {
  const voiceChannel = message.member?.voice?.channel;

  if (!voiceChannel) {
    await message.channel.send("You need to join a voice channel first!");
    return;
  }

  if (getVoiceConnection(message.guild.id)) {
    await message.channel.send("I'm already connected to a voice channel!");
    return;
  }

  try {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    console.log("[voice] connection Ready (signaling OK)");

    const player = createAudioPlayer();
    player.on("error", (error) => {
      console.error("Audio player error:", error.message);
    });
    // Diagnostic: Idle->Buffering->Playing means FFmpeg is producing audio.
    // Reaching "playing" but with no sound points at UDP being blocked.
    player.on(AudioPlayerStatus.Buffering, () =>
      console.log("[player] buffering (FFmpeg starting)")
    );
    player.on(AudioPlayerStatus.Playing, () =>
      console.log("[player] PLAYING (audio is being sent)")
    );
    player.on(AudioPlayerStatus.Idle, () =>
      console.log("[player] idle (no audio / stream ended)")
    );

    player.play(createRadioResource());
    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      connection.destroy();
    });

    await message.channel.send(
      `Playing Virgin Radio Lebanon in ${voiceChannel.name}`
    );
  } catch (error) {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) connection.destroy();
    await message.channel.send(`An error occurred: ${error.message}`);
  }
}

async function handleStop(message) {
  const connection = getVoiceConnection(message.guild.id);

  if (connection) {
    connection.destroy();
    await message.channel.send("Stopped the stream and left the voice channel.");
  } else {
    await message.channel.send("I'm not connected to a voice channel.");
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const command = message.content.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();

  try {
    if (command === "play") {
      await handlePlay(message);
    } else if (command === "stop") {
      await handleStop(message);
    }
  } catch (error) {
    console.error("Command error:", error);
    try {
      await message.channel.send("Something went wrong. Please try again!");
    } catch (_) {
      // Ignore failures to send the error message.
    }
  }
});

// Minimal HTTP server so platforms that expect a web process (e.g. Hostinger
// shared hosting / Passenger) see a live app and keep the process running.
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Virgin Radio bot is running.\n");
  })
  .listen(PORT, () => {
    console.log(`Keep-alive HTTP server listening on port ${PORT}`);
  });

client.login(TOKEN);
