-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sslStatus" TEXT NOT NULL DEFAULT 'pending',
    "dnsStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deployedAt" TIMESTAMP(3),

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "websiteChanges" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "serverPath" TEXT NOT NULL,
    "logs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_configs" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "serverPath" TEXT NOT NULL,
    "nginxConfig" TEXT NOT NULL,
    "sslCertPath" TEXT,
    "sslStatus" TEXT NOT NULL DEFAULT 'pending',
    "dnsStatus" TEXT NOT NULL DEFAULT 'pending',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "websites_domain_key" ON "websites"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "server_configs_key_key" ON "server_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "domain_configs_domain_key" ON "domain_configs"("domain");

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
