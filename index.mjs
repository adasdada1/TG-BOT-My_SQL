import { Bot, GrammyError, HttpError,session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import { config } from "dotenv";
config();
const bot = new Bot(process.env.BOT_API_KEY);

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "testmysql_db",
  password: "",
}); //настоящие данные - в dotenv

bot.use(
  session({
    initial: () => ({}),
  })
);
bot.use(conversations());
bot.command("start", (ctx) => ctx.reply("Тест"));


async function createNewUser(conversation, ctx) {
  await ctx.reply("Введите логин");
  let login = await conversation.wait();
  const userRegexp = /^[a-zA-Z0-9]{5,15}$/;
  while (!userRegexp.test(login.msg.text)) {
    await ctx.reply(
      "Длина логина должна быть от 5 до 15 символов. Введите логин заново"
    );
    login = await conversation.wait();
  }

  await ctx.reply("Введите пароль");
  let pass = await conversation.wait();
  const passRegexp = /(?=^.{8,15}$)/;
  while (!passRegexp.test(pass.msg.text)) {
    await ctx.reply(
      "Длина пароля должна быть от 8 до 15 символов. Введите пароль заново"
    );
    pass = await conversation.wait();
  }
  bcrypt.hash(pass.msg.text, 10).then(function (hash) {
    connection.query(
      "INSERT INTO Users(login,password) VALUES (?, ?)",
      [login.msg.text, hash],
      (err) => {
        if (err) {
          return console.error(err);
        }
        console.log("Данные отправлены");
        ctx.reply("Данные успешно отправлены");
      }
    );
  });
}

bot.use(createConversation(createNewUser));
bot.command("create", async (ctx) => {
  await ctx.conversation.enter("createNewUser");
});

async function checkInfo(conversation, ctx) {
  await ctx.reply("Введи логин");
  const login = await conversation.wait();
  await ctx.reply("Введи пароль");
  const pass = await conversation.wait();
  connection.query(
    "SELECT * FROM Users WHERE login = ?",
    [login.msg.text],
    function (err, rows) {
      if (err) {
        return console.error(err);
      }
      if (rows[0]) {
        bcrypt.compare(pass.msg.text, rows[0].Password).then(function (result) {
          if (result) return ctx.reply("Данные верны");
          ctx.reply("Логин или пароль, введеный вами, неверен.");
        });
      } else{
        ctx.reply("Пользователь не найден.")
      }
    }
  );
}

bot.use(createConversation(checkInfo));
bot.command("check", async (ctx) => {
  await ctx.conversation.enter("checkInfo");
});

bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.api.setMyCommands([
  { command: "start", description: "Начать" },
  { command: "create", description: "Добавить пользователя в бд" },
  { command: "check", description: "Авторизация" },
]);

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;

  if (e instanceof GrammyError) {
    console.error("Ошибка при запросе:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Не могу связаться с Телеграм:", e);
  } else {
    console.error("Неизвестная ошибка:", e);
  }
});
bot.start();
