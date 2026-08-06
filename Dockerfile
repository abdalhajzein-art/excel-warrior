# 1. استخدام نسخة خفيفة جداً من Node
FROM node:20-slim

# 2. إعداد متغيرات البيئة
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 3. تحديث وتثبيت مكتبات بايثون 3.12
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip \
    git \
    libxml2-dev \
    libxslt-dev \
    zlib1g-dev \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    ghostscript \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. ربط python3 بـ python3.12
RUN ln -sf /usr/bin/python3.12 /usr/bin/python3

# 5. إنشاء بيئة بايثون افتراضية
RUN python3.12 -m venv $VIRTUAL_ENV
RUN pip install --upgrade pip

# 6. مجلد العمل
WORKDIR /app

# 7. تثبيت حزم Node
COPY package*.json ./
RUN npm install --omit=dev

# 8. تثبيت متطلبات Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 9. نسخ باقي ملفات المشروع
COPY api ./api
COPY js ./js
COPY index.html ./
COPY style.css ./
COPY app.js ./

# 10. المنفذ والتشغيل
EXPOSE 8080
CMD ["node", "app.js"]
