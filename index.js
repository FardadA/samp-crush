const { Telegraf, session, Scenes, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { db, FieldValue, getAdminConfig, setAdminId, updateUser, getUser, getChannels, getSchools, addChannel } = require('./config/firebase');
const MESSAGES = require('./constants/messages');

// Load environment variables
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

// Import Scenes
const initialRegistrationScene = require('./scenes/initialRegistrationScene');
const enterNameScene = require('./scenes/enterNameScene');
const enterAgeScene = require('./scenes/enterAgeScene');
const selectSchoolScene = require('./scenes/selectSchoolScene');
const enterPhoneScene = require('./scenes/enterPhoneScene');
const getChannelButtonTextScene = require('./scenes/getChannelButtonTextScene');
const manageSchoolsScene = require('./scenes/manageSchoolsScene');

// Create a new Telegraf bot instance
const bot = new Telegraf(botToken);

// Create a stage for scenes
const stage = new Scenes.Stage([
    initialRegistrationScene,
    enterNameScene,
    enterAgeScene,
    selectSchoolScene,
    enterPhoneScene,
    getChannelButtonTextScene,
    manageSchoolsScene,
]);

bot.use(session());
bot.use(stage.middleware());

// --- Admin Check Middleware ---
bot.use(async (ctx, next) => {
  if (!db) {
    ctx.isAdmin = false;
    return next();
  }
  if (ctx.from && ctx.from.id) {
    const adminConfigDoc = await getAdminConfig();
    ctx.isAdmin = adminConfigDoc && adminConfigDoc.exists && adminConfigDoc.data().adminId === ctx.from.id;
  } else {
    ctx.isAdmin = false;
  }
  return next();
});

// --- Forced Join & Initial Registration Middleware ---
const mainFlowMiddleware = async (ctx, next) => {
    const userId = ctx.from?.id;

    if (!userId || ctx.isAdmin) return next();

    const update = ctx.update;
    const messageText = update.message?.text;
    const callbackQueryData = update.callback_query?.data;

    const bypassTokens = ['/start', '/menu', 'show_main_menu', 'refresh_join_status', 'admin_panel_action'];
    if (bypassTokens.includes(messageText) || bypassTokens.includes(callbackQueryData) || (ctx.scene && ctx.scene.current)) {
        return next();
    }

    if (!db) return next();

    const channelsToJoin = await getChannels();
    if (channelsToJoin && channelsToJoin.length > 0) {
        const unjoinedChannels = [];
        for (const channel of channelsToJoin) {
            try {
                const member = await ctx.telegram.getChatMember(channel.channelId, userId);
                if (!['member', 'administrator', 'creator'].includes(member.status)) {
                    unjoinedChannels.push(channel);
                }
            } catch (error) {
                console.warn(`Error checking membership for channel ${channel.channelId} (User: ${userId}): ${error.message}`);
            }
        }
        if (unjoinedChannels.length > 0) {
            const buttons = unjoinedChannels.map(ch => Markup.button.url(ch.text || `کانال ${ch.channelId}`, ch.link || `https://t.me/c/${String(ch.channelId).replace("-100", "")}/${ch.message_id || ''}`));
            buttons.push(Markup.button.callback('✅ عضو شدم', 'refresh_join_status'));
            await ctx.reply(MESSAGES.FORCED_JOIN_PROMPT, Markup.inlineKeyboard(buttons, { columns: 1 }));
            return;
        }
    }

    const userDoc = await getUser(userId);
    if (userDoc && userDoc.exists) {
        const userData = userDoc.data();
        if (!userData.gender || !userData.province || !userData.city) {
            await ctx.reply(MESSAGES.COMPLETE_INITIAL_REGISTRATION);
            return ctx.scene.enter('initialRegistrationScene');
        }
    } else {
        await ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND.replace(' با /start مجددا شروع کنید', ' لطفا دستور /start را ارسال کنید.')); // Adapted message
        return;
    }
    return next();
};
bot.use(mainFlowMiddleware);


// --- Helper function to display Main Menu ---
const showMainMenu = async (ctx, message) => {
    const text = message || MESSAGES.WELCOME_BACK;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👤 نمایه من', 'show_profile'), Markup.button.callback('💰 سکه‌های من', 'show_coins')],
        [Markup.button.callback('💬 چت با ناشناس', 'chat_anonymous_placeholder')],
        [Markup.button.callback('✍️ ثبت نظر', 'submit_feedback_placeholder')],
        [Markup.button.callback('👀 نظرات اطراف', 'view_feedback_placeholder')],
        ...(ctx.isAdmin ? [[Markup.button.callback('👑 پنل ادمین', 'admin_panel_action')]] : [])
    ]);
    if (ctx.callbackQuery) {
        try { await ctx.editMessageText(text, keyboard); }
        catch (e) { await ctx.reply(text, keyboard); }
    } else {
        await ctx.reply(text, keyboard);
    }
};

