# بيئة Node حديثة
FROM node:22

# تثبيت أدوات النظام الأساسية ومعالجة المستندات
RUN apt-get update && apt-get install -y \
    libreoffice \
    ghostscript \
    poppler-utils \
    imagemagick \
    tesseract-ocr \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# مجلد العمل الرئيسي
WORKDIR /app

# 1. نسخ وتثبيت مكتبات Node
COPY package*.json /app/
RUN npm install

# 2. نسخ متطلبات بايثون وتثبيتها بشكل آمن ومباشر
COPY requirements.txt /app/
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# 3. نسخ ملفات التطبيق بالكامل
COPY api /app/api
COPY js /app/js
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

# المنفذ
EXPOSE 8080

# تشغيل المنظومة
CMD ["npm", "start"]
