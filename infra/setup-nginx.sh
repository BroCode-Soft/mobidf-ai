#!/bin/bash
# Setup script for nginx reverse proxy configuration
# Run as root or with sudo

set -e

DOMAIN="mobidf.brocode.net.br"
NGINX_CONF_SOURCE="./infra/mobidf.brocode.net.br.conf"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@brocode.com.br}"

echo "=== MobiDF Nginx Setup Script ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "This script must be run as root (use: sudo $0)"
   exit 1
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx not found. Installing..."
    apt-get update
    apt-get install -y nginx
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot not found. Installing..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

echo "✓ Nginx and Certbot are installed"
echo ""

# Copy nginx configuration
echo "Copying nginx configuration..."
if [ ! -f "$NGINX_CONF_SOURCE" ]; then
    echo "❌ Source file not found: $NGINX_CONF_SOURCE"
    exit 1
fi

cp "$NGINX_CONF_SOURCE" "$NGINX_SITES_AVAILABLE/"
echo "✓ Copied to $NGINX_SITES_AVAILABLE/"

# Enable site (create symlink)
if [ ! -L "$NGINX_SITES_ENABLED/mobidf.brocode.net.br.conf" ]; then
    ln -s "$NGINX_SITES_AVAILABLE/mobidf.brocode.net.br.conf" "$NGINX_SITES_ENABLED/"
    echo "✓ Enabled nginx site"
else
    echo "✓ Site already enabled"
fi

# Test nginx configuration
echo "Testing nginx configuration..."
if ! nginx -t; then
    echo "❌ Nginx configuration test failed"
    exit 1
fi
echo "✓ Nginx configuration is valid"

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx
echo "✓ Nginx reloaded"

echo ""
echo "=== SSL Certificate Setup ==="
echo ""
echo "Choose an option:"
echo "1) Request Let's Encrypt certificate (recommended, automatic renewal)"
echo "2) Skip for now (HTTP only, update after manual certificate setup)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "Requesting Let's Encrypt certificate for $DOMAIN..."
    echo "(You may be prompted to agree to terms and enter email)"
    echo ""
    
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$CERTBOT_EMAIL" || {
        echo "⚠️  Certbot setup failed. You can retry manually with:"
        echo "    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        exit 1
    }
    
    echo "✓ Let's Encrypt certificate installed"
    echo "✓ Automatic renewal configured via systemd"
    
elif [ "$choice" = "2" ]; then
    echo "Skipping SSL certificate setup"
    echo ""
    echo "To set up SSL manually later:"
    echo "  1. Add your certificate files to /etc/letsencrypt/live/$DOMAIN/ or custom path"
    echo "  2. Update certificate paths in: $NGINX_SITES_AVAILABLE/mobidf.brocode.net.br.conf"
    echo "  3. Uncomment the HTTP->HTTPS redirect in the nginx config"
    echo "  4. Test: sudo nginx -t"
    echo "  5. Reload: sudo systemctl reload nginx"
else
    echo "Invalid choice"
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Nginx configuration: $NGINX_SITES_AVAILABLE/mobidf.brocode.net.br.conf"
echo "Nginx status: $(systemctl is-active nginx)"
echo ""
echo "Frontend URL: https://$DOMAIN"
echo "Backend API: https://$DOMAIN/api"
echo "API Docs: https://$DOMAIN/api/docs"
echo ""
echo "Next steps:"
echo "1. Verify MobiDF services are running:"
echo "   docker-compose ps"
echo "2. Check nginx access logs:"
echo "   tail -f /var/log/nginx/mobidf.access.log"
echo "3. Check nginx error logs:"
echo "   tail -f /var/log/nginx/mobidf.error.log"
echo ""
