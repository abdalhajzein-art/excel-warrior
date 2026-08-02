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

# 1. نسخ وتثبيت مكتبات Python عبر requirements.txt
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

# 2. نسخ وتثبيت مكتبات Node
COPY package*.json ./
RUN npm install

# 3. نسخ باقي ملفات التطبيق
COPY . .

# المنفذ
EXPOSE 3000

# تشغيل المنظومة
CMD ["npm", "start"]