// --- Command Handlers ---
bot.command('start', async (ctx) => {
    console.log(`User ${ctx.from.id} (${ctx.from.first_name}) started the bot. Payload: ${ctx.startPayload}`);
    if (!db) return ctx.reply(MESSAGES.ERROR_FIREBASE_CONNECTION);

    const userId = ctx.from.id;
    const rawInviterId = ctx.startPayload;
    const inviterId = parseInt(rawInviterId, 10);

    try {
        const adminConfigDoc = await getAdminConfig();
        if (!adminConfigDoc || !adminConfigDoc.exists || !adminConfigDoc.data().adminId) {
            await setAdminId(userId);
            ctx.isAdmin = true;
            console.log(`User ${userId} has been set as the first admin.`);
            await ctx.reply('شما به عنوان اولین کاربر، ادمین ربات شدید!'); // This is a unique message, might not need constant
        }

        let userDoc = await getUser(userId);
        if (!userDoc || !userDoc.exists) {
            const initialCoins = 20;
            await updateUser(userId, {
                telegramId: userId, firstName: ctx.from.first_name || '', username: ctx.from.username || '',
                coins: initialCoins, createdAt: FieldValue.serverTimestamp(), profileCompletionAwarded: false,
            }, false);
            await ctx.reply(MESSAGES.WELCOME_NEW_USER(initialCoins));
            userDoc = await getUser(userId);

            if (inviterId && !isNaN(inviterId) && inviterId !== userId) {
                const inviterUserDoc = await getUser(inviterId);
                if (inviterUserDoc && inviterUserDoc.exists) {
                    const inviterCoins = inviterUserDoc.data().coins || 0;
                    const awardCoins = 10;
                    await updateUser(inviterId, { coins: inviterCoins + awardCoins });
                    console.log(`User ${inviterId} received ${awardCoins} coins for inviting ${userId}.`);
                    try { await ctx.telegram.sendMessage(inviterId, MESSAGES.INVITER_AWARD_NOTIFICATION(ctx.from.first_name, awardCoins)); }
                    catch (e) { console.warn(`Could not send message to inviter ${inviterId}: ${e.message}`); }
                }
            }
        }

        const userData = userDoc.data();
        if (!userData.gender || !userData.province || !userData.city) {
            await ctx.reply(MESSAGES.COMPLETE_INITIAL_REGISTRATION);
            return ctx.scene.enter('initialRegistrationScene');
        }
        // Adapted message for start completion
        return showMainMenu(ctx, MESSAGES.FORCED_JOIN_SUCCESS_ALL_DONE(ctx).replace('عضویت شما تایید شد و اطلاعات اولیه‌تان کامل است. ', ''));

    } catch (error) {
        console.error('Error in /start command:', error);
        return ctx.reply(MESSAGES.ERROR_GENERAL);
    }
});

bot.command('menu', async (ctx) => showMainMenu(ctx));
bot.action('show_main_menu', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    return showMainMenu(ctx);
});

// --- Main Menu Actions ---
bot.action('show_profile', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userDoc = await getUser(userId);
    if (!userDoc || !userDoc.exists) return ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND);
    const u = userDoc.data();
    let profileText = MESSAGES.PROFILE_TITLE;
    profileText += `▫️ نام: ${u.name || MESSAGES.PROFILE_FIELD_UNSET}\n`;
    profileText += `▫️ سن: ${u.age || MESSAGES.PROFILE_FIELD_UNSET}\n`;
    profileText += `▫️ جنسیت: ${u.gender === 'male' ? 'آقا' : (u.gender === 'female' ? 'خانم' : MESSAGES.PROFILE_FIELD_UNSET)}\n`;
    profileText += `▫️ استان: ${u.province || MESSAGES.PROFILE_FIELD_UNSET}\n`;
    profileText += `▫️ شهر: ${u.city || MESSAGES.PROFILE_FIELD_UNSET}\n`;
    profileText += `▫️ مدرسه: ${u.school || MESSAGES.PROFILE_FIELD_UNSET}\n`;
    profileText += `▫️ شماره تماس: ${u.phoneNumber || MESSAGES.PROFILE_FIELD_UNSET}\n`;
    profileText += `${MESSAGES.COINS_YOUR_BALANCE(u.coins || 0)}\n`;
    const buttons = [];
    if (!u.name) buttons.push(Markup.button.callback('📝 ثبت نام', 'enter_name_scene'));
    if (!u.age) buttons.push(Markup.button.callback('🎂 ثبت سن', 'enter_age_scene'));
    if (!u.school) buttons.push(Markup.button.callback('🏫 انتخاب مدرسه', 'select_school_scene'));
    if (!u.phoneNumber) buttons.push(Markup.button.callback('📞 ثبت شماره', 'enter_phone_scene'));
    buttons.push(Markup.button.callback('بازگشت به منوی اصلی', 'show_main_menu'));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });
    try { await ctx.editMessageText(profileText, { ...keyboard, parse_mode: 'Markdown' }); }
    catch (e) { await ctx.reply(profileText, { ...keyboard, parse_mode: 'Markdown' }); }
});

