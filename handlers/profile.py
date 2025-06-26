# handlers/profile.py
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    CommandHandler,
)

from firebase_config import get_user, update_user # در ادامه توابع مدارس را هم اضافه می‌کنیم
from .menu import main_menu_handler
from constants.states import AWAIT_NAME, AWAIT_AGE, SELECT_SCHOOL, AWAIT_PHONE

# فرض می‌کنیم توابع زیر را به firebase_config.py اضافه کرده‌ایم
from firebase_config import get_schools # get_schools(province, city)

async def check_and_award_completion_bonus(user_id: int, context: ContextTypes.DEFAULT_TYPE):
    """
    بررسی می‌کند آیا پروفایل کامل شده و جایزه 50 سکه‌ای را می‌دهد.
    """
    user_data = get_user(user_id)
    # چک می‌کنیم تمام فیلدها پر شده باشند و جایزه قبلا داده نشده باشد
    if all(k in user_data for k in ['name', 'age', 'school', 'phone']) and not user_data.get('profile_bonus_awarded'):
        new_coins = user_data.get('coins', 0) + 50
        update_data = {
            'coins': new_coins,
            'profile_bonus_awarded': True
        }
        update_user(user_id, update_data)
        await context.bot.send_message(
            chat_id=user_id,
            text="🎉 تبریک! پروفایل شما تکمیل شد و **50 سکه** جایزه دریافت کردید!",
            parse_mode='Markdown'
        )

async def show_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    نمایش پروفایل کاربر و دکمه‌هایی برای تکمیل اطلاعات ناقص.
    """
    user_id = update.effective_user.id
    user_data = get_user(user_id)

    if not user_data:
        await update.effective_message.reply_text("خطایی رخ داد. لطفاً مجدداً /start را بزنید.")
        return

    # ساخت متن پروفایل
    name = user_data.get('name', 'ثبت نشده')
    age = user_data.get('age', 'ثبت نشده')
    school = user_data.get('school', 'ثبت نشده')
    phone = user_data.get('phone', 'ثبت نشده')
    gender = "آقا" if user_data.get('gender') == 'male' else "خانم"
    province = user_data.get('province', 'نامشخص')
    city = user_data.get('city', 'نامشخص')
    coins = user_data.get('coins', 0)

    text = (
        f"👤 **نمایه شما** 👤\n\n"
        f"🔸 نام: {name}\n"
        f"🔸 سن: {age}\n"
        f"🔸 جنسیت: {gender}\n"
        f"🔸 استان: {province}\n"
        f"🔸 شهر: {city}\n"
        f"🔸 مدرسه: {school}\n"
        f"🔸 شماره تماس: {phone}\n"
        f"💰 سکه‌ها: {coins}"
    )

    # ساخت دکمه‌های شیشه‌ای برای اطلاعات ناقص
    keyboard = []
    if name == 'ثبت نشده':
        keyboard.append([KeyboardButton("📝 ثبت نام", callback_data="complete_name")])
    if age == 'ثبت نشده':
        keyboard.append([KeyboardButton("🎂 ثبت سن", callback_data="complete_age")])
    if school == 'ثبت نشده':
        keyboard.append([KeyboardButton("🏫 انتخاب مدرسه", callback_data="complete_school")])
    if phone == 'ثبت نشده':
        keyboard.append([KeyboardButton("📱 ثبت شماره تماس", callback_data="complete_phone")])
    
    keyboard.append([KeyboardButton(" بازگشت به منوی اصلی", callback_data="back_to_main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    
    if update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=reply_markup, parse_mode='Markdown')
    else:
        await update.message.reply_text(text, reply_markup=reply_markup, parse_mode='Markdown')


async def prompt_for_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    ورودی ConversationHandler. از کاربر می‌خواهد اطلاعات مورد نیاز را وارد کند.
    """
    query = update.callback_query
    await query.answer()
    
    info_type = query.data.split('_')[1] # 'complete_name' -> 'name'
    context.user_data['info_type'] = info_type
    
    prompts = {
        'name': ("لطفاً نام کامل خود را وارد کنید:", AWAIT_NAME),
        'age': ("لطفاً سن خود را به عدد وارد کنید:", AWAIT_AGE),
        'phone': ("برای ثبت شماره، لطفاً از دکمه زیر استفاده کنید تا شماره شما به اشتراک گذاشته شود. (این شماره محرمانه باقی می‌ماند)", AWAIT_PHONE),
        'school': ("در حال دریافت لیست مدارس شهر شما...", SELECT_SCHOOL)
    }
    
    prompt_text, state = prompts[info_type]
    
    if info_type == 'phone':
        keyboard = ReplyKeyboardMarkup([[KeyboardButton("ارسال شماره تماس 📞", request_contact=True)]], resize_keyboard=True, one_time_keyboard=True)
        await query.message.reply_text(prompt_text, reply_markup=keyboard)
    elif info_type == 'school':
        # منطق نمایش مدارس
        user_data = get_user(update.effective_user.id)
        province = user_data.get('province')
        city = user_data.get('city')
        if not province or not city:
            await query.edit_message_text("ابتدا باید استان و شهر خود را در ثبت‌نام اولیه مشخص کنید!")
            return ConversationHandler.END
        
        schools = get_schools(province, city)
        if not schools:
            await query.edit_message_text("متاسفانه هنوز مدرسه‌ای برای شهر شما تعریف نشده است. این مورد را به ادمین اطلاع دهید.")
            return ConversationHandler.END

        school_keyboard = [[InlineKeyboardButton(name, callback_data=f"school_{name}")] for name in schools.keys()]
        await query.edit_message_text("لطفاً مدرسه خود را از لیست زیر انتخاب کنید:", reply_markup=InlineKeyboardMarkup(school_keyboard))
    else:
        await query.edit_message_text(prompt_text)

    return state


