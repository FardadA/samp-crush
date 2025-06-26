# handlers/menu.py
from telegram import Update
from telegram.ext import ContextTypes
from constants.keyboards import MAIN_MENU_KEYBOARD
from firebase_config import get_user
import os

async def main_menu_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """تابع اصلی برای نمایش منوی اصلی به کاربر."""
    # پیام قبلی را ویرایش می‌کند یا یک پیام جدید ارسال می‌کند
    text = "به ربات ما خوش آمدید! لطفاً از منوی زیر یک گزینه را انتخاب کنید:"
    if update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=MAIN_MENU_KEYBOARD)
    else:
        await update.effective_message.reply_text(text, reply_markup=MAIN_MENU_KEYBOARD)

async def handle_main_menu_callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """مدیریت دکمه‌های فشرده شده در منوی اصلی."""
    query = update.callback_query
    await query.answer()
    
    command = query.data # مثلا 'main_profile'

    if command == "main_profile":
        # اینجا باید تابع نمایش پروفایل از profile.py فراخوانی شود
        await query.message.reply_text("در حال بارگذاری پروفایل شما...")
    elif command == "main_coins":
        user_id = update.effective_user.id
        user_data = get_user(user_id)
        coins = user_data.get('coins', 0)
        bot_username = (await context.bot.get_me()).username
        referral_link = f"https://t.me/{bot_username}?start={user_id}"
        
        text = (
            f"💰 موجودی سکه‌های شما: **{coins}** سکه\n\n"
            f"با دعوت هر دوست از طریق لینک زیر، **10 سکه** دریافت کنید:\n\n"
            f"`{referral_link}`"
        )
        await query.edit_message_text(text, parse_mode='Markdown')

    elif command in ["main_anonymous_chat", "main_submit_opinion", "main_nearby_opinions"]:
        await query.edit_message_text("این بخش به زودی فعال خواهد شد. منتظر آپدیت‌های ما باشید! 😉", reply_markup=MAIN_MENU_KEYBOARD)