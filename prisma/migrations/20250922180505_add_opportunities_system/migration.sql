-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "amountBr" REAL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseAt" DATETIME,
    "discountPct" REAL,
    "costEstimatedBr" REAL,
    "lostReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "opportunity_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceBr" REAL NOT NULL,
    "subtotalBr" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "opportunity_items_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stage_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "stageFrom" TEXT,
    "stageTo" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stage_history_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stage_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stage_probabilities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL,
    "probability" INTEGER NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "statusChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("assigneeId", "category", "completedAt", "createdAt", "creatorId", "description", "dueAt", "id", "leadId", "priority", "status", "statusChangedAt", "title", "updatedAt") SELECT "assigneeId", "category", "completedAt", "createdAt", "creatorId", "description", "dueAt", "id", "leadId", "priority", "status", "statusChangedAt", "title", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_ownerId_idx" ON "opportunities"("ownerId");

-- CreateIndex
CREATE INDEX "opportunities_expectedCloseAt_idx" ON "opportunities"("expectedCloseAt");

-- CreateIndex
CREATE INDEX "stage_history_opportunityId_idx" ON "stage_history"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "stage_probabilities_stage_key" ON "stage_probabilities"("stage");
