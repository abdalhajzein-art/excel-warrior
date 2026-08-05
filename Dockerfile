# 1. استخدام نسخة خفيفة جداً من Node لتوفير الرام والمساحة
FROM node:20-slim

# 2. إعداد متغيرات البيئة الأساسية
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 3. تحديث وتثبيت مكتبات بايثون و Office مع منع تثبيت الملحقات غير الضرورية
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    libxml2-dev \
    libxslt-dev \
    zlib1g-dev \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    libreoffice \
    ghostscript \
    poppler-utils \
    imagemagick \
    tesseract-ocr \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. إنشاء بيئة بايثون افتراضية (الممارسة الصحيحة بدلاً من break-system-packages)
RUN python3 -m venv $VIRTUAL_ENV
RUN pip install --upgrade pip

# 5. مجلد العمل
WORKDIR /app

# 6. تثبيت حزم Node أولاً (للاستفادة من الكاش في Docker)
COPY package*.json ./
RUN npm ci --only=production

# 7. تثبيت متطلبات Python داخل البيئة الافتراضية
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 8. نسخ باقي ملفات المشروع
COPY api ./api
COPY js ./js
COPY index.html ./
COPY style.css ./
COPY app.js ./

# 9. المنفذ والتشغيل
EXPOSE 8080
CMD ["node", "app.js"]
