#!/bin/bash

# Manual deployment script for Next.js app
# Run this on your EC2 server to fix the missing .next folder issue
# Usage: bash manual-deploy.sh

set -e  # Exit on any error

echo "========================================="
echo "Manual Deployment for Zed Booking App"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "ERROR: package.json not found!"
    echo "Please cd to /var/www/zed-capital-booking-app first"
    exit 1
fi

echo "1. Stopping PM2 processes..."
pm2 stop zed-booking-app || echo "App not running"
pm2 delete zed-booking-app || echo "App not in PM2"

echo ""
echo "2. Pulling latest code..."
git fetch --all
git reset --hard origin/main
git pull origin main

echo ""
echo "3. Cleaning old builds..."
rm -rf .next
rm -rf node_modules

echo ""
echo "4. Installing dependencies..."
npm ci

echo ""
echo "5. Building Next.js app..."
echo "This may take a few minutes..."
npm run build

echo ""
echo "6. Verifying build..."
if [ -d ".next" ]; then
    echo "✅ .next directory created successfully"
    echo "   Size: $(du -sh .next | cut -f1)"
    echo "   Files: $(find .next -type f | wc -l) files"
else
    echo "❌ ERROR: .next directory not found!"
    echo "Build failed. Check the output above for errors."
    exit 1
fi

echo ""
echo "7. Setting permissions..."
chmod -R 755 .next
chown -R ubuntu:ubuntu .next

echo ""
echo "8. Starting with PM2..."
pm2 start npm --name zed-booking-app -- start
pm2 save

echo ""
echo "9. Checking app status..."
sleep 3
pm2 list | grep zed-booking-app

echo ""
echo "10. Testing localhost..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ App is responding on localhost:3000"
else
    echo "⚠️  App might not be ready yet. Check logs: pm2 logs zed-booking-app"
fi

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  - Check logs: pm2 logs zed-booking-app"
echo "  - Test site: https://app.zedcapitalbooking.com"
echo "  - If issues persist: sudo systemctl reload nginx"
