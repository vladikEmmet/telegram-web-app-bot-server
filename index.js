require("dotenv").config();
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cors = require("cors");
const User = require("./models/User");
const Password = require("./models/Password");
const { encode, decode } = require("./helpers/crypto");
const { getPasswords } = require("./api/methods");

const token = process.env.TOKEN;
const PORT = process.env.PORT || 7000;
const webApp = process.env.WEB_APP;

const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.WEB_APP,
  })
);

app.listen(PORT, () => {
  mongoose
    .connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("DB OK"))
    .catch((err) => console.log("DB err", err));
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    if (text.startsWith("/")) return;

    const resourceName = text.toLowerCase();

    const pass = await Password.findOne({
      userTgId: msg.from?.id,
      name: resourceName,
    });
    if (!pass) {
      // await bot.sendSticker(chatId, "./stickers/");
      await bot.sendMessage(
        chatId,
        "You don`t have password in this resource. Let`s check your store",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Go to my store", web_app: { url: webApp } }],
            ],
          },
        }
      );
    } else {
      const decoded = decode(pass.password);
      await bot.sendMessage(chatId, "Your password:");
      await bot.sendMessage(chatId, decoded);
    }
  } catch (err) {
    await bot.sendMessage(chatId, "Sorry, I`m very busy now. Try again later");
  }
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const user = await User.findOne({ tgId: msg.from?.id });

  try {
    if (!user) {
      await User.create({ name: msg.from.username, tgId: msg.from.id });
      await bot.sendSticker(chatId, "./stickers/backtothework_056.webp");
      await bot.sendMessage(
        chatId,
        "Hi! Now I am your memory. Would you like to add a new password? Enter /passwords or click on button to visit your store",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Go to my store", web_app: { url: webApp } }],
            ],
          },
        }
      );
    } else {
      await bot.sendSticker(
        chatId,
        "./stickers/chpic.su_-_memesetoktowho_070.webp"
      );
      await bot.sendMessage(
        chatId,
        "I remember not only passwords, but also people. Long time no see! Remember old passwords or create a new one?",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Go to my store",
                  web_app: { url: process.env.WEB_APP },
                },
              ],
            ],
          },
        }
      );
    }
  } catch (err) {
    await bot.sendMessage(chatId, "Sorry, I`m very busy now. Try again later");
  }
});

bot.onText(/\/store/, async (msg, match) => {
  const chatId = msg.chat.id;

  try {
    await bot.sendMessage(
      chatId,
      "It's time to remember your passwords! Click the button below to go to your store.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Go to my store",
                web_app: { url: process.env.WEB_APP },
              },
            ],
          ],
        },
      }
    );
  } catch (err) {
    await bot.sendMessage(
      chatId,
      "Sorry, I'm a little confused. Try again later. "
    );
  }
});

bot.onText(/\/remove(\s)?(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;

  try {
    if (!match[2]) {
      await bot.sendMessage(
        chatId,
        "You should specify the name of resource in this format: /remove <resource name>"
      );
      return;
    }

    const data = match[2];
    const removedPass = await Password.deleteOne({
      userTgId: msg.from?.id,
      name: data.toLowerCase(),
    });
    if (removedPass.deletedCount !== 1) {
      await bot.sendMessage(
        chatId,
        "Oops! It seems that you do not have such a password."
      );
      return;
    }
    await bot.sendMessage(chatId, "Password has been removed!", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Go to my store",
              web_app: { url: process.env.WEB_APP },
            },
          ],
        ],
      },
    });
  } catch (err) {
    await bot.sendMessage(
      chatId,
      "I can`t handle this message. Please make sure the format is correct and try again. Error: " +
        err.message
    );
  }
});

bot.onText(/\/passwords(\s)?(.+-.+)*/, async (msg, match) => {
  const chatId = msg.chat.id;

  try {
    if (!match[2]) {
      await bot.sendMessage(
        chatId,
        "You should specify the password in this format: /passwords <resource name>-<password>"
      );
      return;
    }
    const data = match[2].split("-");
    const encodedPass = encode(data[1]);
    await Password.create({
      name: data[0].toLowerCase(),
      password: encodedPass,
      userTgId: msg.from.id,
    });
    await bot.sendMessage(
      chatId,
      "Password created! You can just text me resouce name and I`ll answer you with a password"
    );
  } catch (err) {
    await bot.sendMessage(
      chatId,
      "I can`t handle this message. Please make sure the format is correct and try again. Error: " +
        err.message
    );
  }
});

app.post("/web-data", async (req, res) => {
  const { queryId, changes, total } = req.body;
  try {
    for (const change of changes) {
      if (change.id) {
        const pass = await Password.findOne({ _id: change.id });
        pass.name = change.name;
        const encrypted = encode(change.password);
        pass.password = encrypted;
        await pass.save();
      }
    }

    await bot.answerWebAppQuery(queryId, {
      type: "article",
      id: queryId,
      title: "Data saved",
      input_message_content: {
        message_text: `OK, I saved ${total} changes. You can just text me the name of resource and I'll answer you with password!`,
      },
    });

    return res.status(200).json({});
  } catch (err) {
    await bot.answerWebAppQuery(queryId, {
      type: "article",
      id: queryId,
      title: "Failed to load data",
      input_message_content: { message_text: "Failed to load data" },
    });
    return res.status(500).json({ message: err.message });
  }
});

app.get("/web-data/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const passwords = await getPasswords(id);
    console.log(passwords);
    return res.json(passwords);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});
