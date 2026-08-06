# 1. استخدام نسخة خفيفة جداً من Node
FROM node:20-slim

# 2. إعداد متغيرات البيئة
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 3. تحديث وتثبيت مكتبات بايثون الأساسية (بدون LibreOffice لتوفير المساحة)
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
    # ✅ استغنى عن LibreOffice (500MB) واستخدم formulas المكتبة بدلاً منه
    ghostscript \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. إنشاء بيئة بايثون افتراضية
RUN python3 -m venv $VIRTUAL_ENV
RUN pip install --upgrade pip

# 5. مجلد العمل
WORKDIR /app

# 6. تثبيت حزم Node
COPY package*.json ./
RUN npm install --omit=dev

# 7. تثبيت متطلبات Python
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
