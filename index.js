const { Telegraf, session, Scenes, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { db, FieldValue, getAdminConfig, setAdminId, updateUser, getUser, getChannels, getSchools, addChannel } = require('./config/firebase');
const MESSAGES = require('./constants/messages');

// Load environment variables
dotenv.config();

// Firebase and Message Constants
const { db, FieldValue, getAdminConfig, setAdminId, updateUser, getUser, getChannels, getSchools, addChannel, updateBotAdministeredChat, removeBotAdministeredChat, getBotAdministeredChats } = require('./config/firebase');
const MESSAGES = require('./constants/messages');


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

// Temporary raw text message logger for debugging mentions - MOVED EARLIER
bot.on('text', async (ctx, next) => {
    // Only log if not handled by a scene already
    if (!ctx.scene?.current) {
        console.log(`[RAW TEXT LOGGER] User: ${ctx.from?.id}, Chat: ${ctx.chat?.id} (${ctx.chat?.type}), Title: "${ctx.chat?.title || 'N/A'}", Text: "${ctx.message?.text}", isAdmin: ${ctx.isAdmin || false}`);
    }
    return next(); // Continue to other handlers
});

// --- Admin Check Middleware ---
bot.use(async (ctx, next) => {
  if (!db) {
    ctx.isAdmin = false;
    return next();
  }
  if (ctx.from && ctx.from.id) {
    const adminConfigDoc = await getAdminConfig();
    ctx.isAdmin = adminConfigDoc && adminConfigDoc.exists && adminConfigDoc.data()?.adminId === ctx.from.id; // Added optional chaining for data()
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
            try {
                await ctx.reply(MESSAGES.FORCED_JOIN_PROMPT, Markup.inlineKeyboard(buttons, { columns: 1 }));
            } catch (e) {
                console.error(`Error sending forced join prompt to user ${userId}:`, e);
            }
            return;
        }
    }

    const userDoc = await getUser(userId);
    if (userDoc && userDoc.exists) { // Changed
        const userData = userDoc.data();
        if (!userData.gender || !userData.province || !userData.city) {
            try {
                await ctx.reply(MESSAGES.COMPLETE_INITIAL_REGISTRATION);
            } catch (e) {
                console.error(`Error sending complete initial registration prompt to user ${userId}:`, e);
            }
            return ctx.scene.enter('initialRegistrationScene');
        }
    } else {
        try {
            await ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND.replace(' با /start مجددا شروع کنید', ' لطفا دستور /start را ارسال کنید.')); // Adapted message
        } catch (e) {
            console.error(`Error sending user not found prompt to user ${userId}:`, e);
        }
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
    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, keyboard);
        } else {
            await ctx.reply(text, keyboard);
        }
    } catch (error) {
        console.error(`Error in showMainMenu for user ${ctx.from?.id}:`, error);
        if (error.response && error.response.error_code === 403) {
            console.warn(`Bot blocked by user ${ctx.from?.id}. Cannot send main menu.`);
        }
        // Do not attempt to reply further if the initial send failed, especially if blocked.
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
        if (!adminConfigDoc || !adminConfigDoc.exists || !adminConfigDoc.data()?.adminId) { // Added optional chaining for data()
            await setAdminId(userId);
            ctx.isAdmin = true;
            console.log(`User ${userId} has been set as the first admin.`);
            await ctx.reply('شما به عنوان اولین کاربر، ادمین ربات شدید!'); // This is a unique message, might not need constant
        }

        let userDoc = await getUser(userId);
        if (!userDoc || !userDoc.exists) { // Changed
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

        console.log("[/start] Checking session flags. ctx.session:", JSON.stringify(ctx.session)); // DEBUG LOG
        if (ctx.session.justRegistered) {
            console.log("[/start] justRegistered flag is true. Showing main menu."); // DEBUG LOG
            delete ctx.session.justRegistered;
            const menuMessage = MESSAGES.REGISTRATION_SUCCESS_GUIDE_MAIN_MENU.split('\n')[1] || MESSAGES.WELCOME_BACK;
            return showMainMenu(ctx, menuMessage);
        }

        console.log("[/start] justRegistered flag is false or not set. Showing default main menu."); // DEBUG LOG
        // Default welcome for existing users or if not just registered through the scene
        return showMainMenu(ctx);

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
    if (!userDoc || !userDoc.exists) return ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND); // Changed
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
    if (!userDoc || !userDoc.exists) return ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND); // Changed
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
    if (userDoc && userDoc.exists) { // Changed
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

    const adminChats = await getBotAdministeredChats();
    if (!adminChats || adminChats.length === 0) {
        await ctx.editMessageText(
            "شما ادمین ربات هستید.\n\n" +
            "در حال حاضر ربات در هیچ کانال یا گروهی به عنوان ادمین شناسایی نشده است.\n" +
            "لطفاً ربات را به کانال/گروه مورد نظر خود اضافه کرده و به آن دسترسی ادمینی بدهید.\n" +
            "سپس به این بخش بازگردید تا بتوانید آن را به عنوان کانال تبلیغی انتخاب کنید.",
            Markup.inlineKeyboard([
                Markup.button.callback('🔄 تلاش مجدد برای بارگذاری لیست', 'admin_manage_channels'),
                Markup.button.callback('بازگشت به پنل ادمین', 'admin_panel_action')
            ])
        );
        return;
    }

    const buttons = adminChats.map(chat => {
        const title = chat.title.length > 30 ? chat.title.substring(0, 27) + '...' : chat.title;
        return Markup.button.callback(`${title} (${chat.type})`, `SELECT_PROMO_CHAT_${chat.chatId}`);
    });

    // Add already promoted channels for information
    const promotedChannels = await getChannels(); // These are the ones actually used for forced join
    let message = "لطفاً کانال یا گروهی را که می‌خواهید به لیست عضویت اجباری اضافه کنید، از لیست زیر انتخاب نمایید.\n\nربات در کانال‌های زیر ادمین است:\n";

    if (promotedChannels && promotedChannels.length > 0) {
        message += "\n\nکانال‌های عضویت اجباری فعلی:\n";
        promotedChannels.forEach(pc => {
            message += `- ${pc.text || pc.channelId} (ID: ${pc.channelId})\n`;
        });
    }


    try {
        await ctx.editMessageText(message, Markup.inlineKeyboard(buttons, { columns: 1 }).row(Markup.button.callback('بازگشت به پنل ادمین', 'admin_panel_action')));
    } catch (e) {
        // If message is too long or other error
        console.error("Error editing message for admin_manage_channels:", e);
        await ctx.reply("لیست کانال‌ها برای نمایش بسیار طولانی است یا خطایی رخ داده. لطفا از طریق Firestore مستقیما مدیریت کنید یا با پشتیبانی تماس بگیرید.");
        await showAdminPanel(ctx); // Show admin panel again
    }
});