async def receive_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره نام کاربر."""
    user_id = update.effective_user.id
    name = update.message.text
    update_user(user_id, {'name': name})
    await update.message.reply_text(f"✅ نام شما با موفقیت به '{name}' تغییر یافت.")
    await check_and_award_completion_bonus(user_id, context)
    await show_profile(update, context) # نمایش مجدد پروفایل آپدیت شده
    return ConversationHandler.END

async def receive_age(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره سن کاربر با اعتبارسنجی."""
    user_id = update.effective_user.id
    age = update.message.text
    if not age.isdigit() or not 10 < int(age) < 25:
        await update.message.reply_text("❌ لطفاً سن خود را به صورت یک عدد معتبر (بین ۱۱ تا ۲۴) وارد کنید.")
        return AWAIT_AGE # در همین وضعیت باقی می‌ماند تا ورودی صحیح دریافت شود
    
    update_user(user_id, {'age': int(age)})
    await update.message.reply_text(f"✅ سن شما با موفقیت '{age}' ثبت شد.")
    await check_and_award_completion_bonus(user_id, context)
    await show_profile(update, context)
    return ConversationHandler.END

async def receive_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره شماره تماس کاربر پس از تایید."""
    contact = update.message.contact
    user_id = update.effective_user.id

    if contact.user_id != user_id:
        await update.message.reply_text("❌ لطفاً فقط شماره تماس خودتان را به اشتراک بگذارید!", reply_markup=ReplyKeyboardRemove())
        await show_profile(update, context)
        return ConversationHandler.END
    
    update_user(user_id, {'phone': contact.phone_number})
    await update.message.reply_text("✅ شماره شما با موفقیت ثبت شد.", reply_markup=ReplyKeyboardRemove())
    await check_and_award_completion_bonus(user_id, context)
    await show_profile(update, context)
    return ConversationHandler.END

async def select_school(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره مدرسه انتخاب شده."""
    query = update.callback_query
    await query.answer()
    user_id = update.effective_user.id
    school_name = query.data.split('_', 1)[1]
    
    update_user(user_id, {'school': school_name})
    await query.edit_message_text(f"✅ مدرسه شما با موفقیت '{school_name}' ثبت شد.")
    await check_and_award_completion_bonus(user_id, context)
    # برای نمایش مجدد پروفایل، باید یک آپدیت جدید بسازیم چون query دیگر پیام ندارد
    fake_update = Update(update.update_id, message=query.message)
    await show_profile(fake_update, context)
    return ConversationHandler.END

async def cancel_profile_update(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """لغو فرآیند آپدیت پروفایل."""
    await update.message.reply_text("عملیات لغو شد.", reply_markup=ReplyKeyboardRemove())
    await show_profile(update, context)
    return ConversationHandler.END

# ساخت ConversationHandler برای پروفایل
profile_conversation_handler = ConversationHandler(
    entry_points=[CallbackQueryHandler(prompt_for_info, pattern="^complete_")],
    states={
        AWAIT_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_name)],
        AWAIT_AGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_age)],
        AWAIT_PHONE: [MessageHandler(filters.CONTACT, receive_phone)],
        SELECT_SCHOOL: [CallbackQueryHandler(select_school, pattern="^school_")],
    },
    fallbacks=[CommandHandler('cancel', cancel_profile_update)],
    map_to_parent={
         # بعد از اتمام، کنترل به هندلرهای اصلی برمی‌گردد
        ConversationHandler.END: ConversationHandler.END
    }
)