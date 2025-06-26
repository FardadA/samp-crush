// General Messages
const WELCOME_NEW_USER = (coins) => `سلام! به ربات اجتماعی دانش‌آموزی خوش آمدید. ${coins} سکه اولیه به شما تعلق گرفت.`;
const WELCOME_BACK = 'به منوی اصلی خوش آمدید! چه کاری می‌خواهید انجام دهید؟';
const ERROR_GENERAL = 'متاسفانه مشکلی پیش آمده. لطفا دوباره تلاش کنید.';
const ERROR_FIREBASE_CONNECTION = 'متاسفانه ربات در حال حاضر به پایگاه داده متصل نیست. لطفا بعدا تلاش کنید.';
const INFO_SECTION_SOON = 'این بخش به زودی فعال می‌شود... صبور باشید!';
const CHOOSE_OPTION = 'لطفا یکی از گزینه‌های موجود را انتخاب کنید.';
const ACCESS_DENIED_ADMIN = 'شما دسترسی ادمین ندارید.';

// Onboarding
const COMPLETE_INITIAL_REGISTRATION = 'برای ادامه، لطفاً اطلاعات اولیه خود را تکمیل کنید.';
const INITIAL_REGISTRATION_GUIDE = 'به نظر می‌رسد اولین بار است که وارد می‌شوید یا اطلاعات شما ناقص است. لطفاً اطلاعات اولیه خود را تکمیل کنید.\n\nابتدا جنسیت خود را انتخاب کنید:';
const FORCED_JOIN_PROMPT = 'برای استفاده از ربات، ابتدا باید در کانال‌های زیر عضو شوید:';
const FORCED_JOIN_REFRESHING = 'در حال بررسی وضعیت عضویت...';
const FORCED_JOIN_STILL_UNJOINED = 'هنوز در تمام کانال‌ها عضو نشده‌اید. لطفا بررسی کنید:';
const FORCED_JOIN_SUCCESS_COMPLETE_INFO = 'عضویت شما تایید شد. حالا لطفا اطلاعات اولیه خود را تکمیل کنید.';
const FORCED_JOIN_SUCCESS_ALL_DONE = (ctx) => `عضویت شما تایید شد و اطلاعات اولیه‌تان کامل است. ${WELCOME_BACK}`; // Using WELCOME_BACK or custom
const FORCED_JOIN_SUCCESS_REGISTER_START = 'عضویت شما تایید شد. لطفا با ارسال /start ثبت نام خود را در ربات تکمیل کنید.';
const REGISTRATION_SUCCESS_PROFILE = (gender, province, city) => `اطلاعات شما با موفقیت ثبت شد:\nجنسیت: ${gender === 'male' ? 'آقا' : 'خانم'}\nاستان: ${province}\nشهر: ${city}`;
const REGISTRATION_SUCCESS_GUIDE_MAIN_MENU = 'ثبت‌نام اولیه شما تکمیل شد. اکنون به منوی اصلی هدایت می‌شوید.';

