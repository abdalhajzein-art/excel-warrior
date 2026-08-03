# بيئة Node حديثة
FROM node:22

# تثبيت أدوات النظام + Python 3 + pip ومكتبات البيانات الكبرى (Pandas, Openpyxl)
RUN apt-get update && apt-get install -y \
    libreoffice \
    ghostscript \
    poppler-utils \
    imagemagick \
    tesseract-ocr \
    python3 \
    python3-pip \
    python3-pandas \
    python3-openpyxl \
    && rm -rf /var/lib/apt/lists/*

# مجلد العمل الرئيسي
WORKDIR /app

# 1. نسخ وتثبيت مكتبات Node
COPY package*.json /app/
RUN npm install

# 2. نسخ ملفات التطبيق
COPY api /app/api
COPY js /app/js
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

# المنفذ
EXPOSE 8080

# تشغيل المنظومة
CMD ["npm", "start"]
