# Delta APay - VPS Deployment Guide

This guide covers how to deploy the Delta APay full-stack application (Next.js Frontend + Node.js Backend) on an Ubuntu VPS.

## Prerequisites
- An Ubuntu VPS (20.04 or 22.04)
- Domain name pointing to your VPS IP (optional but recommended for SSL)
- Node.js (v18+) and npm installed
- PM2 installed globally (`npm install -g pm2`)
- Git installed
- Nginx installed (for reverse proxying)

## 1. Initial Setup & Cloning

SSH into your VPS:
```bash
ssh root@your_vps_ip
```

Clone your repository (replace with your actual repo URL):
```bash
git clone https://github.com/Zamir-MoN/Delta-APay.git
cd Delta-APay
```

## 2. Backend Setup

Navigate to the backend and install dependencies:
```bash
cd backend
npm install
```

Set up your `.env` file (ensure you include all necessary Gmail API credentials, Database URL, and Frontend URL):
```bash
cp .env.example .env
nano .env
```

Initialize the database and build the TypeScript code:
```bash
npx prisma generate
npx prisma db push
npm run build
```

Start the backend using PM2:
```bash
pm2 start dist/index.js --name "delta-backend"
```

## 3. Frontend Setup

Navigate to the frontend and install dependencies:
```bash
cd ../frontend
npm install
```

Set up your `.env` file for the frontend (pointing to your backend URL):
```bash
cp .env.example .env
nano .env
```

Build the Next.js production app:
```bash
npm run build
```

Start the frontend using PM2:
```bash
pm2 start npm --name "delta-frontend" -- start
```

## 4. Save PM2 State
To ensure your apps restart if the VPS reboots:
```bash
pm2 save
pm2 startup
```

## 5. (Optional) Nginx Reverse Proxy & SSL

If you want to serve your app on standard ports (80/443) with a domain name, configure Nginx.

Create a new config file:
```bash
nano /etc/nginx/sites-available/delta-apay
```

Add the following (replace `yourdomain.com` and ports if different):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Route to Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Route to Backend API
    location /api {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:
```bash
ln -s /etc/nginx/sites-available/delta-apay /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

Use Certbot to easily get a free SSL certificate:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 6. Updating Code in the Future

Whenever you push new changes to GitHub, you can update your live VPS easily:

```bash
cd ~/Delta-APay
git pull

# Update Backend
cd backend
npm install
npm run build
pm2 restart delta-backend

# Update Frontend
cd ../frontend
npm install
npm run build
pm2 restart delta-frontend
```