bot.action('show_coins', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userDoc = await getUser(userId);
    if (!userDoc || !userDoc.exists) return ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND);
    const coins = userDoc.data().coins || 0;
    const botInfo = await ctx.telegram.getMe();
    const referralLink = `https://t.me/${botInfo.username}?start=${userId}`;
    const message = `${MESSAGES.COINS_YOUR_BALANCE(coins)}\n\n${MESSAGES.COINS_REFERRAL_LINK(referralLink)}`;
    try { await ctx.editMessageText(message, Markup.inlineKeyboard([Markup.button.callback('بازگشت به منوی اصلی', 'show_main_menu')]), { parse_mode: 'Markdown' }); }
    catch (e) { await ctx.reply(message, Markup.inlineKeyboard([Markup.button.callback('بازگشت به منوی اصلی', 'show_main_menu')]), { parse_mode: 'Markdown' }); }
});

['chat_anonymous_placeholder', 'submit_feedback_placeholder', 'view_feedback_placeholder'].forEach(actionName => {
    bot.action(actionName, async (ctx) => {
        if (ctx.callbackQuery) await ctx.answerCbQuery(MESSAGES.INFO_SECTION_SOON.split('.')[0]); // Short answer
        try { await ctx.editMessageText(MESSAGES.INFO_SECTION_SOON, Markup.inlineKeyboard([Markup.button.callback('بازگشت به منوی اصلی', 'show_main_menu')])); }
        catch(e) { await ctx.reply(MESSAGES.INFO_SECTION_SOON, Markup.inlineKeyboard([Markup.button.callback('بازگشت به منوی اصلی', 'show_main_menu')])); }
    });
});

bot.action('enter_name_scene', (ctx) => { if (ctx.callbackQuery) ctx.answerCbQuery(); ctx.scene.enter('enterNameScene'); });
bot.action('enter_age_scene', (ctx) => { if (ctx.callbackQuery) ctx.answerCbQuery(); ctx.scene.enter('enterAgeScene'); });
bot.action('select_school_scene', (ctx) => { if (ctx.callbackQuery) ctx.answerCbQuery(); ctx.scene.enter('selectSchoolScene'); });
bot.action('enter_phone_scene', (ctx) => { if (ctx.callbackQuery) ctx.answerCbQuery(); ctx.scene.enter('enterPhoneScene'); });

bot.action('refresh_join_status', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery(MESSAGES.FORCED_JOIN_REFRESHING);
    try { await ctx.deleteMessage(); } catch(e) { console.warn("Could not delete message on refresh_join_status:", e.message); }
    const userId = ctx.from.id;
    if (!userId) return;
    const channelsToJoin = await getChannels();
    if (channelsToJoin && channelsToJoin.length > 0) {
        const unjoinedChannels = [];
        for (const channel of channelsToJoin) {
            try {
                const member = await ctx.telegram.getChatMember(channel.channelId, userId);
                if (!['member', 'administrator', 'creator'].includes(member.status)) unjoinedChannels.push(channel);
            } catch (error) { console.warn(`Error re-checking membership for ${channel.channelId} (User: ${userId}): ${error.message}`);}
        }
        if (unjoinedChannels.length > 0) {
            const buttons = unjoinedChannels.map(ch => Markup.button.url(ch.text || `کانال ${ch.channelId}`, ch.link || `https://t.me/c/${String(ch.channelId).replace("-100", "")}/${ch.message_id || ''}`));
            buttons.push(Markup.button.callback('✅ عضو شدم', 'refresh_join_status'));
            return ctx.reply(MESSAGES.FORCED_JOIN_STILL_UNJOINED, Markup.inlineKeyboard(buttons, { columns: 1 }));
        }
    }
    const userDoc = await getUser(userId);
    if (userDoc && userDoc.exists) {
        const userData = userDoc.data();
        if (!userData.gender || !userData.province || !userData.city) {
            await ctx.reply(MESSAGES.FORCED_JOIN_SUCCESS_COMPLETE_INFO);
            return ctx.scene.enter('initialRegistrationScene');
        } else {
            return showMainMenu(ctx, MESSAGES.FORCED_JOIN_SUCCESS_ALL_DONE(ctx));
        }
    } else {
        return ctx.reply(MESSAGES.FORCED_JOIN_SUCCESS_REGISTER_START);
    }
});

