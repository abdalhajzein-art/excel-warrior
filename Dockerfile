# استخدام صورة ديبيان خفيفة مع Node.js 20 لضمان استقرار الخادم
FROM node:20-bookworm-slim

# إعداد متغيرات البيئة لمنع تعليق بايثون وتفعيل وضع الإنتاج
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# تثبيت بايثون وأدوات البيئة الافتراضية
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 🚀 إنشاء البيئة الافتراضية (هذا هو المسار الذي يقرأه المحرك الديناميكي)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# تحديد مجلد العمل
WORKDIR /app

# نسخ وتثبيت متطلبات بايثون أولاً (للاستفادة من ذاكرة التخزين المؤقت لدوكر)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ وتثبيت متطلبات Node.js
COPY package*.json ./
RUN npm install --production

# نسخ باقي ملفات منصة الأثير
COPY . .

# المنفذ الافتراضي
EXPOSE 3000

# تشغيل خادم Node.js
CMD ["npm", "start"]
