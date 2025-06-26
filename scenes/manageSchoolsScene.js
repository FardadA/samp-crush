const { Scenes, Markup } = require('telegraf');
const { addSchools, getSchools } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

const sceneId = 'manageSchoolsScene';
const manageSchoolsScene = new Scenes.BaseScene(sceneId);

const provinces = {
    'تهران': ['تهران', 'شهریار', 'اسلامشهر', 'قدس', 'ملارد', 'ورامین', 'پاکدشت', 'قرچک'],
    'البرز': ['کرج', 'فردیس', 'نظرآباد', 'هشتگرد', 'محمدشهر', 'کمال‌شهر', 'اشتهارد'],
};

manageSchoolsScene.enter(async (ctx) => {
    ctx.scene.state.stage = 'SELECT_PROVINCE';
    ctx.scene.state.newSchools = [];
    await ctx.reply(MESSAGES.ADMIN_SCHOOL_MGMT_TITLE + MESSAGES.ADMIN_SCHOOL_PROVINCE_PROMPT, Markup.inlineKeyboard(
        Object.keys(provinces).map(province => Markup.button.callback(province, `ADMIN_SELECT_PROVINCE_${province}`))
    , { columns: 2 }));
});

Object.keys(provinces).forEach(provinceName => {
    manageSchoolsScene.action(`ADMIN_SELECT_PROVINCE_${provinceName}`, async (ctx) => {
        if (ctx.scene.state.stage !== 'SELECT_PROVINCE') {
            await ctx.answerCbQuery(MESSAGES.ADMIN_INVALID_STAGE, { show_alert: true });
            return;
        }
        ctx.scene.state.selectedProvince = provinceName;
        ctx.scene.state.stage = 'SELECT_CITY';
        const cities = provinces[provinceName].sort();
        try {
            await ctx.editMessageText(MESSAGES.ADMIN_SCHOOL_CITY_PROMPT(provinceName), Markup.inlineKeyboard(
                cities.map(city => Markup.button.callback(city, `ADMIN_SELECT_CITY_${city.replace(/\s+/g, '_')}`)),
                { columns: 2 }
            ));
        } catch (e) { console.error("Error editing message in ADMIN_SELECT_PROVINCE: ", e); }
    });
});

manageSchoolsScene.action(/ADMIN_SELECT_CITY_(.+)/, async (ctx) => {
    if (ctx.scene.state.stage !== 'SELECT_CITY') {
        await ctx.answerCbQuery(MESSAGES.ADMIN_INVALID_STAGE, { show_alert: true });
        return;
    }
    const cityName = ctx.match[1].replace(/_/g, ' ');
    ctx.scene.state.selectedCity = cityName;
    ctx.scene.state.stage = 'ADD_SCHOOLS';
    ctx.scene.state.newSchools = [];

    const existingSchools = await getSchools(ctx.scene.state.selectedProvince, ctx.scene.state.selectedCity);
    let message = MESSAGES.ADMIN_SCHOOL_ADD_PROMPT_HEADER(ctx.scene.state.selectedProvince, ctx.scene.state.selectedCity);
    if (existingSchools && existingSchools.length > 0) {
        message += MESSAGES.ADMIN_SCHOOL_EXISTING_LIST_HEADER + existingSchools.join('\n- ') + "\n\n";
    } else {
        message += MESSAGES.ADMIN_SCHOOL_NO_EXISTING;
    }
    message += MESSAGES.ADMIN_SCHOOL_ADD_INSTRUCTIONS;

    try {
        await ctx.editMessageText(message, Markup.inlineKeyboard([
            Markup.button.callback('اتمام و ذخیره مدارس', 'ADMIN_FINISH_ADD_SCHOOLS'),
            Markup.button.callback('لغو و بازگشت', 'ADMIN_CANCEL_SCHOOL_MGMT')
        ]));
    } catch (e) { console.error("Error editing message in ADMIN_SELECT_CITY: ", e); }
});

manageSchoolsScene.on('text', async (ctx) => {
    if (ctx.scene.state.stage !== 'ADD_SCHOOLS') {
        return ctx.reply(MESSAGES.ADMIN_SCHOOL_FALLBACK_PROMPT_CHOOSE);
    }
    const schoolName = ctx.message.text.trim();
    if (schoolName.length < 3 || schoolName.length > 100) {
        return ctx.reply(MESSAGES.ADMIN_SCHOOL_NAME_INVALID);
    }
    if (ctx.scene.state.newSchools.includes(schoolName)) {
        return ctx.reply(MESSAGES.ADMIN_SCHOOL_ALREADY_IN_TEMP_LIST(schoolName));
    }
    ctx.scene.state.newSchools.push(schoolName);
    await ctx.reply(MESSAGES.ADMIN_SCHOOL_ADDED_TO_LIST(schoolName, ctx.scene.state.newSchools.join('، ')));
});

manageSchoolsScene.action('ADMIN_FINISH_ADD_SCHOOLS', async (ctx) => {
    if (ctx.scene.state.stage !== 'ADD_SCHOOLS') {
        await ctx.answerCbQuery(MESSAGES.ADMIN_INVALID_STAGE, { show_alert: true });
        return;
    }
    const { selectedProvince, selectedCity, newSchools } = ctx.scene.state;
    if (!selectedProvince || !selectedCity) {
        try { await ctx.editMessageText(MESSAGES.ADMIN_SCHOOL_ERROR_NO_PROVINCE_CITY); } catch(e) {}
        return ctx.scene.leave();
    }
    if (!newSchools || newSchools.length === 0) {
        try { await ctx.editMessageText(MESSAGES.ADMIN_SCHOOL_SAVE_NO_NEW); } catch(e) {}
        return ctx.scene.leave();
    }
    try {
        await addSchools(selectedProvince, selectedCity, newSchools);
        try {
            await ctx.editMessageText(MESSAGES.ADMIN_SCHOOL_SAVE_SUCCESS(newSchools.length, selectedCity, selectedProvince, newSchools.join('\n- ')));
        } catch(e){}
    } catch (error) {
        console.error(`Error saving schools for ${selectedCity}, ${selectedProvince}:`, error);
        try { await ctx.editMessageText(MESSAGES.ERROR_GENERAL); } catch(e) {}
    }
    return ctx.scene.leave();
});

manageSchoolsScene.action('ADMIN_CANCEL_SCHOOL_MGMT', async (ctx) => {
    try { await ctx.editMessageText(MESSAGES.ADMIN_SCHOOL_MGMT_CANCEL); } catch(e) {}
    return ctx.scene.leave();
});

manageSchoolsScene.on('message', (ctx) => {
    if (ctx.scene.state.stage === 'ADD_SCHOOLS') {
         ctx.reply(MESSAGES.ADMIN_SCHOOL_FALLBACK_PROMPT_ADD);
    } else {
         ctx.reply(MESSAGES.ADMIN_SCHOOL_FALLBACK_PROMPT_CHOOSE);
    }
});

manageSchoolsScene.command('cancel', async (ctx) => { // Allow /cancel to exit scene
    await ctx.reply(MESSAGES.ADMIN_COMMAND_CANCEL_SCENE);
    return ctx.scene.leave();
});

module.exports = manageSchoolsScene;