// --- Admin Panel ---
const showAdminPanel = async (ctx) => {
    const messageText = MESSAGES.ADMIN_WELCOME;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📢 مدیریت کانال‌های تبلیغی', 'admin_manage_channels')],
        [Markup.button.callback('🏫 مدیریت مدارس', 'admin_manage_schools')],
        [Markup.button.callback(' بازگشت به منوی اصلی', 'show_main_menu')]
    ], { columns: 1 });

    if (ctx.callbackQuery) {
        try { await ctx.editMessageText(messageText, { ...keyboard, parse_mode: 'Markdown' }); }
        catch (e) { await ctx.reply(messageText, { ...keyboard, parse_mode: 'Markdown' });}
    } else {
        await ctx.reply(messageText, { ...keyboard, parse_mode: 'Markdown' });
    }
};

bot.command('admin', async (ctx) => {
    if (!ctx.isAdmin) return ctx.reply(MESSAGES.ACCESS_DENIED_ADMIN);
    return showAdminPanel(ctx);
});
bot.action('admin_panel_action', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    if (!ctx.isAdmin) return ctx.reply(MESSAGES.ACCESS_DENIED_ADMIN); // Should not happen if button not shown
    return showAdminPanel(ctx);
});

bot.action('admin_manage_channels', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    if (!ctx.isAdmin) return ctx.reply(MESSAGES.ACCESS_DENIED_ADMIN);
    const currentChannels = await getChannels();
    const channelsText = currentChannels?.map(c => `- ${c.text || c.channelId} (ID: ${c.channelId})`).join('\n');
    await ctx.editMessageText(
        MESSAGES.ADMIN_CHANNEL_MGMT_INSTRUCTIONS(channelsText),
        Markup.inlineKeyboard([Markup.button.callback('بازگشت به پنل ادمین', 'admin_panel_action')])
    );
});

bot.action('admin_manage_schools', (ctx) => {
    if (ctx.callbackQuery) ctx.answerCbQuery();
    if (!ctx.isAdmin) return ctx.reply(MESSAGES.ACCESS_DENIED_ADMIN);
    ctx.scene.enter('manageSchoolsScene');
});

bot.command('promote_channel', async (ctx) => {
    if (!ctx.isAdmin) {
        console.log(`Non-admin ${ctx.from.id} tried to use /promote_channel in chat ${ctx.chat.id}`);
        return;
    }
    if (ctx.chat.type === 'private') {
        return ctx.reply(MESSAGES.ADMIN_PROMOTE_CHANNEL_IN_CHANNEL_ONLY);
    }

    const channelId = ctx.chat.id;
    const channelTitle = ctx.chat.title;
    let channelLink = '';
    try {
        channelLink = await ctx.telegram.exportChatInviteLink(channelId);
    } catch (e) {
        console.warn(`Could not create invite link for channel ${channelId} (${channelTitle}): ${e.message}`);
        if (ctx.chat.username) channelLink = `https://t.me/${ctx.chat.username}`;
        else await ctx.telegram.sendMessage(ctx.from.id, MESSAGES.ADMIN_PROMOTE_CHANNEL_NO_LINK(channelTitle, channelId));
    }

    await ctx.telegram.sendMessage(ctx.from.id, MESSAGES.ADMIN_PROMOTE_CHANNEL_INFO(channelTitle, channelId));
    ctx.scene.enter('getChannelButtonTextScene', { channelId, channelLink, channelTitle });
});


// --- General Message Handler (Fallback) ---
bot.on('message', async (ctx) => {
    console.log(`(Fallback) Received message from ${ctx.from.id} in chat ${ctx.chat?.id} (${ctx.chat?.type}): ${ctx.message.text || ctx.message.contact?.phone_number}`);
    if (!ctx.scene?.current && !ctx.message?.text?.startsWith('/') && ctx.chat.type === 'private') {
        return showMainMenu(ctx, MESSAGES.CHOOSE_OPTION); // Guide to menu
    }
});

// --- Error Handling ---
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType} by User ${ctx.from?.id} in Chat ${ctx.chat?.id}:`, err);
    console.error(err.stack);
    try {
        const baseMessage = MESSAGES.ERROR_GENERAL;
        if (ctx.scene && ctx.scene.leave) {
            ctx.reply(`${baseMessage} ${MESSAGES.WELCOME_BACK.split('.')[0]}.`); // Simplified return message
            ctx.scene.leave();
        } else {
            ctx.reply(baseMessage);
        }
    } catch (e) { console.error("Error in error handler itself:", e); }
});

// --- Start Bot ---
if (db) {
    bot.launch()
        .then(() => console.log('Bot started successfully and connected to Firestore.'))
        .catch((err) => console.error('Error starting bot', err));
} else {
    console.error("Bot did not start: Firestore connection failed.");
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('Bot is initializing...');
