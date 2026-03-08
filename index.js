const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const fs = require("fs");

/* =============== СЕРВЕР =============== */

const ALLOWED_GUILD_ID = "1046807733501968404";

/* КАНАЛЫ */

const SYSTEM_CHANNEL = "1479571004471640155";
const CHECK_CHANNEL = "1480228317222277171";

/* РОЛИ ПРОВЕРЯЮЩИХ */

const ROLE_LEADER_ID = "1056945517835341936";
const ROLE_HIGH_ID = "1295017864310423583";

/* РОЛИ РАНГОВ */

const MAIN_ROLE_ID = "1480229891789160479";
const MAIN_PLUS_ROLE_ID = "1479574658935423087";

/* ЦЕНЫ */

const RANK_COSTS = {
  "3": 89,
  "4": 178,
};

/* КАРТИНКА */

const IMAGE =
"https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* =============== CLIENT =============== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

/* =============== БАЗА =============== */

let db = { points: {} };

if (fs.existsSync("db.json")) {
  db = JSON.parse(fs.readFileSync("db.json"));
}

function save() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

function addPoints(id, amount) {
  db.points[id] = (db.points[id] || 0) + amount;
  save();
}

function getPoints(id) {
  return db.points[id] || 0;
}

function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

/* =============== READY =============== */

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

/* =============== КОМАНДА МЕНЮ =============== */

client.on("messageCreate", async msg => {

  if (msg.author.bot) return;
  if (!msg.guild || msg.guild.id !== ALLOWED_GUILD_ID) return;

  if (msg.content === "!menu") {

    const embed = new EmbedBuilder()
      .setTitle("💎 Система повышения")
      .setDescription("Зарабатывай баллы и подавай заявку на повышение.")
      .setImage(IMAGE);

    const row = new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("balance_btn")
        .setLabel("Баланс")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("rankup_btn")
        .setLabel("Повышаться")
        .setStyle(ButtonStyle.Success)

    );

    return msg.reply({ embeds: [embed], components: [row] });

  }

});

/* =============== INTERACTIONS =============== */

client.on("interactionCreate", async i => {

  if (!i.guild || i.guild.id !== ALLOWED_GUILD_ID) return;

  try {

    /* БАЛАНС */

    if (i.isButton() && i.customId === "balance_btn") {

      return i.reply({
        content: `💎 Твой баланс: ${getPoints(i.user.id)}`,
        ephemeral: true
      });

    }

    /* МОДАЛКА ПОВЫШЕНИЯ */

    if (i.isButton() && i.customId === "rankup_btn") {

      if (i.channelId !== SYSTEM_CHANNEL) {

        return i.reply({
          content: `❌ Использовать можно только в <#${SYSTEM_CHANNEL}>`,
          ephemeral: true
        });

      }

      const modal = new ModalBuilder()
        .setCustomId("rankup_modal")
        .setTitle("Заявка на повышение");

      const nickInput = new TextInputBuilder()
        .setCustomId("nick")
        .setLabel("Ник в игре")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const proofInput = new TextInputBuilder()
        .setCustomId("proof")
        .setLabel("Скрин / откат")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const rankInput = new TextInputBuilder()
        .setCustomId("rank")
        .setLabel("На какой ранг (3 или 4)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nickInput),
        new ActionRowBuilder().addComponents(proofInput),
        new ActionRowBuilder().addComponents(rankInput)
      );

      return i.showModal(modal);

    }

    /* ОТПРАВКА ЗАЯВКИ */

    if (i.isModalSubmit() && i.customId === "rankup_modal") {

      const nick = i.fields.getTextInputValue("nick");
      const proof = i.fields.getTextInputValue("proof");
      const rank = i.fields.getTextInputValue("rank").trim();

      const cost = RANK_COSTS[rank];

      if (!cost) {

        return i.reply({
          content: "❌ Можно только 3 или 4",
          ephemeral: true
        });

      }

      const userPoints = getPoints(i.user.id);

      if (userPoints < cost) {

        return i.reply({
          content: `❌ Нужно ${cost} 💎`,
          ephemeral: true
        });

      }

      const channel = await i.guild.channels.fetch(CHECK_CHANNEL);

      const embed = new EmbedBuilder()
        .setTitle("📝 Заявка на повышение")
        .addFields(
          { name: "Игрок", value: `${i.user}`, inline: false },
          { name: "Ник", value: nick, inline: false },
          { name: "Ранг", value: rank, inline: true },
          { name: "Баланс", value: `${userPoints} 💎`, inline: true },
          { name: "Цена", value: `${cost} 💎`, inline: true },
          { name: "Доказательство", value: proof, inline: false }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
          .setCustomId(`accept_${i.user.id}_${cost}_${rank}`)
          .setLabel("✅ Принять")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`decline_${i.user.id}`)
          .setLabel("❌ Отклонить")
          .setStyle(ButtonStyle.Danger)

      );

      await channel.send({ embeds: [embed], components: [row] });

      return i.reply({
        content: "✅ Заявка отправлена на проверку",
        ephemeral: true
      });

    }

    /* ПРИНЯТЬ */

    if (i.isButton() && i.customId.startsWith("accept_")) {

      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID)) {

        return i.reply({ content: "❌ Нет прав", ephemeral: true });

      }

      const [, userId, costStr, rank] = i.customId.split("_");

      const member = await i.guild.members.fetch(userId);

      addPoints(userId, -Number(costStr));

      if (rank === "3") {
        await member.roles.add(MAIN_ROLE_ID);
      }

      if (rank === "4") {
        await member.roles.add(MAIN_PLUS_ROLE_ID);
      }

      await member.send(`🎉 Твоя заявка на ${rank} ранг принята!`);

      await i.message.edit({ components: [] });

      return i.reply({
        content: "✅ Повышение выдано",
        ephemeral: true
      });

    }

    /* ОТКЛОНИТЬ */

    if (i.isButton() && i.customId.startsWith("decline_")) {

      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID)) {

        return i.reply({ content: "❌ Нет прав", ephemeral: true });

      }

      const [, userId] = i.customId.split("_");

      const member = await i.guild.members.fetch(userId);

      await member.send("❌ Твоя заявка на повышение отклонена");

      await i.message.edit({ components: [] });

      return i.reply({
        content: "❌ Заявка отклонена",
        ephemeral: true
      });

    }

  } catch (err) {

    console.error(err);

  }

});

/* =============== LOGIN =============== */

client.login(process.env.TOKEN);
