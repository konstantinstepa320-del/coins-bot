const CHANNEL_VERIFY_POINTS = "1469477344161959957";  // канал для заработка
const CHANNEL_VERIFY_UPGRADE = "1474553271892054168"; // канал для повышения

const ROLE_LEADER_ID = "1056945517835341936"; // Leader
const ROLE_HIGH_ID = "1295017864310423583";   // High (разрешена проверка заявок)

// ...

client.on("interactionCreate", async i => {
  try {

    // ЗАРАБОТОК
    if (i.isButton() && i.customId === "earn_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("earn_select")
        .setPlaceholder("Выбери активность")
        .addOptions([
          { label: "Тайник +2", value: "2" },
          { label: "Капт +2", value: "2" },
          { label: "Заправка транспорта +2", value: "2" },
          { label: "Развозка грина +2", value: "2" },
          { label: "1 место на арене +2", value: "2" },
          { label: "Снять варн (-79)", value: "-79" }
        ]);
      return i.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === "earn_select") {
      const reward = i.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`earn_modal_${reward}`)
        .setTitle("Подтверждение");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("proof")
            .setLabel("Ссылка на видео спешик/тяга")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("earn_modal_")) {
      await i.deferReply({ ephemeral: true });

      const reward = Number(i.customId.split("_")[2]);
      const proof = i.fields.getTextInputValue("proof");

      // Отправляем заявку именно в канал заработка
      const ch = await client.channels.fetch(CHANNEL_VERIFY_POINTS).catch(() => null);
      if (!ch) return i.editReply("❌ Канал для заявок на заработок не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на баллы")
        .setDescription(`Игрок: ${i.user}\nБаллы: ${reward}\n[Видео](${proof})`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`earn_accept_${i.user.id}_${reward}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`earn_reject_${i.user.id}`)
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });
      return i.editReply("✅ Отправлено на проверку");
    }

    // Принятие заявки на заработок
    if (i.isButton() && i.customId.startsWith("earn_accept_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const [, userId, reward] = i.customId.split("_");
      addPoints(userId, Number(reward));

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.roles.add(ROLE_HIGH_ID); // Можно заменить на роль за баллы, если нужно
          await member.send(`🎉 Ваша заявка на заработок одобрена! Вам начислено ${reward} 💎.`);
        } catch {}
      }

      return i.update({ content: "✅ Начислено", components: [] });
    }

    // Отклонение заявки на заработок с вводом причины
    if (i.isButton() && i.customId.startsWith("earn_reject_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const userId = i.customId.split("_")[2];
      const modal = new ModalBuilder()
        .setCustomId(`earn_reject_modal_${userId}`)
        .setTitle("Причина отклонения");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Причина отказа")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("earn_reject_modal_")) {
      const userId = i.customId.split("_")[3];
      const reason = i.fields.getTextInputValue("reason");

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`❌ Ваша заявка на заработок отклонена. Причина: ${reason}`);
        } catch {}
      }
      return i.update({ content: "❌ Заявка отклонена", components: [] });
    }

    // ПОВЫШЕНИЕ (отправка в отдельный канал)
    if (i.isButton() && i.customId === "upgrade_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("upgrade_select")
        .addOptions([
          { label: "2→3 (-110)", value: "-110" },
          { label: "2→4 (-220)", value: "-220" }
        ]);
      return i.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === "upgrade_select") {
      const price = i.values[0];

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
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("upgrade_")) {
      await i.deferReply({ ephemeral: true });
      const price = Number(i.customId.split("_")[1]);
      const nick = i.fields.getTextInputValue("nick");
      const videoLink = i.fields.getTextInputValue("video_link");

      // Отправляем заявку в канал повышения
      const ch = await client.channels.fetch(CHANNEL_VERIFY_UPGRADE).catch(() => null);
      if (!ch) return i.editReply("❌ Канал для заявок на повышение не найден");

      const embed = new EmbedBuilder()
        .setTitle("📈 Заявка на повышение")
        .setDescription(`Игрок: ${i.user}\nНик + статик: ${nick}\nЦена: ${price} баллов\n[Видео](${videoLink})`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`upgrade_accept_${i.user.id}_${price}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`upgrade_reject_${i.user.id}`)
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });
      return i.editReply("✅ Заявка отправлена на проверку");
    }

    // Принятие заявки на повышение
    if (i.isButton() && i.customId.startsWith("upgrade_accept_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const [, userId, price] = i.customId.split("_");
      addPoints(userId, -Math.abs(Number(price))); // снимаем баллы

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`🎉 Ваша заявка на повышение одобрена. С баланса снято ${Math.abs(price)} 💎`);
        } catch {}
      }

      return i.update({ content: "✅ Заявка на повышение принята", components: [] });
    }

    // Отклонение заявки на повышение
    if (i.isButton() && i.customId.startsWith("upgrade_reject_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const userId = i.customId.split("_")[2];
      const modal = new ModalBuilder()
        .setCustomId(`upgrade_reject_modal_${userId}`)
        .setTitle("Причина отклонения");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Причина отказа")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("upgrade_reject_modal_")) {
      const userId = i.customId.split("_")[3];
      const reason = i.fields.getTextInputValue("reason");

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          await member.send(`❌ Ваша заявка на повышение отклонена. Причина: ${reason}`);
        } catch {}
      }
      return i.update({ content: "❌ Заявка на повышение отклонена", components: [] });
    }

    // Баланс
    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({ content: `💎 Баланс: ${getPoints(i.user.id)}`, ephemeral: true });
    }

  } catch (err) {
    console.error(err);
  }
});