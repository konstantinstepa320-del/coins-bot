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
  StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.TOKEN; // Твой токен из переменных окружения

// ID каналов
const CHANNEL_VERIFY_POINTS = "1469477344161959957"; // канал для заявок на заработок
const CHANNEL_VERIFY_UPGRADE = "1474553271892054168"; // канал для заявок на повышение

// ID ролей
const ROLE_LEADER_ID = "1056945517835341936"; // Leader
const ROLE_HIGH_ID = "1295017864310423583";   // High

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// База баллов
let db = { points: {} };
if (fs.existsSync("db.json")) {
  db = JSON.parse(fs.readFileSync("db.json"));
}

function save() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

function addPoints(userId, amount) {
  db.points[userId] = (db.points[userId] || 0) + amount;
  save();
}

function getPoints(userId) {
  return db.points[userId] || 0;
}

function hasRole(member, roleId) {
  if (!member || !member.roles) return false;
  return member.roles.cache.has(roleId);
}

client.once("ready", () => {
  console.log(`Бот ${client.user.tag} запущен`);
});

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  if (msg.content.startsWith("!give")) {
    if (!hasRole(msg.member, ROLE_LEADER_ID))
      return msg.reply("❌ Только Leader может выдавать баллы");

    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);

    if (!user || isNaN(amount))
      return msg.reply("Используй: !give @user 50");

    addPoints(user.id, amount);
    return msg.reply(`✅ Выдано ${amount} 💎 пользователю ${user.tag}`);
  }

  if (msg.content === "!menu") {
    const embed = new EmbedBuilder()
      .setTitle("💎 Система баллов")
      .setDescription("Выберите действие");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("earn_btn")
        .setLabel("Заработать")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("balance_btn")
        .setLabel("Баланс")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("upgrade_btn")
        .setLabel("Повышение")
        .setStyle(ButtonStyle.Success)
    );

    await msg.reply({ embeds: [embed], components: [row] });
  }
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton() && interaction.customId === "earn_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("earn_select")
        .setPlaceholder("Выберите активность")
        .addOptions([
          { label: "Тайник +2", value: "2" },
          { label: "Капт +2", value: "2" },
          { label: "Заправка транспорта +2", value: "2" },
          { label: "Развозка грина +2", value: "2" },
          { label: "1 место на арене +2", value: "2" },
          { label: "Снять варн (-79)", value: "-79" }
        ]);
      await interaction.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "earn_select") {
      const reward = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`earn_modal_${reward}`)
        .setTitle("Подтверждение заявки на заработок");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("proof")
            .setLabel("Ссылка на видео спешик/тяга")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("earn_modal_")) {
      await interaction.deferReply({ ephemeral: true });
      const reward = Number(interaction.customId.split("_")[2]);
      const proof = interaction.fields.getTextInputValue("proof");
      const ch = await client.channels.fetch(CHANNEL_VERIFY_POINTS).catch(() => null);
      if (!ch) return interaction.editReply("❌ Канал для заявок на заработок не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на баллы")
        .setDescription(`Игрок: ${interaction.user}\nБаллы: ${reward}\n[Видео](${proof})`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`earn_accept_${interaction.user.id}_${reward}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`earn_reject_${interaction.user.id}`)
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });
      await interaction.editReply("✅ Заявка отправлена на проверку");
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("earn_accept_")) {
      if (!hasRole(interaction.member, ROLE_HIGH_ID))
        return interaction.reply({ content: "❌ Нет прав", ephemeral: true });

      const [, userId, reward] = interaction.customId.split("_");
      addPoints(userId, Number(reward));

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`🎉 Ваша заявка на заработок одобрена! Вам начислено ${reward} 💎.`);
        } catch {}
      }

      await interaction.update({ content: "✅ Начислено", components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("earn_reject_")) {
      if (!hasRole(interaction.member, ROLE_HIGH_ID))
        return interaction.reply({ content: "❌ Нет прав", ephemeral: true });

      const userId = interaction.customId.split("_")[2];
      const modal = new ModalBuilder()
        .setCustomId(`earn_reject_modal_${userId}`)
        .setTitle("Причина отклонения заявки");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Причина отказа")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("earn_reject_modal_")) {
      const userId = interaction.customId.split("_")[3];
      const reason = interaction.fields.getTextInputValue("reason");

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`❌ Ваша заявка на заработок отклонена. Причина: ${reason}`);
        } catch {}
      }

      await interaction.update({ content: "❌ Заявка отклонена", components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId === "balance_btn") {
      await interaction.reply({ content: `💎 Ваш баланс: ${getPoints(interaction.user.id)}`, ephemeral: true });
      return;
    }

    if (interaction.isButton() && interaction.customId === "upgrade_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("upgrade_select")
        .setPlaceholder("Выберите повышение")
        .addOptions([
          { label: "2→3 (-110)", value: "-110" },
          { label: "2→4 (-220)", value: "-220" }
        ]);
      await interaction.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "upgrade_select") {
      const price = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`upgrade_${price}`)
        .setTitle("Заявка на повышение");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("nick")
            .setLabel("Ник + статик")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("video_link")
            .setLabel("Ссылка на видео спешик/тяга")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("upgrade_")) {
      await interaction.deferReply({ ephemeral: true });

      const price = Number(interaction.customId.split("_")[1]);
      const nick = interaction.fields.getTextInputValue("nick");
      const videoLink = interaction.fields.getTextInputValue("video_link");

      const ch = await client.channels.fetch(CHANNEL_VERIFY_UPGRADE).catch(() => null);
      if (!ch) return interaction.editReply("❌ Канал для заявок на повышение не найден");

      const embed = new EmbedBuilder()
        .setTitle("📈 Заявка на повышение")
        .setDescription(`Игрок: ${interaction.user}\nНик + статик: ${nick}\nЦена: ${price} баллов\n[Видео](${videoLink})`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`upgrade_accept_${interaction.user.id}_${price}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`upgrade_reject_${interaction.user.id}`)
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });
      await interaction.editReply("✅ Заявка отправлена на проверку");
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("upgrade_accept_")) {
      if (!hasRole(interaction.member, ROLE_HIGH_ID))
        return interaction.reply({ content: "❌ Нет прав", ephemeral: true });

      const [, userId, price] = interaction.customId.split("_");
      addPoints(userId, -Math.abs(Number(price)));

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`🎉 Ваша заявка на повышение одобрена. С баланса снято ${Math.abs(price)} 💎`);
        } catch {}
      }

      await interaction.update({ content: "✅ Заявка на повышение принята", components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("upgrade_reject_")) {
      if (!hasRole(interaction.member, ROLE_HIGH_ID))
        return interaction.reply({ content: "❌ Нет прав", ephemeral: true });

      const userId = interaction.customId.split("_")[2];
      const modal = new ModalBuilder()
        .setCustomId(`upgrade_reject_modal_${userId}`)
        .setTitle("Причина отклонения заявки");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Причина отказа")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("upgrade_reject_modal_")) {
      const userId = interaction.customId.split("_")[3];
      const reason = interaction.fields.getTextInputValue("reason");

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`❌ Ваша заявка на повышение отклонена. Причина: ${reason}`);
        } catch {}
      }

      await interaction.update({ content: "❌ Заявка на повышение отклонена", components: [] });
      return;
    }

  } catch (err) {
    console.error(err);
  }
});

client.login(TOKEN);