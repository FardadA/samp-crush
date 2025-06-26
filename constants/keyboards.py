# constants/keyboards.py
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from .provinces import PROVINCES_DATA

# --- کیبوردهای ثبت‌نام ---
GENDER_KEYBOARD = InlineKeyboardMarkup([
    [InlineKeyboardButton("🚹 آقا", callback_data="gender_male"), InlineKeyboardButton("🚺 خانم", callback_data="gender_female")]
])

def get_provinces_keyboard():
    keyboard = [
        [InlineKeyboardButton(province, callback_data=f"prov_{province}")] for province in PROVINCES_DATA.keys()
    ]
    return InlineKeyboardMarkup(keyboard)

def get_cities_keyboard(province: str):
    cities = PROVINCES_DATA.get(province, [])
    # مرتب‌سازی شهرها بر اساس حروف الفبا
    cities.sort()
    keyboard = [
        [InlineKeyboardButton(city, callback_data=f"city_{city}")] for city in cities
    ]
    return InlineKeyboardMarkup(keyboard)


# --- کیبورد منوی اصلی ---
MAIN_MENU_KEYBOARD = InlineKeyboardMarkup([
    [InlineKeyboardButton("👤 نمایه من", callback_data="main_profile"), InlineKeyboardButton("💰 سکه‌های من", callback_data="main_coins")],
    [InlineKeyboardButton("💬 چت با ناشناس", callback_data="main_anonymous_chat")],
    [InlineKeyboardButton("✍️ ثبت نظر", callback_data="main_submit_opinion"), InlineKeyboardButton("👀 نظرات اطراف", callback_data="main_nearby_opinions")]
])