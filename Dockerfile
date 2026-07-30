FROM node:22

# تثبيت الأدوات الأساسية اللازمة لمحركات الملفات
RUN apt-get update && apt-get install -y \
    libreoffice \
    ghostscript \
    poppler-utils \
    imagemagick \
    tesseract-ocr \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# تجاوز قيود PEP 668 لتثبيت مكتبات Python
RUN pip3 install --break-system-packages \
    openpyxl \
    pandas \
    python-docx \
    PyPDF2 \
    pillow

# مجلد التطبيق
WORKDIR /app

# تثبيت مكتبات Node
COPY package*.json ./
RUN npm install

# نسخ باقي الملفات
COPY . .

# المنفذ
EXPOSE 3000

# تشغيل التطبيق
CMD ["npm", "start"]
