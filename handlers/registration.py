# handlers/registration.py
from telegram import Update, ReplyKeyboardRemove
from telegram.ext import (
    ConversationHandler,
    CallbackQueryHandler,
    ContextTypes,
    CommandHandler
)

from constants.states import SELECT_GENDER, SELECT_PROVINCE, SELECT_CITY
from constants.keyboards import GENDER_KEYBOARD, get_provinces_keyboard, get_cities_keyboard
from firebase_config import update_user
from .menu import main_menu_handler # منوی اصلی را بعد از ثبت‌نام نمایش می‌دهیم

async def start_registration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """شروع فرآیند ثبت‌نام با درخواست جنسیت."""
    user = update.effective_user
    context.user_data['user_id'] = user.id
    
    await update.effective_message.reply_text(
        "لطفاً جنسیت خود را انتخاب کنید:",
        reply_markup=GENDER_KEYBOARD
    )
    return SELECT_GENDER

async def select_gender(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره جنسیت و درخواست استان."""
    query = update.callback_query
    await query.answer()
    
    gender = query.data.split('_')[1] # 'gender_male' -> 'male'
    context.user_data['gender'] = gender
    
    await query.edit_message_text(
        text="بسیار خب! حالا لطفاً استان محل سکونت خود را انتخاب کنید:",
        reply_markup=get_provinces_keyboard()
    )
    return SELECT_PROVINCE

async def select_province(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره استان و درخواست شهر."""
    query = update.callback_query
    await query.answer()
    
    province = query.data.split('_')[1] # 'prov_تهران' -> 'تهران'
    context.user_data['province'] = province
    
    await query.edit_message_text(
        text=f"استان شما: {province}\n\nحالا شهر خود را انتخاب کنید:",
        reply_markup=get_cities_keyboard(province)
    )
    return SELECT_CITY

async def select_city(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """ذخیره شهر، اتمام ثبت‌نام و نمایش منوی اصلی."""
    query = update.callback_query
    await query.answer()
    
    city = query.data.split('_')[1] # 'city_کرج' -> 'کرج'
    context.user_data['city'] = city
    
    # ذخیره تمام اطلاعات در دیتابیس
    user_id = context.user_data['user_id']
    registration_data = {
        'gender': context.user_data['gender'],
        'province': context.user_data['province'],
        'city': context.user_data['city'],
    }
    update_user(user_id, registration_data)
    
    await query.edit_message_text(
        text="✅ ثبت‌نام شما با موفقیت تکمیل شد! به جمع ما خوش آمدید."
    )
    
    # نمایش منوی اصلی
    await main_menu_handler(update, context)

    return ConversationHandler.END

async def cancel_registration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """لغو فرآیند ثبت‌نام."""
    await update.message.reply_text(
        "ثبت‌نام لغو شد. هر زمان مایل بودید می‌توانید با دستور /start مجدداً تلاش کنید.",
        reply_markup=ReplyKeyboardRemove()
    )
    return ConversationHandler.END

# ساخت ConversationHandler برای ثبت‌نام
registration_conversation_handler = ConversationHandler(
    entry_points=[], # ما این گفتگو را به صورت دستی از start.py شروع می‌کنیم
    states={
        SELECT_GENDER: [CallbackQueryHandler(select_gender, pattern="^gender_")],
        SELECT_PROVINCE: [CallbackQueryHandler(select_province, pattern="^prov_")],
        SELECT_CITY: [CallbackQueryHandler(select_city, pattern="^city_")]
    },
    fallbacks=[CommandHandler('cancel', cancel_registration)],
    # اجازه می‌دهیم گفتگو از خارج هم فعال شود
    map_to_parent={
        ConversationHandler.END: ConversationHandler.END
    }
)