// Profile & Coins
const PROFILE_TITLE = '👤 **نمایه شما** 👤\n\n';
const PROFILE_FIELD_UNSET = 'ثبت نشده';
const PROFILE_NAME_PROMPT = 'لطفا نام خود را وارد کنید:';
const PROFILE_NAME_INVALID = 'نام وارد شده معتبر نیست. لطفا نامی بین ۲ تا ۵۰ کاراکتر وارد کنید.';
const PROFILE_NAME_SUCCESS = (name) => `نام شما "${name}" با موفقیت ثبت شد.`;
const PROFILE_AGE_PROMPT = 'لطفا سن خود را به عدد وارد کنید (مثلا: ۱۷):';
const PROFILE_AGE_INVALID = 'سن وارد شده معتبر نیست. لطفا سن خود را به صورت یک عدد بین ۱۰ تا ۳۰ وارد کنید.';
const PROFILE_AGE_SUCCESS = (age) => `سن شما "${age}" با موفقیت ثبت شد.`;
const PROFILE_SCHOOL_PROMPT = 'لطفا مدرسه خود را از لیست زیر انتخاب کنید:';
const PROFILE_SCHOOL_NO_SCHOOLS_FOR_CITY = (city, province) => `متاسفانه در حال حاضر مدرسه‌ای برای شهر ${city} در استان ${province} ثبت نشده است. این مورد به ادمین اطلاع داده خواهد شد.`;
const PROFILE_SCHOOL_NOT_FOUND = 'مدرسه‌ای برای انتخاب یافت نشد.';
const PROFILE_SCHOOL_SUCCESS = (school) => `مدرسه شما "${school}" با موفقیت ثبت شد.`;
const PROFILE_PHONE_PROMPT = 'لطفا شماره تماس خود را با استفاده از دکمه زیر به اشتراک بگذارید:';
const PROFILE_PHONE_NOT_OWN = 'لطفا فقط شماره تماس خودتان را به اشتراک بگذارید.';
const PROFILE_PHONE_SUCCESS = (phone) => `شماره تماس شما (${phone}) با موفقیت ثبت شد.`;
const PROFILE_COMPLETE_AWARD = (coins) => `🎉 پروفایل شما تکمیل شد! ${coins} سکه جایزه به شما تعلق گرفت.`;
const PROFILE_USER_INFO_NOT_FOUND = 'اطلاعات کاربری شما یافت نشد. لطفا با /start مجددا شروع کنید.';
const COINS_YOUR_BALANCE = (coins) => `💰 **سکه‌های شما**: ${coins}`;
const COINS_REFERRAL_LINK = (link) => `🔗 **لینک دعوت اختصاصی شما**:\n\`${link}\`\n\nبا دعوت از دوستان خود می‌توانید سکه بیشتری کسب کنید!`;
const INVITER_AWARD_NOTIFICATION = (inviterName, coins) => `کاربر ${inviterName || 'جدید'} با لینک دعوت شما وارد ربات شد و ${coins} سکه به شما اضافه گردید.`;

// Admin Panel
const ADMIN_WELCOME = '👑 **پنل ادمین** 👑\n\nاز گزینه‌های زیر برای مدیریت ربات استفاده کنید:';
const ADMIN_CHANNEL_MGMT_INSTRUCTIONS = (currentChannelsText) => "**مدیریت کانال‌های تبلیغی (عضویت اجباری)**\n\n" +
    "برای افزودن یک کانال جدید:\n" +
    "1. ربات را در کانال مورد نظر خود عضو کرده و به آن دسترسی ادمینی (حداقل خواندن پیام‌ها و اطلاعات کانال) بدهید.\n" +
    "2. سپس دستور `/promote_channel` را در آن کانال ارسال کنید.\n" +
    "3. ربات شما را به مراحل بعدی هدایت خواهد کرد.\n\n" +
    "لیست کانال‌های فعلی:\n" +
    (currentChannelsText || "هنوز کانالی ثبت نشده است.");