// Handler for selecting a chat to promote
bot.action(/SELECT_PROMO_CHAT_(.+)/, async (ctx) => {
    if (!ctx.isAdmin) return ctx.answerCbQuery(MESSAGES.ACCESS_DENIED_ADMIN, { show_alert: true });

    const chatId = ctx.match[1];
    const adminChats = await getBotAdministeredChats();
    const selectedChat = adminChats.find(c => String(c.chatId) === String(chatId));

    if (!selectedChat) {
        await ctx.answerCbQuery("کانال انتخاب شده یافت نشد. لیست ممکن است به‌روز نباشد.", { show_alert: true });
        return ctx.editMessageText("خطا: کانال انتخاب شده یافت نشد. لطفاً دوباره تلاش کنید.", Markup.inlineKeyboard([Markup.button.callback('بازگشت به مدیریت کانال‌ها', 'admin_manage_channels')]));
    }

    await ctx.answerCbQuery(`کانال «${selectedChat.title}» انتخاب شد.`);
    // Now enter the scene to get button text, etc.
    // The scene will then use addChannel to add it to the *actual* forced join list.
    return ctx.scene.enter('getChannelButtonTextScene', {
        channelId: selectedChat.chatId,
        channelLink: selectedChat.inviteLink, // This might be null or outdated
        channelTitle: selectedChat.title
    });
});


bot.action('admin_manage_schools', (ctx) => {
    if (ctx.callbackQuery) ctx.answerCbQuery();
    if (!ctx.isAdmin) return ctx.reply(MESSAGES.ACCESS_DENIED_ADMIN);
    ctx.scene.enter('manageSchoolsScene');
});

