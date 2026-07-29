FROM node:22-slim

# تثبيت Python3 و pip + LibreOffice
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# تثبيت مكتبات Python
RUN pip3 install openpyxl pandas --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD ["npm", "start"]