const ADMIN_PROMOTE_CHANNEL_IN_CHANNEL_ONLY = 'این دستور باید در کانالی که می‌خواهید تبلیغ کنید ارسال شود، نه در چت خصوصی با ربات.';
const ADMIN_PROMOTE_CHANNEL_INFO = (title, id) => `شما دستور /promote_channel را در کانال "${title}" (ID: ${id}) ارسال کردید.`;
const ADMIN_PROMOTE_CHANNEL_NO_LINK = (title, id) => `ربات نتوانست لینک دعوتی برای کانال "${title}" (ID: ${id}) ایجاد کند. ممکن است نیاز باشد لینک را دستی وارد کنید یا دسترسی ربات را بررسی نمایید.`;
const ADMIN_CHANNEL_BUTTON_TEXT_PROMPT = (title, id, link) => `کانال "${title || id}" شناسایی شد. \nلینک: ${link}\n\nلطفا متنی که می‌خواهید روی دکمه شیشه‌ای این کانال (برای عضویت اجباری) نمایش داده شود را وارد کنید:`;
const ADMIN_CHANNEL_BUTTON_TEXT_INVALID = 'متن دکمه باید بین ۱ تا ۳۰ کاراکتر باشد. لطفا دوباره تلاش کنید:';
const ADMIN_CHANNEL_CONFIRM_ADD = (title, id, link, text) => `کانال: ${title || id}\nلینک: ${link}\nمتن دکمه: ${text}\n\nآیا این اطلاعات صحیح است و کانال به لیست عضویت اجباری اضافه شود؟`;
const ADMIN_CHANNEL_ADD_SUCCESS = (title, id) => `کانال "${title || id}" با موفقیت به لیست کانال‌های عضویت اجباری اضافه شد.`;
const ADMIN_CHANNEL_ADD_CANCEL = 'عملیات افزودن کانال لغو شد.';
const ADMIN_CHANNEL_ERROR_INFO_MISSING = 'خطا: اطلاعات کانال به درستی دریافت نشد. لطفا دوباره تلاش کنید.';
const ADMIN_SCHOOL_MGMT_TITLE = ' مدیریت مدارس | ';
const ADMIN_SCHOOL_PROVINCE_PROMPT = 'مرحله ۱: انتخاب استان \n\nلطفا استانی که می‌خواهید برای آن مدرسه اضافه کنید را انتخاب نمایید:';
const ADMIN_SCHOOL_CITY_PROMPT = (province) => `استان انتخاب شده: ${province}\n\n مدیریت مدارس | مرحله ۲: انتخاب شهر \n\nلطفا شهر مورد نظر را انتخاب کنید:`;
const ADMIN_SCHOOL_ADD_PROMPT_HEADER = (province, city) => `استان: ${province}\nشهر: ${city}\n\nمدیریت مدارس | مرحله ۳: افزودن نام مدارس\n\n`;
const ADMIN_SCHOOL_EXISTING_LIST_HEADER = "مدارس موجود:\n- ";
const ADMIN_SCHOOL_NO_EXISTING = "در حال حاضر مدرسه‌ای برای این شهر ثبت نشده است.\n\n";
const ADMIN_SCHOOL_ADD_INSTRUCTIONS = "لطفا نام هر مدرسه را در یک پیام جداگانه ارسال کنید. پس از اتمام، روی دکمه 'اتمام و ذخیره' کلیک کنید.";
const ADMIN_SCHOOL_NAME_INVALID = 'نام مدرسه باید بین ۳ تا ۱۰۰ کاراکتر باشد. لطفا دوباره تلاش کنید.';
const ADMIN_SCHOOL_ALREADY_IN_TEMP_LIST = (name) => `مدرسه "${name}" قبلا در لیست موقت شما برای افزودن در این نوبت، اضافه شده است.`;
const ADMIN_SCHOOL_ADDED_TO_LIST = (name, currentList) => `مدرسه "${name}" به لیست افزوده شد. \nمدارس جدید در صف: ${currentList}\n\nبرای افزودن مدرسه بعدی، نام آن را ارسال کنید یا برای پایان، دکمه "اتمام و ذخیره" را بزنید.`;
const ADMIN_SCHOOL_SAVE_SUCCESS = (count, city, province, newList) => `تعداد ${count} مدرسه جدید با موفقیت برای شهر ${city} در استان ${province} ذخیره/به‌روزرسانی شد: \n- ${newList}`;
const ADMIN_SCHOOL_SAVE_NO_NEW = 'هیچ مدرسه‌ی جدیدی برای افزودن وارد نشده است. عملیات بدون تغییر پایان یافت.';
const ADMIN_SCHOOL_ERROR_NO_PROVINCE_CITY = 'خطا: استان یا شهر انتخاب نشده است. عملیات لغو شد.';
const ADMIN_SCHOOL_MGMT_CANCEL = "عملیات مدیریت مدارس لغو شد.";
const ADMIN_INVALID_STAGE = "مرحله نامعتبر است.";
const ADMIN_SCHOOL_FALLBACK_PROMPT_ADD = 'لطفا نام مدرسه را ارسال کنید یا روی دکمه "اتمام و ذخیره" یا "لغو" کلیک کنید.';
const ADMIN_SCHOOL_FALLBACK_PROMPT_CHOOSE = 'لطفا یکی از گزینه‌های موجود را با کلیک روی دکمه‌ها انتخاب کنید یا عملیات را با /cancel لغو کنید.';
const ADMIN_COMMAND_CANCEL_SCENE = 'عملیات لغو شد.';


