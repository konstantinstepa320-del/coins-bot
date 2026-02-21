const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require("discord.js");
const fs = require("fs");

/* ================= НАСТРОЙКИ ================= */

const TOKEN = process.env.TOKEN;

const CHANNEL_EARN = "1469477344161959957"; // канал для заявок на заработок
const CHANNEL_UPGRADE = "1474553271892054168"; // канал для заявок на повышение
const ROLE_HIGH_ID = "1295017864310423583"; // High
const ROLE_LEADER_ID = "1056945517835341936"; // Leader

const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ================= CLIENT ================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

/* ================= БАЗА ================= */

let db = { points: {} };
if (fs.existsSync("db.json")) db = JSON.parse(fs.readFileSync("db.json"));

function save() { fs.writeFileSync("db.json", JSON.stringify(db, null, 2)); }
function addPoints(id, n) { db.points[id] = (db.points[id] || 0) + n; save(); }
function getPoints(id) { return db.points[id] || 0; }
function hasRole(member, roleId) { return member.roles.cache.has(roleId); }

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

/* ================= КОМАНДЫ ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  // меню
  if (msg.content === "!menu") {
    const embed = new EmbedBuilder().setTitle("💎 Система баллов").setImage(IMAGE);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("earn_btn").setLabel("Заработать").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("balance_btn").setLabel("Баланс").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("upgrade_btn").setLabel("Повышение").setStyle(ButtonStyle.Success)
    );
    await msg.reply({ embeds: [embed], components: [row] });
  }

  // выдача баллов лидером
  if (msg.content.startsWith("!give")) {
    if (!hasRole(msg.member, ROLE_LEADER_ID)) return msg.reply("❌ Только Leader может выдавать баллы");
    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);
    if (!user || isNaN(amount)) return msg.reply("Используй: !give @user 50");
    addPoints(user.id, amount);
    return msg.reply(`✅ Выдано ${amount} 💎`);
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {
  try {
    /* ===== ЗАРАБОТОК ===== */
    if (i.isButton() && i.customId === "earn_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("earn_select")
        .setPlaceholder("Выберите активность")
        .addOptions([
          { label: "Тайник +2", value: "2" },
          { label: "Капт +2", value: "2" },
          { label: "Заправка транспорта +2", value: "2" },
          { label: "Развозка грина +2", value: "2" },
          { label: "1 место на арене +2", value: "2" }
        ]);
      return i.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === "earn_select") {
      const reward = Number(i.values[0]);
      const modal = new ModalBuilder().setCustomId(`earn_modal_${reward}`).setTitle("Подтверждение заявки");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("proof").setLabel("Ссылка на видео спешик/тяга").setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("earn_modal_")) {
      await i.deferReply({ ephemeral: true });
      const reward = Number(i.customId.split("_")[2]);
      const proof = i.fields.getTextInputValue("proof");
      const ch = await client.channels.fetch(CHANNEL_EARN).catch(() => null);
      if (!ch) return i.editReply("❌ Канал для заявок на заработок не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на баллы")
        .setDescription(`Игрок: ${i.user}\nБаллы: ${reward}\n[Видео](${proof})`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`earn_accept_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`earn_reject_${i.user.id}`).setLabel("Отклонить").setStyle(ButtonStyle.Danger)
      );
      await ch.send({ embeds: [embed], components: [row] });
      return i.editReply("✅ Заявка отправлена на проверку");
    }

    if (i.isButton() && i.customId.startsWith("earn_accept_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав", ephemeral: true });
      const [, userId, reward] = i.customId.split("_");
      addPoints(userId, Number(reward));

      // добавить роль High при начислении
      const guild = i.guild;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) await member.roles.add(ROLE_HIGH_ID).catch(() => null);
      // ЛС уведомление
      if (member) await member.send(`✅ Вам начислено ${reward} баллов`).catch(() => null);

      return i.update({ content: "✅ Начислено и роль выдана", components: [] });
    }

    if (i.isButton() && i.customId.startsWith("earn_reject_")) {
      const [, userId] = i.customId.split("_");
      const modal = new ModalBuilder().setCustomId(`reject_modal_${userId}`).setTitle("Причина отклонения");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("reason").setLabel("Причина").setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("reject_modal_")) {
      const userId = i.customId.split("_")[2];
      const reason = i.fields.getTextInputValue("reason");
      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) await member.send(`❌ Ваша заявка отклонена. Причина: ${reason}`).catch(() => null);
      return i.reply({ content: "✅ Пользователь уведомлен", ephemeral: true });
    }

    /* ===== БАЛАНС ===== */
    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({ content: `💎 Баланс: ${getPoints(i.user.id)}`, ephemeral: true });
    }

    /* ===== ПОВЫШЕНИЕ ===== */
    if (i.isButton() && i.customId === "upgrade_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("upgrade_select")
        .setPlaceholder("Выберите повышение")
        .addOptions([
          { label: "2→3 (-110)", value: "-110" },
          { label: "2→4 (-220)", value: "-220" }
        ]);
      return i.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === "upgrade_select") {
      const price = Number(i.values[0]);
      const modal = new ModalBuilder().setCustomId(`upgrade_modal_${price}`).setTitle("Заявка на повышение");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("nick").setLabel("Ник + статик").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("proof").setLabel("Ссылка на видео спешик/тяга").setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("upgrade_modal_")) {
      const price = Number(i.customId.split("_")[2]);
      const nick = i.fields.getTextInputValue("nick");
      const proof = i.fields.getTextInputValue("proof");
      const ch = await client.channels.fetch(CHANNEL_UPGRADE).catch(() => null);
      if (!ch) return i.editReply("❌ Канал для заявок на повышение не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на повышение")
        .setDescription(`Игрок: ${nick}\nЦена: ${price}\n[Видео](${proof})`);
      await ch.send({ embeds: [embed] });
      return i.editReply("✅ Заявка на повышение отправлена на проверку");
    }

  } catch (err) {
    console.error("Ошибка:", err);
  }
});

/* ================= LOGIN ================= */

client.login(TOKEN);