// --- Bot Chat Member Update Handler ---
bot.on('my_chat_member', async (ctx) => {
    const chat = ctx.chat;
    const newMemberStatus = ctx.myChatMember.new_chat_member.status;
    const oldMemberStatus = ctx.myChatMember.old_chat_member.status;

    console.log(`[my_chat_member] Bot status changed in chat ${chat.id} (${chat.title || 'N/A'}), type: ${chat.type}. New status: ${newMemberStatus}, Old status: ${oldMemberStatus}`);

    if (chat.type === 'channel' || chat.type === 'supergroup' || chat.type === 'group') {
        if (newMemberStatus === 'administrator') {
            console.log(`Bot is now an admin in ${chat.title} (${chat.id})`);
            let inviteLink = null;
            try {
                // Check if bot can create invite link (usually needs to be admin for this)
                if (ctx.myChatMember.new_chat_member.can_invite_users) {
                     inviteLink = await ctx.telegram.exportChatInviteLink(chat.id);
                } else if (chat.username) { // For public channels/supergroups
                    inviteLink = `https://t.me/${chat.username}`;
                }
            } catch (e) {
                console.warn(`Could not get invite link for ${chat.id} when becoming admin: ${e.message}`);
            }
            await updateBotAdministeredChat(chat.id, chat.title || `Chat ${chat.id}`, chat.type, inviteLink);
        } else if ( (newMemberStatus === 'left' || newMemberStatus === 'kicked' || oldMemberStatus === 'administrator') && newMemberStatus !== 'administrator' ) {
            // If bot was admin and now is not, or left/kicked
            console.log(`Bot is no longer an admin or has left/been kicked from ${chat.title} (${chat.id})`);
            await removeBotAdministeredChat(chat.id);
            // Also, if this chat was in the forced-join 'channels' list, admin should be notified or it should be removed.
            // For now, just removing from bot_administered_chats.
            const currentForcedChannels = await getChannels();
            if (currentForcedChannels.some(fc => String(fc.channelId) === String(chat.id))) {
                console.warn(`Channel ${chat.id} (${chat.title}) was a forced-join channel. Bot lost admin rights or left. Admin should be notified.`);
                // Optionally, send a message to the bot admin(s)
                const adminConfig = await getAdminConfig();
                if (adminConfig && adminConfig.exists && adminConfig.data()?.adminId) {
                    try {
                        await ctx.telegram.sendMessage(adminConfig.data().adminId, `توجه: ربات دیگر در کانال «${chat.title || chat.id}» که یکی از کانال‌های عضویت اجباری بود، ادمین نیست یا از آن خارج شده است. لطفاً این مورد را در پنل ادمین بررسی کنید.`);
                    } catch (e) { console.error("Error notifying admin about channel status change:", e); }
                }
            }
        }
    }
});


// --- Promote Channel by Mentioning Bot in a Channel (DEACTIVATED - Replaced by new admin panel logic) ---
// const ADD_CHANNEL_KEYWORD = 'addchannel';
// bot.on('text', async (ctx, next) => {
//     // ... (previous code for mention handler) ...
// });

// --- Error Handling ---
bot.catch(async (err, ctx) => { // Made this function async
    console.error(`Unhandled error for ${ctx.updateType} by User ${ctx.from?.id} in Chat ${ctx.chat?.id}:`, err);
    // Check if the error is due to the bot being blocked or kicked
    if (err.response && err.response.error_code === 403) {
        console.warn(`Bot was blocked or kicked from chat ${ctx.chat?.id}. No reply will be sent.`);
        // Optionally, mark user/chat as inactive in DB here
    } else {
        // For other errors, try to reply to the user if possible
        try {
            const baseMessage = MESSAGES.ERROR_GENERAL;
            if (ctx.scene && ctx.scene.leave) {
                await ctx.reply(`${baseMessage} ${MESSAGES.WELCOME_BACK.split('.')[0]}.`);
                ctx.scene.leave();
            } else if (ctx.reply) { // Check if ctx.reply exists before calling
                await ctx.reply(baseMessage);
            }
        } catch (e) {
            console.error("Error within bot.catch while trying to reply to user:", e);
        }
    }
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
