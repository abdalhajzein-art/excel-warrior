# 1. استخدام Python 3.12 كقاعدة خفيفة
FROM python:3.12-slim

# 2. تثبيت Node.js 20.x والأدوات الأساسية
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. إعداد متغيرات البيئة (تفعيل وضع الإنتاج والبيئة الافتراضية كمسار رئيسي)
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 4. إنشاء بيئة بايثون افتراضية وتحديث pip
RUN python3 -m venv $VIRTUAL_ENV
RUN pip install --upgrade pip

# 5. تحديد مجلد العمل
WORKDIR /app

# 6. تثبيت حزم Node أولاً (للاستفادة من الكاش)
COPY package*.json ./
RUN npm install --omit=dev

# 7. تثبيت متطلبات Python (بعد حذف الـ agent القديم)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 8. نسخ باقي ملفات المشروع السيادي
COPY api ./api
COPY js ./js
COPY index.html ./
COPY style.css ./
COPY app.js ./

# 9. المنفذ والتشغيل
EXPOSE 8080
CMD ["node", "app.js"]
