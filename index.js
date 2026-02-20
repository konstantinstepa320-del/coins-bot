/* ... остальной код без изменений ... */

client.on("interactionCreate", async i => {
  try {
    /* ===== заработок ===== */
    if (i.isButton() && i.customId === "earn_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("earn_select")
        .setPlaceholder("Выбери активность")
        .addOptions([
          { label: "Тайник +2", value: "2" },
          { label: "Капт +3", value: "3" },
          { label: "Заправка +1", value: "1" },
          { label: "Снять варн (-79)", value: "-79" }
        ]);
      return i.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (i.isStringSelectMenu() && i.customId === "earn_select") {
      const reward = i.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`earn_${reward}`)
        .setTitle("Подтверждение");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("proof")
            .setLabel("Ссылка/доказательство")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("earn_")) {
      await i.deferReply({ ephemeral: true });

      const reward = Number(i.customId.split("_")[1]);
      const proof = i.fields.getTextInputValue("proof");

      const ch = await client.channels.fetch(VERIFY_CHANNEL).catch(() => null);
      if (!ch) return i.editReply("❌ Канал не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на баллы")
        .setDescription(`Игрок: ${i.user}\nБаллы: ${reward}\nДоказательство: ${proof}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`earn_accept_${i.user.id}_${reward}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("earn_reject")
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });

      return i.editReply("✅ Отправлено на проверку");
    }

    /* ===== принятие и отклонение заявок на баллы ===== */

    if (i.isButton() && i.customId.startsWith("earn_accept_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const parts = i.customId.split("_");
      const id = parts[2];
      const reward = Number(parts[3]);

      addPoints(id, reward);

      const member = await i.guild.members.fetch(id).catch(() => null);
      if (member) {
        try {
          await member.roles.add(ROLE_REWARD_ID);
          await member.send(`🎉 Ваша заявка одобрена!\n\n💎 Начислено: ${reward} баллов\n📊 Новый баланс: ${getPoints(id)}`);
        } catch {}
        await checkAndGiveLevel(member);
      }

      return i.update({
        content: "✅ Начислено, роль выдана",
        components: []
      });
    }

    if (i.isButton() && i.customId === "earn_reject") {
      return i.update({
        content: "❌ Отклонено",
        components: []
      });
    }

    /* ===== Заявка на повышение ===== */

    if (i.isButton() && i.customId === "upgrade_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("upgrade_select")
        .addOptions([
          { label: "2→3 (-110)", value: "-110" },
          { label: "2→4 (-220)", value: "-220" }
        ]);

      return i.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
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

      const price = i.customId.split("_")[1];
      const nick = i.fields.getTextInputValue("nick");
      const videoLink = i.fields.getTextInputValue("video_link");

      const ch = await client.channels.fetch(VERIFY_CHANNEL).catch(() => null);
      if (!ch) return i.editReply("❌ Канал не найден");

      const embed = new EmbedBuilder()
        .setTitle("📈 Заявка на повышение")
        .setDescription(`Игрок: ${i.user}\nНик + статик: ${nick}\nЦена: ${price} баллов\n[Видео](${videoLink})`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`upgrade_accept_${i.user.id}_${price}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("upgrade_reject")
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });

      return i.editReply("✅ Заявка отправлена на проверку");
    }

    /* ===== Принять заявку на повышение ===== */

    if (i.isButton() && i.customId.startsWith("upgrade_accept_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const parts = i.customId.split("_");
      const userId = parts[2];
      const price = Number(parts[3]);

      // Проверяем, достаточно ли баллов
      const userPoints = getPoints(userId);
      if (userPoints < Math.abs(price)) {
        return i.reply({ content: "❌ У пользователя недостаточно баллов", ephemeral: true });
      }

      // Снимаем баллы
      addPoints(userId, price); // price отрицательное число, минус снимает

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return i.reply({ content: "❌ Пользователь не найден", ephemeral: true });
      }

      // Выдать роль повышения (логика выдачи роли повышения — добавь сюда свои условия)
      // Например, по price можно определить уровень, или выдавать конкретную роль вручную
      // Ниже пример: добавляем роль Reward, ты можешь изменить под свои нужды
      try {
        await member.roles.add(ROLE_REWARD_ID);
        await member.send(`🎉 Ваша заявка на повышение одобрена! С баланса снято ${Math.abs(price)} баллов.`);
      } catch {}

      await checkAndGiveLevel(member);

      return i.update({ content: "✅ Заявка на повышение принята", components: [] });
    }

    if (i.isButton() && i.customId === "upgrade_reject") {
      return i.update({
        content: "❌ Заявка на повышение отклонена",
        components: []
      });
    }

    /* ===== Баланс ===== */

    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({
        content: `💎 Баланс: ${getPoints(i.user.id)}`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error("Ошибка:", err);
  }
});