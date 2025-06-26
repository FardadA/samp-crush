const { Scenes, Markup } = require('telegraf');
const { updateUser, getUser } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

const sceneId = 'enterAgeScene';
const enterAgeScene = new Scenes.BaseScene(sceneId);

enterAgeScene.enter(async (ctx) => {
    await ctx.reply(MESSAGES.PROFILE_AGE_PROMPT);
});

enterAgeScene.on('text', async (ctx) => {
    const ageInput = ctx.message.text.trim();
    const age = parseInt(ageInput, 10);

    if (isNaN(age) || age < 10 || age > 30) {
        await ctx.reply(MESSAGES.PROFILE_AGE_INVALID);
        return ctx.scene.reenter(); // Ask again
    }

    const userId = ctx.from.id;
    try {
        await updateUser(userId, { age: age });
        await ctx.reply(MESSAGES.PROFILE_AGE_SUCCESS(age));

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
        console.error(`Error updating age for user ${userId}:`, error);
        await ctx.reply(MESSAGES.ERROR_GENERAL);
    } finally {
        return ctx.scene.leave();
    }
});

enterAgeScene.on('message', (ctx) => ctx.reply(MESSAGES.CHOOSE_OPTION.replace('یکی از گزینه‌های موجود را انتخاب کنید', 'لطفا فقط سن خود را به صورت عدد ارسال کنید.')));

module.exports = enterAgeScene;
