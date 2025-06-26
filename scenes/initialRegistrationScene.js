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
    await ctx.reply(MESSAGES.REGISTRATION_SUCCESS_GUIDE_MAIN_MENU.split('\n')[0] + '\n\n' + 'لطفا برای ورود به منوی اصلی، دستور /start را دوباره ارسال کنید.');
    // Explicitly call showMainMenu after successful registration
    // To do this, showMainMenu needs to be accessible here or ctx needs to be passed back to index.js to call it
    // For simplicity, we'll emit an event or rely on the next interaction, but for better UX, direct call is better.
    // Let's assume showMainMenu is imported or passed via ctx.
    // This requires showMainMenu to be exported from index.js and imported here, or a more complex setup.
    // A simpler immediate fix is to have the calling middleware in index.js handle this.
    // For now, we will rely on the /start command's logic or the middleware to show the menu.
    // The user might type /menu or any other command which will then trigger the main menu.
    // OR, we can pass a flag in session that /start command or middleware can check.
    ctx.session.justRegistered = true;
  } catch (error) {
    console.error("Error saving initial registration data to Firestore:", error);
    await ctx.reply(MESSAGES.ERROR_GENERAL);
  } finally {
    delete ctx.session.registrationData;
    // Instead of just leaving, we try to trigger main menu if possible, or /start handles it.
    await ctx.scene.leave();
    // The /start or middleware should now pick up and show main menu.
  }
});

initialRegistrationScene.on('message', (ctx) => {
  if (ctx.message.text === '/start') {
    return ctx.scene.reenter();
  }
  ctx.reply(MESSAGES.CHOOSE_OPTION);
});

module.exports = initialRegistrationScene;
