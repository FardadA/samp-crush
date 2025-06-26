const { Scenes, Markup } = require('telegraf');
const { updateUser } = require('../config/firebase');
const MESSAGES = require('../constants/messages');

// Define provinces and cities (for now, hardcoded; can be moved to a config file or DB later)
const provinces = {
  'تهران': ['تهران', 'شهریار', 'اسلامشهر', 'قدس', 'ملارد', 'ورامین', 'پاکدشت', 'قرچک'],
  'البرز': ['کرج', 'فردیس', 'نظرآباد', 'هشتگرد', 'محمدشهر', 'کمال‌شهر', 'اشتهارد'],
};

const initialRegistrationScene = new Scenes.BaseScene('initialRegistrationScene');

initialRegistrationScene.enter(async (ctx) => {
  ctx.session.registrationData = {};
  await ctx.reply(MESSAGES.INITIAL_REGISTRATION_GUIDE,
    Markup.inlineKeyboard([
      Markup.button.callback('🚹 آقا', 'SELECT_GENDER_MALE'),
      Markup.button.callback('🚺 خانم', 'SELECT_GENDER_FEMALE'),
    ])
  );
});

// Gender selection
initialRegistrationScene.action('SELECT_GENDER_MALE', async (ctx) => {
  ctx.session.registrationData.gender = 'male';
  try {
    await ctx.editMessageText('جنسیت: آقا\n\nلطفا استان خود را انتخاب کنید:', Markup.inlineKeyboard(
        Object.keys(provinces).map(province => Markup.button.callback(province, `SELECT_PROVINCE_${province}`))
    , { columns: 2 }));
  } catch (e) { console.error("Error editing message in SELECT_GENDER_MALE:", e); }
});

initialRegistrationScene.action('SELECT_GENDER_FEMALE', async (ctx) => {
  ctx.session.registrationData.gender = 'female';
  try {
    await ctx.editMessageText('جنسیت: خانم\n\nلطفا استان خود را انتخاب کنید:', Markup.inlineKeyboard(
        Object.keys(provinces).map(province => Markup.button.callback(province, `SELECT_PROVINCE_${province}`))
    , { columns: 2 }));
  } catch (e) { console.error("Error editing message in SELECT_GENDER_FEMALE:", e); }
});

// Province selection
Object.keys(provinces).forEach(provinceName => {
  initialRegistrationScene.action(`SELECT_PROVINCE_${provinceName}`, async (ctx) => {
    ctx.session.registrationData.province = provinceName;
    const cities = provinces[provinceName].sort();
    try {
        await ctx.editMessageText(`استان: ${provinceName}\n\nلطفا شهر خود را انتخاب کنید:`, Markup.inlineKeyboard(
            cities.map(city => Markup.button.callback(city, `SELECT_CITY_${city.replace(/\s+/g, '_')}`)), // Ensure city name is valid for callback data
            { columns: 2 }
        ));
    } catch (e) { console.error("Error editing message in SELECT_PROVINCE:", e); }
  });
});

// City selection
initialRegistrationScene.action(/SELECT_CITY_(.+)/, async (ctx) => {
  const cityName = ctx.match[1].replace(/_/g, ' '); // Revert replacement for storage
  ctx.session.registrationData.city = cityName;

  const userId = ctx.from.id;
  const { gender, province, city } = ctx.session.registrationData;

  if (!userId || !gender || !province || !city) {
    await ctx.reply(MESSAGES.ERROR_GENERAL + ' (اطلاعات ناقص در ثبت اولیه)');
    return ctx.scene.leave();
  }

  try {
    await updateUser(userId, { gender, province, city });
    await ctx.editMessageText(MESSAGES.REGISTRATION_SUCCESS_PROFILE(gender, province, city));
    await ctx.reply(MESSAGES.REGISTRATION_SUCCESS_GUIDE_MAIN_MENU);
    // Main menu will be shown by the middleware or /start command after scene leaves
  } catch (error) {
    console.error("Error saving initial registration data to Firestore:", error);
    await ctx.reply(MESSAGES.ERROR_GENERAL);
  } finally {
    delete ctx.session.registrationData;
    return ctx.scene.leave();
  }
});

initialRegistrationScene.on('message', (ctx) => {
  if (ctx.message.text === '/start') {
    return ctx.scene.reenter();
  }
  ctx.reply(MESSAGES.CHOOSE_OPTION);
});

module.exports = initialRegistrationScene;
