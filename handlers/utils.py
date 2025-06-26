# handlers/utils.py
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from firebase_config import get_channels_to_promote

async def check_channel_membership(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """
    بررسی می‌کند که آیا کاربر عضو تمام کانال‌های اجباری هست یا نه.
    اگر نبود، پیامی با لینک کانال‌هایی که عضو نیست ارسال می‌کند.
    """
    user_id = update.effective_user.id
    channels = get_channels_to_promote()

    if not channels:
        return True  # اگر کانالی برای تبلیغ تعریف نشده باشد، همه مجاز هستند

    not_joined_channels = []
    for channel_id, channel_info in channels.items():
        try:
            member = await context.bot.get_chat_member(chat_id=f"@{channel_id.replace('@', '')}" if not channel_id.startswith('-') else channel_id, user_id=user_id)
            if member.status not in ['member', 'administrator', 'creator']:
                not_joined_channels.append(channel_info)
        except Exception as e:
            print(f"Error checking channel {channel_id}: {e}")
            # اگر ربات در کانال ادمین نباشد یا کانال خصوصی باشد، این خطا رخ می‌دهد
            # فرض می‌کنیم کاربر عضو نیست
            not_joined_channels.append(channel_info)

    if not_joined_channels:
        keyboard = []
        text = "کاربر گرامی! برای استفاده از امکانات ربات، لطفاً در کانال‌های زیر عضو شوید:\n\n"
        for channel in not_joined_channels:
            keyboard.append([InlineKeyboardButton(channel['button_text'], url=channel['invite_link'])])
        
        keyboard.append([InlineKeyboardButton("✅ عضو شدم", callback_data="check_join_again")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.effective_message.reply_text(text, reply_markup=reply_markup)
        return False
        
    return True