# بيئة Node حديثة
FROM node:22

# تثبيت الأدوات الأساسية للنظام
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

# 1. نسخ وتثبيت مكتبات Python
COPY requirements.txt /app/requirements.txt
RUN pip3 install --break-system-packages -r /app/requirements.txt

# 2. نسخ وتثبيت مكتبات Node
COPY package*.json /app/
RUN npm install

# 3. نسخ ملفات التطبيق بشكل صريح وواضح
COPY api /app/api
COPY js /app/js
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

# المنفذ
EXPOSE 3000

# تشغيل المنظومة
CMD ["npm", "start"]
