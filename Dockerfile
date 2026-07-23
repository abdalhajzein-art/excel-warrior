# استخدام بيئة رسمية تحتوي على Node.js
FROM node:22-slim

# تثبيت Python3 و pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# تثبيت مكتبات Python باستخدام pip
RUN pip3 install openpyxl pandas --break-system-packages

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
