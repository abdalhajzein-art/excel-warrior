# استخدام بيئة رسمية تحتوي على Node.js
FROM node:22-slim

# تثبيت Python3 ومدير الحزم pip ومكتبات الإكسل السيادية openpyxl و pandas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-openpyxl \
    python3-pandas \
    && rm -rf /var/lib/apt/lists/*

# تحديد مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات الاعتمادية وتثبيت حزم الـ Node
COPY package*.json ./
RUN npm install

# نسخ باقي ملفات المشروع إلى الحاوية
COPY . .

# تعيين المنفذ الافتراضي وتشغيل التطبيق
EXPOSE 8080
CMD ["npm", "start"]
