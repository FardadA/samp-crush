const { Scenes, Markup } = require('telegraf');
const { addChannel } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

const sceneId = 'getChannelButtonTextScene';
const getChannelButtonTextScene = new Scenes.BaseScene(sceneId);

getChannelButtonTextScene.enter(async (ctx) => {
    const { channelId, channelLink, channelTitle } = ctx.scene.state;

    if (!channelId) { // channelLink can be empty if bot couldn't fetch it
        await ctx.reply(MESSAGES.ADMIN_CHANNEL_ERROR_INFO_MISSING);
        return ctx.scene.leave();
    }
    await ctx.reply(MESSAGES.ADMIN_CHANNEL_BUTTON_TEXT_PROMPT(channelTitle, channelId, channelLink || 'موجود نیست'));
});

getChannelButtonTextScene.on('text', async (ctx) => {
    const buttonText = ctx.message.text.trim();
    if (buttonText.length < 1 || buttonText.length > 30) {
        await ctx.reply(MESSAGES.ADMIN_CHANNEL_BUTTON_TEXT_INVALID);
        return; // Stay in scene, ask again
    }

    ctx.scene.state.buttonText = buttonText;
    const { channelId, channelLink, channelTitle } = ctx.scene.state;

    await ctx.reply(
        MESSAGES.ADMIN_CHANNEL_CONFIRM_ADD(channelTitle, channelId, channelLink || 'موجود نیست', buttonText),
        Markup.inlineKeyboard([
            Markup.button.callback('✅ تایید و افزودن', 'CONFIRM_ADD_CHANNEL'),
            Markup.button.callback('❌ لغو', 'CANCEL_ADD_CHANNEL')
        ])
    );
});

getChannelButtonTextScene.action('CONFIRM_ADD_CHANNEL', async (ctx) => {
    const { channelId, channelLink, buttonText, channelTitle } = ctx.scene.state;
    if (!channelId || !buttonText) { // channelLink might be optional if admin confirms without it
        await ctx.editMessageText(MESSAGES.ADMIN_CHANNEL_ERROR_INFO_MISSING.replace('دوباره تلاش کنید', 'عملیات لغو شد.'));
        return ctx.scene.leave();
    }

    try {
        await addChannel(String(channelId), channelLink || '', buttonText);
        await ctx.editMessageText(MESSAGES.ADMIN_CHANNEL_ADD_SUCCESS(channelTitle, channelId));
    } catch (error) {
        console.error(`Error adding channel ${channelId} via admin panel:`, error);
        await ctx.editMessageText(MESSAGES.ERROR_GENERAL);
    } finally {
        return ctx.scene.leave();
    }
});

getChannelButtonTextScene.action('CANCEL_ADD_CHANNEL', async (ctx) => {
    try {
        await ctx.editMessageText(MESSAGES.ADMIN_CHANNEL_ADD_CANCEL);
    } catch(e) { console.error("Error editing message on CANCEL_ADD_CHANNEL:", e); }
    return ctx.scene.leave();
});

getChannelButtonTextScene.on('message', (ctx) => {
    if (ctx.scene.state.buttonText) {
         ctx.reply(MESSAGES.CHOOSE_OPTION.replace('یکی از گزینه‌های موجود را انتخاب کنید', 'لطفا یکی از گزینه‌های "✅ تایید و افزودن" یا "❌ لغو" را انتخاب کنید.'));
    } else {
        ctx.reply(MESSAGES.CHOOSE_OPTION.replace('یکی از گزینه‌های موجود را انتخاب کنید', 'لطفا متن روی دکمه را به صورت متن ارسال کنید.'));
    }
});

module.exports = getChannelButtonTextScene;
