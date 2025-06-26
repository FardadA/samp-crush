# handlers/start.py
import os
from telegram import Update
from telegram.ext import ContextTypes

from .utils import check_channel_membership
from firebase_config import get_user, update_user, get_admin_id, set_admin_id
from .menu import main_menu_handler
from .registration import start_registration

# وارد کردن استیت برای شروع گفتگو
from constants.states import SELECT_GENDER

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    پردازش دستور /start. این تابع نقش روتر اصلی را دارد.
    """
    user = update.effective_user
    user_id_str = str(user.id)
    
    # 1. بررسی و تنظیم ادمین
    admin_id = get_admin_id()
    if not admin_id:
        set_admin_id(user.id)
        admin_id = user.id
        await context.bot.send_message(user.id, "شما به عنوان اولین کاربر، ادمین ربات شدید.")
    
    # اگر کاربر ادمین است، نیازی به چک کردن کانال‌ها نیست
    is_admin = (user.id == admin_id)

    # 2. بررسی عضویت در کانال‌ها
    if not is_admin:
        is_member = await check_channel_membership(update, context)
        if not is_member:
            return # تابع چک خودش پیام لازم را ارسال کرده است

    # 3. بررسی ثبت‌نام اولیه (جنسیت، استان، شهر)
    db_user = get_user(user_id_str)
    
    # اگر کاربر جدید است یا ثبت‌نامش کامل نیست
    if not db_user or not all(k in db_user for k in ['gender', 'province', 'city']):
        # اگر کاربر جدید است، سکه‌های اولیه را به او می‌دهیم
        if not db_user:
            # بررسی لینک ریفرال
            if context.args and len(context.args) > 0:
                referrer_id = context.args[0]
                referrer_data = get_user(referrer_id)
                if referrer_data:
                    new_coins = referrer_data.get('coins', 0) + 10
                    update_user(referrer_id, {'coins': new_coins})
                    await context.bot.send_message(chat_id=referrer_id, text="یک نفر با لینک شما وارد ربات شد و شما 10 سکه دریافت کردید! 🎉")
            
            # دادن سکه اولیه به کاربر جدید
            update_user(user_id_str, {'coins': 20, 'username': user.username})
            
        return await start_registration(update, context)
        
    # 4. اگر همه چیز اوکی بود، نمایش منوی اصلی
    await main_menu_handler(update, context)


async def check_join_again_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    وقتی کاربر دکمه 'عضو شدم' را می‌زند، این تابع فراخوانی می‌شود.
    """
    query = update.callback_query
    await query.answer()
    
    # پیام قبلی را پاک می‌کنیم تا صفحه تمیز شود
    await query.delete_message()
    
    # دوباره فرآیند استارت را از اول اجرا می‌کنیم
    await start_command(update, context)