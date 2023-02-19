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

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const user = await User.findOne({ tgId: msg.from.id });

  try {
    if (!user) {
      await User.create({ name: msg.from.username, tgId: msg.from.id });
      await bot.sendSticker(chatId, "./stickers/backtothework_056.webp");
      await bot.sendMessage(
        chatId,
        "Hi! Now I am your memory. Would you like to add a new password? Enter /passwords or click on button",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Add new password", web_app: { url: webApp } }],
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
    console.log(err.message);
  }
});

bot.onText(/\/passwords(\s)?(.+-.+)*/, async (msg, match) => {
  const chatId = msg.chat.id;

  console.log("match2: " + match[2]);

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
      name: data[0],
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
    // await bot.answerWebAppQuery(queryId, {
    //   type: "article",
    //   id: queryId,
    //   title: "Loading data",
    //   input_message_content: { message_text: "Loading data..." },
    // });

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