module.exports = {
    WELCOME_NEW_USER,
    WELCOME_BACK,
    ERROR_GENERAL,
    ERROR_FIREBASE_CONNECTION,
    INFO_SECTION_SOON,
    CHOOSE_OPTION,
    ACCESS_DENIED_ADMIN,
    COMPLETE_INITIAL_REGISTRATION,
    INITIAL_REGISTRATION_GUIDE,
    FORCED_JOIN_PROMPT,
    FORCED_JOIN_REFRESHING,
    FORCED_JOIN_STILL_UNJOINED,
    FORCED_JOIN_SUCCESS_COMPLETE_INFO,
    FORCED_JOIN_SUCCESS_ALL_DONE,
    FORCED_JOIN_SUCCESS_REGISTER_START,
    REGISTRATION_SUCCESS_PROFILE,
    REGISTRATION_SUCCESS_GUIDE_MAIN_MENU,
    PROFILE_TITLE,
    PROFILE_FIELD_UNSET,
    PROFILE_NAME_PROMPT,
    PROFILE_NAME_INVALID,
    PROFILE_NAME_SUCCESS,
    PROFILE_AGE_PROMPT,
    PROFILE_AGE_INVALID,
    PROFILE_AGE_SUCCESS,
    PROFILE_SCHOOL_PROMPT,
    PROFILE_SCHOOL_NO_SCHOOLS_FOR_CITY,
    PROFILE_SCHOOL_NOT_FOUND,
    PROFILE_SCHOOL_SUCCESS,
    PROFILE_PHONE_PROMPT,
    PROFILE_PHONE_NOT_OWN,
    PROFILE_PHONE_SUCCESS,
    PROFILE_COMPLETE_AWARD,
    PROFILE_USER_INFO_NOT_FOUND,
    COINS_YOUR_BALANCE,
    COINS_REFERRAL_LINK,
    INVITER_AWARD_NOTIFICATION,
    ADMIN_WELCOME,
    ADMIN_CHANNEL_MGMT_INSTRUCTIONS,
    ADMIN_PROMOTE_CHANNEL_IN_CHANNEL_ONLY,
    ADMIN_PROMOTE_CHANNEL_INFO,
    ADMIN_PROMOTE_CHANNEL_NO_LINK,
    ADMIN_CHANNEL_BUTTON_TEXT_PROMPT,
    ADMIN_CHANNEL_BUTTON_TEXT_INVALID,
    ADMIN_CHANNEL_CONFIRM_ADD,
    ADMIN_CHANNEL_ADD_SUCCESS,
    ADMIN_CHANNEL_ADD_CANCEL,
    ADMIN_CHANNEL_ERROR_INFO_MISSING,
    ADMIN_SCHOOL_MGMT_TITLE,
    ADMIN_SCHOOL_PROVINCE_PROMPT,
    ADMIN_SCHOOL_CITY_PROMPT,
    ADMIN_SCHOOL_ADD_PROMPT_HEADER,
    ADMIN_SCHOOL_EXISTING_LIST_HEADER,
    ADMIN_SCHOOL_NO_EXISTING,
    ADMIN_SCHOOL_ADD_INSTRUCTIONS,
    ADMIN_SCHOOL_NAME_INVALID,
    ADMIN_SCHOOL_ALREADY_IN_TEMP_LIST,
    ADMIN_SCHOOL_ADDED_TO_LIST,
    ADMIN_SCHOOL_SAVE_SUCCESS,
    ADMIN_SCHOOL_SAVE_NO_NEW,
    ADMIN_SCHOOL_ERROR_NO_PROVINCE_CITY,
    ADMIN_SCHOOL_MGMT_CANCEL,
    ADMIN_INVALID_STAGE,
    ADMIN_SCHOOL_FALLBACK_PROMPT_ADD,
    ADMIN_SCHOOL_FALLBACK_PROMPT_CHOOSE,
    ADMIN_COMMAND_CANCEL_SCENE,
};
