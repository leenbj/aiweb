#!/bin/bash

# AI Website Builder Server Setup Script
# This script sets up the server environment for hosting multiple websites

set -e

echo "🚀 Setting up AI Website Builder Server..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SITES_DIR="/var/www/sites"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
LOG_DIR="/var/log/ai-website-builder"
BACKUP_DIR="/var/backups/ai-website-builder"
DB_NAME="ai_website_builder"
APP_USER="website-builder"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 1>&2
   exit 1
fi

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Update system packages
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y \
    nginx \
    nodejs \
    npm \
    postgresql \
    postgresql-contrib \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban \
    htop \
    curl \
    wget \
    git \
    rsync \
    unzip

# Install Node.js LTS
print_status "Installing Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs

# Create application user
print_status "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
    usermod -aG sudo "$APP_USER"
    print_success "User $APP_USER created"
else
    print_warning "User $APP_USER already exists"
fi

# Create directories
print_status "Creating directories..."
mkdir -p "$SITES_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "/home/$APP_USER/ai-website-builder"

# Set proper permissions
chown -R "$APP_USER:$APP_USER" "$SITES_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$BACKUP_DIR"
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/ai-website-builder"

# Configure Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/atom+xml
        application/geo+json
        application/javascript
        application/x-javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rdf+xml
        application/rss+xml
        application/xhtml+xml
        application/xml
        font/eot
        font/otf
        font/ttf
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=admin:10m rate=5r/s;
    
    # Include site configurations
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# Create default Nginx configuration for the admin panel
cat > "$NGINX_SITES_AVAILABLE/ai-website-builder-admin" << 'EOF'
server {
    listen 80;
    server_name admin.localhost;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting for API
        limit_req zone=api burst=20 nodelay;
    }
}
EOF

# Enable the admin site
ln -sf "$NGINX_SITES_AVAILABLE/ai-website-builder-admin" "$NGINX_SITES_ENABLED/"

# Remove default Nginx site
rm -f "$NGINX_SITES_ENABLED/default"

# Configure PostgreSQL
print_status "Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres createdb "$DB_NAME" 2>/dev/null || print_warning "Database $DB_NAME already exists"
sudo -u postgres psql -c "CREATE USER $APP_USER WITH ENCRYPTED PASSWORD 'secure_password_change_this';" 2>/dev/null || print_warning "User $APP_USER already exists in PostgreSQL"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $APP_USER;" 2>/dev/null

# Configure firewall
print_status "Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # Admin panel (temporary, should be removed in production)

# Configure fail2ban
print_status "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 6

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

# Create SSL certificate directories
print_status "Setting up SSL certificate directories..."
mkdir -p /etc/letsencrypt/live
mkdir -p /etc/letsencrypt/archive
chown -R root:root /etc/letsencrypt

# Create backup script
print_status "Creating backup script..."
cat > /usr/local/bin/backup-websites.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/ai-website-builder"
DATE=$(date +%Y%m%d_%H%M%S)
SITES_DIR="/var/www/sites"

# Create backup directory for today
mkdir -p "$BACKUP_DIR/$DATE"

# Backup website files
if [ -d "$SITES_DIR" ]; then
    rsync -av "$SITES_DIR/" "$BACKUP_DIR/$DATE/sites/"
fi

# Backup database
sudo -u postgres pg_dump ai_website_builder > "$BACKUP_DIR/$DATE/database.sql"

# Backup nginx configurations
mkdir -p "$BACKUP_DIR/$DATE/nginx"
cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/$DATE/nginx/"
cp -r /etc/nginx/sites-available "$BACKUP_DIR/$DATE/nginx/"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -type d -name "20*" -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_DIR/$DATE"
EOF

chmod +x /usr/local/bin/backup-websites.sh

# Create cron job for daily backups
echo "0 2 * * * root /usr/local/bin/backup-websites.sh >> /var/log/ai-website-builder/backup.log 2>&1" > /etc/cron.d/website-backup

