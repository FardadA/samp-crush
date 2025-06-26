# firebase_config.py (نسخه جدید با Firestore)

import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

# --- مقداردهی اولیه ---
# یک شرط برای جلوگیری از مقداردهی مجدد
if not firebase_admin._apps:
    cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH"))
    firebase_admin.initialize_app(cred)

# ساخت یک کلاینت برای ارتباط با Firestore
db = firestore.client()

# --- توابع کاربر ---
def get_user(user_id):
    """اطلاعات یک کاربر را از Firestore می‌خواند."""
    doc_ref = db.collection('users').document(str(user_id))
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None

def update_user(user_id, data):
    """اطلاعات یک کاربر را در Firestore آپدیت یا ایجاد می‌کند."""
    # با merge=True، اطلاعات جدید با اطلاعات قبلی ادغام می‌شود و چیزی پاک نمی‌شود
    db.collection('users').document(str(user_id)).set(data, merge=True)

# --- توابع ادمین و کانفیگ ---
def get_admin_id():
    """آیدی ادمین را از Firestore می‌خواند."""
    doc_ref = db.collection('config').document('admin')
    doc = doc_ref.get()
    if doc.exists:
        # مطمئن می‌شویم که مقدار عددی برمی‌گردد
        return int(doc.to_dict().get('user_id'))
    return None

def set_admin_id(user_id):
    """اولین کاربر را به عنوان ادمین تنظیم می‌کند."""
    db.collection('config').document('admin').set({'user_id': user_id})

# --- توابع کانال‌های تبلیغی ---
def add_channel_to_promote(channel_id, channel_title, invite_link, button_text):
    """یک کانال برای تبلیغ اجباری در Firestore اضافه می‌کند."""
    channel_data = {
        'title': channel_title,
        'invite_link': invite_link,
        'button_text': button_text
    }
    # از channel_id به عنوان نام داکیومنت استفاده می‌کنیم
    db.collection('channels').document(str(channel_id)).set(channel_data)

def get_channels_to_promote():
    """لیست تمام کانال‌های تبلیغی را از Firestore برمی‌گرداند."""
    channels_ref = db.collection('channels')
    docs = channels_ref.stream()
    channels = {doc.id: doc.to_dict() for doc in docs}
    return channels

# --- توابع مدارس ---
def add_school(province, city, school_name):
    """یک مدرسه به شهر مشخص در Firestore اضافه می‌کند."""
    # از یک سند برای هر شهر استفاده می‌کنیم و مدارس را در یک آرایه نگه می‌داریم
    city_ref = db.collection('schools').document(province).collection('cities').document(city)
    # با استفاده از ArrayUnion، اگر مدرسه وجود نداشته باشد آن را اضافه می‌کند
    city_ref.set({'names': firestore.ArrayUnion([school_name])}, merge=True)

def get_schools(province, city):
    """لیست مدارس یک شهر را از Firestore برمی‌گرداند."""
    doc_ref = db.collection('schools').document(province).collection('cities').document(city)
    doc = doc_ref.get()
    if doc.exists:
        # لیست مدارس را برمی‌گرداند و مرتب می‌کند
        school_list = doc.to_dict().get('names', [])
        school_list.sort()
        return school_list
    return []