const { Scenes, Markup } = require('telegraf');
const { updateUser, getUser, getSchools } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

const sceneId = 'selectSchoolScene';
const selectSchoolScene = new Scenes.BaseScene(sceneId);

selectSchoolScene.enter(async (ctx) => {
    const userId = ctx.from.id;
    const userDoc = await getUser(userId);
    if (!userDoc || !userDoc.exists()) {
        await ctx.reply(MESSAGES.PROFILE_USER_INFO_NOT_FOUND);
        return ctx.scene.leave();
    }

    const userData = userDoc.data();
    const userProvince = userData.province;
    const userCity = userData.city;

    if (!userProvince || !userCity) {
        await ctx.reply(MESSAGES.COMPLETE_INITIAL_REGISTRATION.replace('برای ادامه، ل', 'استان یا شهر شما در سیستم ثبت نشده است. ل')); // Adapted
        return ctx.scene.leave();
    }

    const schools = await getSchools(userProvince, userCity);

    if (!schools || schools.length === 0) {
        await ctx.reply(MESSAGES.PROFILE_SCHOOL_NO_SCHOOLS_FOR_CITY(userCity, userProvince));
        console.warn(`No schools found for ${userCity}, ${userProvince} for user ${userId}`);
        return ctx.scene.leave();
    }

    ctx.session.schoolsList = schools.sort();

    const buttons = ctx.session.schoolsList.map(school => Markup.button.callback(school, `SELECT_SCHOOL_${school.replace(/\s+/g, '_').substring(0, 30)}`)); // Make callback data shorter if needed and valid

    if (buttons.length === 0) {
        await ctx.reply(MESSAGES.PROFILE_SCHOOL_NOT_FOUND);
        return ctx.scene.leave();
    }

    await ctx.reply(MESSAGES.PROFILE_SCHOOL_PROMPT, Markup.inlineKeyboard(buttons, { columns: 1 }));
});

selectSchoolScene.action(/SELECT_SCHOOL_(.+)/, async (ctx) => {
    const schoolNameMatch = ctx.match[1].replace(/_/g, ' ');
    // Find the exact school name from session list to handle potential truncation in callback data
    const schoolName = ctx.session.schoolsList?.find(s => s.replace(/\s+/g, '_').substring(0, 30) === ctx.match[1]) || schoolNameMatch;

    const userId = ctx.from.id;

    try {
        await updateUser(userId, { school: schoolName });
        await ctx.editMessageText(MESSAGES.PROFILE_SCHOOL_SUCCESS(schoolName));

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
        console.error(`Error updating school for user ${userId}:`, error);
        await ctx.reply(MESSAGES.ERROR_GENERAL);
    } finally {
        delete ctx.session.schoolsList;
        return ctx.scene.leave();
    }
});

selectSchoolScene.on('message', (ctx) => ctx.reply(MESSAGES.CHOOSE_OPTION));

module.exports = selectSchoolScene;
