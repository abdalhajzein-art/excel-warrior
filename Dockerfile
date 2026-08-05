# بيئة Node مستقرة ومناسبة للـ child_process
FROM node:20

# تحديث النظام وتثبيت كل المكتبات الأساسية لمعالجة Excel وملفات Office
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libxml2-dev \
    libxslt-dev \
    zlib1g-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libfreetype6-dev \
    libreoffice \
    ghostscript \
    poppler-utils \
    imagemagick \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# ترقية pip لضمان تثبيت مكتبات حديثة
RUN pip3 install --upgrade pip

# مجلد العمل
WORKDIR /app

# نسخ وتثبيت مكتبات Node
COPY package*.json /app/
RUN npm install

# نسخ متطلبات بايثون وتثبيتها
COPY requirements.txt /app/
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# نسخ ملفات التطبيق
COPY api /app/api
COPY js /app/js
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

# المنفذ
EXPOSE 8080

# تشغيل المنظومة
CMD ["npm", "start"]
