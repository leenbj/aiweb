# CLAUDE.md
所有对话都必须需要使用中文

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Start development servers (both frontend and backend)
npm run dev

# Start individual services
npm run dev:frontend  # React app on localhost:3000
npm run dev:backend   # API server on localhost:3001

# Build for production
npm run build
npm run build:frontend
npm run build:backend
```

### Database Operations
```bash
cd backend
npx prisma migrate dev      # Apply database migrations
npx prisma generate        # Generate Prisma client
npx prisma db seed         # Seed database with initial data
```

### Deployment
```bash
# Server setup (run on production server with sudo)
./server-scripts/setup-server.sh

# Deploy application
./server-scripts/deploy.sh [repository-url] [branch]
```

### Linting & Type Checking
```bash
# Frontend
cd frontend && npm run lint

# Backend  
cd backend && npm run build  # TypeScript compilation serves as type check
```

## Architecture Overview

### System Design
This is an AI-powered website builder with local server deployment capabilities. Users interact through a React admin interface to build websites using natural language or visual editing, then deploy them to domains on the local server.

### Core Architecture Layers

1. **Frontend (React + TypeScript)**
   - State management via Zustand stores (`authStore`, `websiteStore`)
   - Real-time communication via WebSocket
   - Monaco Editor for code editing
   - Visual drag-and-drop editor with live preview

2. **Backend (Node.js + Express + Prisma)**
   - RESTful API with WebSocket support
   - AI service abstraction supporting OpenAI and Anthropic
   - Deployment service managing Nginx configuration and SSL certificates
   - PostgreSQL database with Prisma ORM

3. **Deployment Infrastructure**
   - Automatic Nginx virtual host configuration per domain
   - Let's Encrypt SSL certificate automation
   - DNS resolution checking before SSL issuance
   - File system isolation per website (`/var/www/sites/{domain}/`)

### Key Services

**AI Service** (`backend/src/services/ai.ts`)
- Provider pattern supporting multiple AI APIs (OpenAI/Anthropic)
- Three main operations: `generateWebsite()`, `editWebsite()`, `optimizeWebsite()`
- Structured prompting for HTML/CSS/JS generation

**Deployment Service** (`backend/src/services/deployment.ts`) 
- Handles full deployment pipeline: directory creation → file writing → Nginx config → DNS check → SSL setup
- Automatic Nginx configuration generation with security headers and caching
- DNS resolution verification before SSL certificate requests

**WebSocket Service** (`backend/src/websocket/index.ts`)
- Real-time communication for live preview updates
- Deployment status notifications
- AI conversation streaming

### Database Schema
Core entities: `User` → `Website` → `AIConversation` → `AIMessage`
- Websites track DNS/SSL status and deployment history
- AI conversations maintain chat history with website change tracking
- Deployment records track status and logs for troubleshooting

### Security Model
- JWT authentication with bcrypt password hashing
- File permissions: 755 for directories, 644 for files
- Nginx security headers and rate limiting
- Prisma ORM prevents SQL injection
- Server-side input validation via Joi schemas

### Configuration Management
Environment variables control AI providers, database connections, and server paths. The `backend/src/config/index.ts` centralizes all configuration with validation.

The system expects DNS A records to point to the server IP before SSL certificates can be issued. The deployment process is designed to handle partial deployments gracefully (e.g., DNS not yet propagated).