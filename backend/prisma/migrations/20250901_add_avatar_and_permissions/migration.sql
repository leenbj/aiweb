-- Add avatarUrl column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS "user_permissions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique userId + permission
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- Trigger to update updatedAt on change (PostgreSQL)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_permissions_set_updated_at ON "user_permissions";
CREATE TRIGGER user_permissions_set_updated_at
BEFORE UPDATE ON "user_permissions"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
