const { Scenes, Markup } = require('telegraf');
const { updateUser, getUser } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

const sceneId = 'enterNameScene';
const enterNameScene = new Scenes.BaseScene(sceneId);

enterNameScene.enter(async (ctx) => {
    await ctx.reply(MESSAGES.PROFILE_NAME_PROMPT);
});

enterNameScene.on('text', async (ctx) => {
    const name = ctx.message.text.trim();
    if (name.length < 2 || name.length > 50) {
        await ctx.reply(MESSAGES.PROFILE_NAME_INVALID);
        return ctx.scene.reenter(); // Ask again
    }

    const userId = ctx.from.id;
    try {
        await updateUser(userId, { name: name });
        await ctx.reply(MESSAGES.PROFILE_NAME_SUCCESS(name));

        const userDoc = await getUser(userId);
        if (userDoc && userDoc.exists) { // Changed from userDoc.exists()
            const userData = userDoc.data();
            if (userData.name && userData.age && userData.school && userData.phoneNumber && !userData.profileCompletionAwarded) {
                const currentCoins = userData.coins || 0;
                const awardCoins = 50;
                await updateUser(userId, { coins: currentCoins + awardCoins, profileCompletionAwarded: true });
                await ctx.reply(MESSAGES.PROFILE_COMPLETE_AWARD(awardCoins));
            }
        }
    } catch (error) {
        console.error(`Error updating name for user ${userId}:`, error);
        await ctx.reply(MESSAGES.ERROR_GENERAL);
    } finally {
        // TODO: Return to profile view or main menu automatically
        // For now, user needs to re-issue /menu or click profile again
        // We can send a specific keyboard or message here
        // e.g., ctx.reply("برای مشاهده پروفایل به‌روز شده، دوباره گزینه نمایه من را از /menu انتخاب کنید.");
        return ctx.scene.leave();
    }
});

enterNameScene.on('message', (ctx) => ctx.reply(MESSAGES.CHOOSE_OPTION.replace('یکی از گزینه‌های موجود را انتخاب کنید', 'لطفا فقط نام خود را به صورت متن ارسال کنید.')));

module.exports = enterNameScene;
