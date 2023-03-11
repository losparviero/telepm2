import dotenv from "dotenv";
dotenv.config();
import { Bot, webhookCallback, HttpError, GrammyError } from "grammy";
import pm2 from "pm2";

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

// PM2

pm2.connect((error) => {
  if (error) {
    console.error(`PM2 connect error: ${error}`);
    process.exit(1);
  }
});

// Admin

const authorizedUsers = process.env.BOT_DEVELOPER?.split(",").map(Number) || [];
bot.use(async (ctx, next) => {
  ctx.config = {
    botDevelopers: authorizedUsers,
    isDeveloper: authorizedUsers.includes(ctx.chat?.id),
  };
  await next();
});

// Response

async function responseTime(ctx, next) {
  const before = Date.now();
  await next();
  const after = Date.now();
  console.log(`Response time: ${after - before} ms`);
}

bot.use(responseTime);

// Commands

bot.command("start", async (ctx) => {
  if (!ctx.chat.type == "private") {
    await bot.api.sendMessage(
      ctx.chat.id,
      "*Channels and groups are not supported presently.*",
      { parse_mode: "Markdown" }
    );
    return;
  }
  await ctx
    .reply("*Welcome!* ✨\n_This is a process management bot for @anzubo._", {
      parse_mode: "Markdown",
    })
    .then(console.log("New user added:\n", ctx.from));
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This is a utility bot to manage processes.\nUnauthorized use is not permitted.\nDeploy your own from_ [here](https://github.com/Grahtni/telegpt/).",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.chat.id));
});

// Manage

bot.command("list", async (ctx) => {
  if (!ctx.config.isDeveloper) {
    await ctx.reply(
      "*You're not authorized to use this bot.*\n_Please request access by contacting the admin(s)._",
      { parse_mode: "Markdown" }
    );
    return;
  }
  pm2.list(async (error, processes) => {
    if (error) {
      console.error(`PM2 list error: ${error}`);
      await ctx.reply("*Error listing PM2 processes.*", {
        parse_mode: "Markdown",
      });
      return;
    }
    const processList = processes
      .map((p) => `${p.name} - ${p.pm2_env.status}`)
      .join("\n");
    await ctx.reply(`*PM2 Processes:*\n\n_${processList}_`, {
      parse_mode: "Markdown",
    });
  });
});

bot.command("restart", async (ctx) => {
  if (!ctx.config.isDeveloper) {
    await ctx.reply(
      "*You're not authorized to use this bot.*\n_Please request access by contacting the admin(s)._",
      { parse_mode: "Markdown" }
    );
    return;
  }
  const processId = ctx.message.text.split(" ")[1];
  if (!processId) {
    await ctx.reply("*Please provide a process ID to restart.*", {
      parse_mode: "Markdown",
    });
    return;
  }
  pm2.restart(processId, async (error, _) => {
    if (error) {
      console.error(`PM2 restart error: ${error}`);
      await ctx.reply(`*Error restarting process ${processId}.*`, {
        parse_mode: "Markdown",
      });
      return;
    }
    await ctx.reply(`*Restarting process ${processId}*`, {
      parse_mode: "Markdown",
    });
  });
});

// Messages

bot.on("message", async (ctx) => {
  if (!ctx.config.isDeveloper) {
    await ctx.reply(
      "*You're not authorized to use this bot.*\n_Please request access by contacting the admin(s)._",
      { parse_mode: "Markdown" }
    );
    return;
  }
  await ctx.reply(
    "*Here are the commands available:*\n\n_/start Start the bot\n/help Know more\n/list List processes\n/restart Restart [process id]_",
    { parse_mode: "Markdown" }
  );
});

// Error

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    "Error while handling update",
    ctx.update.update_id,
    "\nQuery:",
    ctx.msg.text
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
    if (e.description === "Forbidden: bot was blocked by the user") {
      console.log("Bot was blocked by the user");
    } else {
      ctx.reply("An error occurred");
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Run

bot.start();
