# main.py (نسخه آپدیت شده)

import logging
import os
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler

# بارگذاری متغیرهای محیطی از فایل .env
load_dotenv()

# ماژول‌های خودمان
import firebase_config
from handlers.start import start_command, check_join_again_callback
from handlers.registration import registration_conversation_handler
from handlers.menu import main_menu_handler, handle_main_menu_callbacks
from handlers.profile import profile_conversation_handler, show_profile
from handlers.admin import admin_command_handler

# کانفیگ لاگ‌ها
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

def main():
    # ساخت اپلیکیشن ربات
    application = ApplicationBuilder().token(os.getenv("TELEGRAM_BOT_TOKEN")).build()
    
    # --- ثبت Conversation Handler ها ---
    # این‌ها باید اول ثبت شوند تا اولویت داشته باشند
    application.add_handler(registration_conversation_handler)
    application.add_handler(profile_conversation_handler)
    # ... در آینده هندلر ادمین هم اینجا اضافه می‌شود ...

    # --- ثبت Command Handler ها ---
    application.add_handler(CommandHandler('start', start_command))
    application.add_handler(admin_command_handler)
    
    # --- ثبت Callback Query Handler ها ---
    # این‌ها الگوهای مشخصی را مدیریت می‌کنند
    application.add_handler(CallbackQueryHandler(check_join_again_callback, pattern="^check_join_again$"))
    
    # مدیریت دکمه‌های منوی اصلی و پروفایل
    # چون show_profile و main_menu_handler هردو با callback فعال می‌شوند، آنها را اینجا مدیریت می‌کنیم
    async def main_menu_or_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        command = query.data
        if command == 'main_profile':
            await show_profile(update, context)
        elif command == 'back_to_main_menu':
            await main_menu_handler(update, context)
        else:
            await handle_main_menu_callbacks(update, context)

    application.add_handler(CallbackQueryHandler(main_menu_or_profile_callback, pattern="^main_|^back_"))
    
    # اجرای ربات
    print("Bot is running with Profile and Admin handlers...")
    application.run_polling()


if __name__ == '__main__':
    main()