# Create systemd services
print_status "Creating systemd services..."

# Backend service
cat > /etc/systemd/system/ai-website-builder-backend.service << 'EOF'
[Unit]
Description=AI Website Builder Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=website-builder
Group=website-builder
WorkingDirectory=/home/website-builder/ai-website-builder/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATABASE_URL=postgresql://website-builder:secure_password_change_this@localhost:5432/ai_website_builder

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/website-builder/ai-website-builder
ReadWritePaths=/var/www/sites
ReadWritePaths=/var/log/ai-website-builder
ReadWritePaths=/etc/nginx/sites-enabled

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (for development/admin panel)
cat > /etc/systemd/system/ai-website-builder-frontend.service << 'EOF'
[Unit]
Description=AI Website Builder Frontend
After=network.target

[Service]
Type=simple
User=website-builder
Group=website-builder
WorkingDirectory=/home/website-builder/ai-website-builder/frontend
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/website-builder/ai-website-builder

[Install]
WantedBy=multi-user.target
EOF

# Create log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/ai-website-builder << 'EOF'
/var/log/ai-website-builder/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 website-builder website-builder
    postrotate
        systemctl reload ai-website-builder-backend || true
    endscript
}
EOF

# Create monitoring script
print_status "Creating monitoring script..."
cat > /usr/local/bin/monitor-websites.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/ai-website-builder/monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check if backend is running
if ! systemctl is-active --quiet ai-website-builder-backend; then
    echo "[$DATE] Backend service is down, attempting to restart..." >> "$LOG_FILE"
    systemctl restart ai-website-builder-backend
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "[$DATE] Nginx is down, attempting to restart..." >> "$LOG_FILE"
    systemctl restart nginx
fi

# Check disk usage
DISK_USAGE=$(df /var/www/sites | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "[$DATE] Warning: Disk usage is at ${DISK_USAGE}%" >> "$LOG_FILE"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ "$MEMORY_USAGE" -gt 80 ]; then
    echo "[$DATE] Warning: Memory usage is at ${MEMORY_USAGE}%" >> "$LOG_FILE"
fi
EOF

chmod +x /usr/local/bin/monitor-websites.sh

# Add monitoring to cron
echo "*/5 * * * * root /usr/local/bin/monitor-websites.sh" > /etc/cron.d/website-monitor

# Reload systemd and enable services
systemctl daemon-reload
systemctl enable postgresql
systemctl enable nginx
systemctl enable fail2ban

# Start services
systemctl start postgresql
systemctl start nginx
systemctl start fail2ban

# Test nginx configuration
nginx -t

print_success "Server setup completed successfully!"

echo
echo -e "${GREEN}=== Setup Summary ===${NC}"
echo -e "• Nginx configured and running"
echo -e "• PostgreSQL database '$DB_NAME' created"
echo -e "• Application user '$APP_USER' created"
echo -e "• Sites directory: $SITES_DIR"
echo -e "• Log directory: $LOG_DIR"
echo -e "• Backup directory: $BACKUP_DIR"
echo -e "• SSL certificates will be stored in /etc/letsencrypt/live/"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update the database password in the systemd service file"
echo -e "2. Deploy your application code to /home/$APP_USER/ai-website-builder/"
echo -e "3. Update environment variables"
echo -e "4. Start the application services:"
echo -e "   systemctl start ai-website-builder-backend"
echo -e "   systemctl enable ai-website-builder-backend"
echo -e "5. Configure your domain names"
echo
echo -e "${BLUE}Useful commands:${NC}"
echo -e "• Check service status: systemctl status ai-website-builder-backend"
echo -e "• View logs: journalctl -u ai-website-builder-backend -f"
echo -e "• Backup websites: /usr/local/bin/backup-websites.sh"
echo -e "• Monitor system: /usr/local/bin/monitor-websites.sh"

print_success "🎉 AI Website Builder server is ready!"