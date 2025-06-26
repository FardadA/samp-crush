const { Scenes, Markup } = require('telegraf');
const { updateUser, getUser } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

const sceneId = 'enterPhoneScene';
const enterPhoneScene = new Scenes.BaseScene(sceneId);

enterPhoneScene.enter(async (ctx) => {
    await ctx.reply(MESSAGES.PROFILE_PHONE_PROMPT,
        Markup.keyboard([
            Markup.button.contactRequest('📱 اشتراک شماره تماس')
        ]).resize().oneTime()
    );
});

enterPhoneScene.on('contact', async (ctx) => {
    const phoneNumber = ctx.message.contact.phone_number;
    const userId = ctx.from.id;

    if (ctx.message.contact.user_id !== userId) {
        await ctx.reply(MESSAGES.PROFILE_PHONE_NOT_OWN, Markup.removeKeyboard());
        return ctx.scene.reenter();
    }

    try {
        await updateUser(userId, { phoneNumber: phoneNumber });
        await ctx.reply(MESSAGES.PROFILE_PHONE_SUCCESS(phoneNumber), Markup.removeKeyboard());

        const userDoc = await getUser(userId);
        if (userDoc && userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.name && userData.age && userData.school && userData.phoneNumber && !userData.profileCompletionAwarded) {
                const currentCoins = userData.coins || 0;
                const awardCoins = 50;
                await updateUser(userId, { coins: currentCoins + awardCoins, profileCompletionAwarded: true });
                await ctx.reply(MESSAGES.PROFILE_COMPLETE_AWARD(awardCoins));
            }
        }
    } catch (error) {
        console.error(`Error updating phone for user ${userId}:`, error);
        await ctx.reply(MESSAGES.ERROR_GENERAL, Markup.removeKeyboard());
    } finally {
        return ctx.scene.leave();
    }
});

enterPhoneScene.on('message', async (ctx) => {
    // Remove the custom keyboard if user sends text instead of contact
    await ctx.reply(MESSAGES.CHOOSE_OPTION.replace('یکی از گزینه‌های موجود را انتخاب کنید', 'لطفا از دکمه "📱 اشتراک شماره تماس" استفاده کنید.'), Markup.removeKeyboard());
    // Optionally, re-prompt with the button:
    // await ctx.reply(MESSAGES.PROFILE_PHONE_PROMPT,
    //     Markup.keyboard([
    //         Markup.button.contactRequest('📱 اشتراک شماره تماس')
    //     ]).resize().oneTime()
    // );
});

module.exports = enterPhoneScene;
