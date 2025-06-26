# firebase_config.py
import firebase_admin
from firebase_admin import credentials, db
import os
from dotenv import load_dotenv

load_dotenv()

# مقداردهی اولیه Firebase Admin SDK
cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH"))
firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv("FIREBASE_DATABASE_URL")
})

# یک رفرنس به روت دیتابیس
ref = db.reference('/')

# توابع کمکی برای کار با دیتابیس
def get_user(user_id):
    """اطلاعات یک کاربر را از دیتابیس می‌خواند."""
    return ref.child('users').child(str(user_id)).get()

def update_user(user_id, data):
    """اطلاعات یک کاربر را در دیتابیس آپدیت یا ایجاد می‌کند."""
    ref.child('users').child(str(user_id)).update(data)

def get_admin_id():
    """آیدی ادمین را از دیتابیس می‌خواند."""
    admin_id = ref.child('config').child('admin_id').get()
    return admin_id

def set_admin_id(user_id):
    """اولین کاربر را به عنوان ادمین تنظیم می‌کند."""
    ref.child('config').child('admin_id').set(user_id)
    # همچنین در فایل .env نیز ذخیره می‌کنیم تا در اجرای بعدی سریع‌تر خوانده شود.
    with open('.env', 'a') as f:
        f.write(f"\nADMIN_USER_ID={user_id}")


def add_channel_to_promote(channel_id, channel_title, invite_link, button_text):
    """یک کانال برای تبلیغ اجباری اضافه می‌کند."""
    channel_data = {
        'title': channel_title,
        'invite_link': invite_link,
        'button_text': button_text
    }
    ref.child('channels').child(str(channel_id)).set(channel_data)

def get_channels_to_promote():
    """لیست تمام کانال‌های تبلیغی را برمی‌گرداند."""
    return ref.child('channels').get() or {}

# ... می‌توانید توابع بیشتری برای مدارس و ... اینجا اضافه کنید ...