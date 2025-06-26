# main.py (نسخه کامل و اصلاح شده نهایی)

import logging
import os
from dotenv import load_dotenv

# --- وارد کردن کلاس‌های مورد نیاز از کتابخانه ---
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    MessageHandler,
    filters
)

# بارگذاری متغیرهای محیطی از فایل .env
load_dotenv()

# ماژول‌های خودمان
import firebase_config

from handlers.start import start_command, check_join_again_callback
from handlers.registration import registration_conversation_handler
from handlers.menu import main_menu_handler, handle_main_menu_callbacks
from handlers.profile import profile_conversation_handler, show_profile
# اینجا به جای تابع، خود هندلر را وارد می‌کنیم
from handlers.admin import admin_command_handler

# کانفیگ لاگ‌ها برای خطایابی بهتر
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

async def main_menu_or_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    یک تابع کمکی برای مدیریت تمام دکمه‌های منوی اصلی و پروفایل.
    """
    query = update.callback_query
    command = query.data

    if command == 'main_profile':
        await show_profile(update, context)
    elif command == 'back_to_main_menu':
        await main_menu_handler(update, context)
    elif command.startswith('main_'):
        await handle_main_menu_callbacks(update, context)


def main():
    """تابع اصلی برای ساخت و اجرای ربات."""
    application = ApplicationBuilder().token(os.getenv("TELEGRAM_BOT_TOKEN")).build()

    # --- ثبت Conversation Handler ها ---
    application.add_handler(registration_conversation_handler)
    application.add_handler(profile_conversation_handler)

    # --- ثبت Command Handler ها ---
    application.add_handler(CommandHandler('start', start_command))

    # --- خطای شما اینجا بود ---
    # به جای ساختن یک هندلر جدید، از هندلر وارد شده استفاده می‌کنیم
    application.add_handler(admin_command_handler) # <--- این خط اصلاح شد

    application.add_handler(CommandHandler('menu', main_menu_handler))
    application.add_handler(CommandHandler('profile', show_profile))

    # --- ثبت Callback Query Handler ها ---
    application.add_handler(CallbackQueryHandler(check_join_again_callback, pattern="^check_join_again$"))
    application.add_handler(CallbackQueryHandler(main_menu_or_profile_callback, pattern="^main_|^back_"))

    # --- ثبت Message Handler ها ---
    async def unknown_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text("متوجه دستوری که وارد کردید نشدم. لطفاً از منوی اصلی استفاده کنید یا /start را بزنید.")

    application.add_handler(MessageHandler(filters.COMMAND, unknown_command))

    print("Bot is running with all handlers correctly configured...")
    application.run_polling()


if __name__ == '__main__':
    main()