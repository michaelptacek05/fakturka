-- Pouze nové bezpečnostní tabulky; existující doklady a profily se nemění.
CREATE TABLE "AuthSession" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

CREATE TABLE "LoginThrottle" (
  "sourceHash" TEXT NOT NULL PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LoginThrottle_windowStartedAt_idx" ON "LoginThrottle"("windowStartedAt");
