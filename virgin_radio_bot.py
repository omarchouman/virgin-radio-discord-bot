import discord
import os
from dotenv import load_dotenv
from discord import FFmpegPCMAudio
from discord.ext import commands

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
VIRGIN_RADIO_URL = os.getenv("VIRGIN_RADIO_URL")

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


@bot.command()
async def play(ctx):
    if ctx.author.voice:  # Check if the user is in a voice channel
        channel = ctx.author.voice.channel
        voice_client = ctx.voice_client

        # If already connected to a channel
        if voice_client and voice_client.is_connected():
            await ctx.send("I'm already connected to a voice channel!")
            return

        try:
            voice_client = await channel.connect()
            ffmpeg_options = {
                'options': '-vn -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
            }
            voice_client.play(FFmpegPCMAudio(VIRGIN_RADIO_URL, **ffmpeg_options))
            await ctx.send(f"Playing Virgin Radio Lebanon in {channel.name}")
        except Exception as e:
            await ctx.send(f"An error occurred: {str(e)}")
    else:
        await ctx.send("You need to join a voice channel first!")


@bot.command()
async def stop(ctx):
    if ctx.voice_client:  # Check if the bot is in a voice channel
        await ctx.voice_client.disconnect()
        await ctx.send("Stopped the stream and left the voice channel.")
    else:
        await ctx.send("I'm not connected to a voice channel.")


@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandInvokeError):
        await ctx.send("Something went wrong. Please try again!")
    else:
        await ctx.send(str(error))


bot.run(TOKEN)
