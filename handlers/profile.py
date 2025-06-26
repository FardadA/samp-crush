# handlers/profile.py (نسخه کامل و بازنویسی شده برای Firestore)

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    CommandHandler,
)

# تمام توابع مورد نیاز از firebase_config در یک خط وارد می شوند
from firebase_config import get_user, update_user, get_schools
from .menu import main_menu_handler
from constants.states import AWAIT_NAME, AWAIT_AGE, SELECT_SCHOOL, AWAIT_PHONE

async def check_and_award_completion_bonus(user_id: int, context: ContextTypes.DEFAULT_TYPE):
    """
    بررسی می‌کند آیا پروفایل کامل شده و جایزه 50 سکه‌ای را می‌دهد.
    """
    user_data = get_user(user_id)
    # چک می‌کنیم تمام فیلدهای اصلی پر شده باشند و جایزه قبلا داده نشده باشد
    if user_data and all(k in user_data for k in ['name', 'age', 'school', 'phone']) and not user_data.get('profile_bonus_awarded'):
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
    # اگر از طریق query (دکمه شیشه ای) آمده باشد، آن را answer می‌کنیم تا حالت لودینگ برود
    if update.callback_query:
        await update.callback_query.answer()

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
        f"🔸 شماره تماس: {phone}\n\n"
        f"💰 **سکه‌ها: {coins}**"
    )

    # ساخت دکمه‌های شیشه‌ای برای اطلاعات ناقص
    buttons = []
    if name == 'ثبت نشده':
        buttons.append(InlineKeyboardButton("📝 ثبت نام", callback_data="complete_name"))
    if age == 'ثبت نشده':
        buttons.append(InlineKeyboardButton("🎂 ثبت سن", callback_data="complete_age"))
    if school == 'ثبت نشده':
        buttons.append(InlineKeyboardButton("🏫 انتخاب مدرسه", callback_data="complete_school"))
    if phone == 'ثبت نشده':
        buttons.append(InlineKeyboardButton("📱 ثبت شماره", callback_data="complete_phone"))
    
    # چیدن دکمه‌ها در ردیف‌های دوتایی برای زیبایی بیشتر
    keyboard_layout = [buttons[i:i + 2] for i in range(0, len(buttons), 2)]
    keyboard_layout.append([InlineKeyboardButton("🔙 بازگشت به منوی اصلی", callback_data="back_to_main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard_layout)
    
    # برای جلوگیری از خطا، همیشه از effective_message استفاده می‌کنیم
    if update.callback_query:
        await update.effective_message.edit_text(text, reply_markup=reply_markup, parse_mode='Markdown')
    else:
        await update.effective_message.reply_text(text, reply_markup=reply_markup, parse_mode='Markdown')


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
        'phone': ("برای تایید هویت و ثبت شماره، لطفاً از دکمه زیر استفاده کنید. (این شماره محرمانه باقی می‌ماند)", AWAIT_PHONE),
        'school': ("در حال دریافت لیست مدارس شهر شما...", SELECT_SCHOOL)
    }
    
    prompt_text, state = prompts[info_type]
    
    # ویرایش پیام قبلی به جای ارسال پیام جدید
    await query.edit_message_text(text=prompt_text)

    if info_type == 'phone':
        # اضافه کردن دکمه انصراف به کیبورد شماره تماس
        keyboard = ReplyKeyboardMarkup(
            [[KeyboardButton("ارسال شماره تماس 📞", request_contact=True)], [KeyboardButton("انصراف")]],
            resize_keyboard=True, one_time_keyboard=True
        )
        await query.message.reply_text("لطفاً از کیبورد زیر استفاده کنید:", reply_markup=keyboard)

    elif info_type == 'school':
        # --- بخش اصلاح شده برای Firestore ---
        user_data = get_user(update.effective_user.id)
        province = user_data.get('province')
        city = user_data.get('city')
        if not province or not city:
            await query.message.reply_text("ابتدا باید استان و شهر خود را در ثبت‌نام اولیه مشخص کنید!")
            await show_profile(update, context) # نمایش مجدد پروفایل
            return ConversationHandler.END
        
        # get_schools حالا یک لیست از نام‌ها برمی‌گرداند
        schools_list = get_schools(province, city)
        if not schools_list:
            await query.message.reply_text("متاسفانه هنوز مدرسه‌ای برای شهر شما تعریف نشده است. این مورد را به ادمین اطلاع دهید.")
            await show_profile(update, context) # نمایش مجدد پروفایل
            return ConversationHandler.END

        # ساخت کیبورد از روی لیست نام مدارس
        school_keyboard = [[InlineKeyboardButton(name, callback_data=f"school_{name}")] for name in schools_list]
        await query.message.reply_text("لطفاً مدرسه خود را از لیست زیر انتخاب کنید:", reply_markup=InlineKeyboardMarkup(school_keyboard))
    
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
        await update.message.reply_text("❌ لطفاً سن خود را به صورت یک عدد معتبر (بین ۱۱ تا ۲۴) وارد کنید. دوباره تلاش کنید:")
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

    # این شرط ضروری است تا کاربر نتواند شماره فرد دیگری را ارسال کند
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
    
    # به جای ساختن آپدیت فیک، مستقیما تابع نمایش پروفایل را با آپدیت اصلی فراخوانی می‌کنیم
    # و پیام قبلی را ویرایش می‌کنیم تا کاربر متوجه ثبت موفقیت آمیز شود
    await query.edit_message_text(f"✅ مدرسه شما با موفقیت '{school_name}' ثبت شد.")
    
    await check_and_award_completion_bonus(user_id, context)
    # نمایش مجدد پروفایل آپدیت شده
    await show_profile(update, context)
    return ConversationHandler.END

async def cancel_profile_update(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """لغو فرآیند آپدیت پروفایل با دستور یا دکمه انصراف."""
    # اگر از طریق دکمه انصراف آمده باشد، پیام متنی است
    if update.message:
        await update.message.reply_text("عملیات لغو شد.", reply_markup=ReplyKeyboardRemove())
    # اگر با دستور /cancel آمده باشد
    else:
        await update.effective_message.reply_text("عملیات لغو شد.", reply_markup=ReplyKeyboardRemove())

    await show_profile(update, context)
    return ConversationHandler.END

# ساخت ConversationHandler برای پروفایل
profile_conversation_handler = ConversationHandler(
    entry_points=[CallbackQueryHandler(prompt_for_info, pattern="^complete_")],
    states={
        AWAIT_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_name)],
        AWAIT_AGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_age)],
        # اضافه کردن فیلتر برای دکمه انصراف
        AWAIT_PHONE: [MessageHandler(filters.CONTACT, receive_phone), MessageHandler(filters.Regex('^انصراف$'), cancel_profile_update)],
        SELECT_SCHOOL: [CallbackQueryHandler(select_school, pattern="^school_")],
    },
    fallbacks=[CommandHandler('cancel', cancel_profile_update)],
    map_to_parent={
        ConversationHandler.END: ConversationHandler.END
    }
)