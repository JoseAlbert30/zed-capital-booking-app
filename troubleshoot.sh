#!/bin/bash

# Troubleshooting script for Next.js deployment issues
# Run this on your production server to diagnose the 400 errors

echo "=== Next.js Deployment Diagnostics ==="
echo ""

# Check if .next directory exists
echo "1. Checking .next directory..."
if [ -d "/var/www/zed-capital-booking-app/.next" ]; then
    echo "✅ .next directory exists"
    echo "   Size: $(du -sh /var/www/zed-capital-booking-app/.next | cut -f1)"
    echo "   Permissions: $(ls -ld /var/www/zed-capital-booking-app/.next)"
else
    echo "❌ .next directory NOT FOUND!"
    echo "   Run: cd /var/www/zed-capital-booking-app && npm run build"
fi
echo ""

# Check PM2 status
echo "2. Checking PM2 status..."
pm2 list | grep zed-booking-app
echo ""

# Check if app is running on port 3000
echo "3. Checking if Next.js is running on port 3000..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Next.js app is responding on localhost:3000"
else
    echo "❌ Next.js app is NOT responding on localhost:3000"
    echo "   Check PM2 logs: pm2 logs zed-booking-app"
fi
echo ""

# Check Nginx configuration
echo "4. Checking Nginx configuration..."
sudo nginx -t
echo ""

# Check if Nginx is running
echo "5. Checking Nginx status..."
sudo systemctl status nginx | grep Active
echo ""

# Check recent Nginx error logs
echo "6. Recent Nginx errors:"
sudo tail -20 /var/log/nginx/zed-booking-app-error.log 2>/dev/null || echo "No error log found"
echo ""

# Check static files
echo "7. Checking static files in .next..."
if [ -d "/var/www/zed-capital-booking-app/.next/static" ]; then
    echo "✅ .next/static directory exists"
    echo "   Files: $(find /var/www/zed-capital-booking-app/.next/static -type f | wc -l)"
else
    echo "❌ .next/static directory NOT FOUND!"
fi
echo ""

# Test localhost:3000/_next/static
echo "8. Testing static file access..."
STATIC_FILE=$(find /var/www/zed-capital-booking-app/.next/static -type f -name "*.css" | head -1)
if [ -n "$STATIC_FILE" ]; then
    FILENAME=$(basename $STATIC_FILE)
    echo "   Testing: http://localhost:3000/_next/static/css/$FILENAME"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/_next/static/css/$FILENAME)
    if [ "$HTTP_CODE" == "200" ]; then
        echo "   ✅ Static file accessible (HTTP $HTTP_CODE)"
    else
        echo "   ❌ Static file returned HTTP $HTTP_CODE"
    fi
fi
echo ""

echo "=== Recommendations ==="
echo "If .next is missing: cd /var/www/zed-capital-booking-app && npm run build"
echo "If PM2 not running: pm2 restart zed-booking-app"
echo "If Nginx errors: sudo systemctl reload nginx"
echo "View PM2 logs: pm2 logs zed-booking-app --lines 50"
