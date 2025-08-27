#!/bin/bash

# AI Website Builder Deployment Script
# This script deploys the application to the server

set -e

echo "🚀 Deploying AI Website Builder..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/website-builder/ai-website-builder"
BACKUP_DIR="/var/backups/ai-website-builder/deployments"
APP_USER="website-builder"
REPO_URL="${1:-https://github.com/yourusername/ai-website-builder.git}"
BRANCH="${2:-main}"

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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Create backup of current deployment
if [ -d "$APP_DIR" ]; then
    print_status "Creating backup of current deployment..."
    BACKUP_NAME="deployment_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$APP_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    print_success "Backup created: $BACKUP_DIR/$BACKUP_NAME"
fi

# Stop services
print_status "Stopping services..."
systemctl stop ai-website-builder-backend || true
systemctl stop ai-website-builder-frontend || true

# Clone or update repository
if [ ! -d "$APP_DIR" ]; then
    print_status "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
else
    print_status "Updating repository..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
    git pull origin "$BRANCH"
fi

cd "$APP_DIR"

# Set ownership
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
sudo -u "$APP_USER" npm install

# Build backend
print_status "Building backend..."
sudo -u "$APP_USER" npm run build

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd ../frontend
sudo -u "$APP_USER" npm install

# Build frontend
print_status "Building frontend..."
sudo -u "$APP_USER" npm run build

# Run database migrations
print_status "Running database migrations..."
cd ../backend
sudo -u "$APP_USER" npx prisma migrate deploy
sudo -u "$APP_USER" npx prisma generate

# Copy environment files if they don't exist
if [ ! -f .env ]; then
    print_status "Creating environment file..."
    cat > .env << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://website-builder:secure_password_change_this@localhost:5432/ai_website_builder

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-change-this
JWT_EXPIRES_IN=7d

# AI Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Server Configuration
SERVER_DOMAIN=your-server-domain.com
SERVER_IP=your-server-ip
SITES_PATH=/var/www/sites
NGINX_PATH=/etc/nginx/sites-enabled
CERTBOT_PATH=/etc/letsencrypt/live

# Frontend URL
FRONTEND_URL=http://localhost:3000
EOF
    chown "$APP_USER:$APP_USER" .env
    print_warning "Please update the environment variables in backend/.env"
fi

# Copy frontend environment file
cd ../frontend
if [ ! -f .env ]; then
    print_status "Creating frontend environment file..."
    cat > .env << 'EOF'
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=AI Website Builder
VITE_APP_VERSION=1.0.0
EOF
    chown "$APP_USER:$APP_USER" .env
fi

# Update systemd service files with correct paths
print_status "Updating systemd service files..."
cat > /etc/systemd/system/ai-website-builder-backend.service << EOF
[Unit]
Description=AI Website Builder Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/backend/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR
ReadWritePaths=/var/www/sites
ReadWritePaths=/var/log/ai-website-builder
ReadWritePaths=/etc/nginx/sites-enabled

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/ai-website-builder-frontend.service << EOF
[Unit]
Description=AI Website Builder Frontend
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/frontend
ExecStart=/usr/bin/npx serve -s dist -l 3000
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/frontend/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

# Install serve globally for frontend
print_status "Installing serve package..."
npm install -g serve

# Reload systemd
print_status "Reloading systemd..."
systemctl daemon-reload

# Enable and start services
print_status "Starting services..."
systemctl enable ai-website-builder-backend
systemctl enable ai-website-builder-frontend

systemctl start ai-website-builder-backend
systemctl start ai-website-builder-frontend

# Reload nginx
print_status "Reloading nginx..."
systemctl reload nginx

# Health check
print_status "Performing health check..."
sleep 5

if systemctl is-active --quiet ai-website-builder-backend; then
    print_success "Backend service is running"
else
    print_error "Backend service failed to start"
    echo "Check logs with: journalctl -u ai-website-builder-backend -f"
fi

if systemctl is-active --quiet ai-website-builder-frontend; then
    print_success "Frontend service is running"
else
    print_error "Frontend service failed to start"
    echo "Check logs with: journalctl -u ai-website-builder-frontend -f"
fi

# Test API endpoint
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health | grep -q "200"; then
    print_success "API health check passed"
else
    print_warning "API health check failed - service may still be starting"
fi

print_success "🎉 Deployment completed!"

echo
echo -e "${GREEN}=== Deployment Summary ===${NC}"
echo -e "• Application deployed to: $APP_DIR"
echo -e "• Backend service: ai-website-builder-backend"
echo -e "• Frontend service: ai-website-builder-frontend"
echo -e "• Database migrations applied"
echo -e "• Services enabled and started"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update environment variables in backend/.env"
echo -e "2. Configure your domain name in nginx"
echo -e "3. Set up SSL certificates with certbot"
echo -e "4. Test the application"
echo
echo -e "${BLUE}Useful commands:${NC}"
echo -e "• Check backend status: systemctl status ai-website-builder-backend"
echo -e "• Check frontend status: systemctl status ai-website-builder-frontend"
echo -e "• View backend logs: journalctl -u ai-website-builder-backend -f"
echo -e "• View frontend logs: journalctl -u ai-website-builder-frontend -f"
echo -e "• Test API: curl http://localhost:3001/health"
echo -e "• Test frontend: curl http://localhost:3000"

echo
echo -e "${BLUE}Application URLs:${NC}"
echo -e "• Frontend: http://your-server-ip:3000"
echo -e "• API: http://your-server-ip:3001"
echo -e "• Health check: http://your-server-ip:3001/health"