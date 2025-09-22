-- AlterTable
ALTER TABLE "leads" ADD COLUMN "lastInteractionAt" DATETIME;
ALTER TABLE "leads" ADD COLUMN "lastInteractionType" TEXT;
ALTER TABLE "leads" ADD COLUMN "lossDetails" TEXT;
ALTER TABLE "leads" ADD COLUMN "lossReason" TEXT;
ALTER TABLE "leads" ADD COLUMN "nextActionAt" DATETIME;
ALTER TABLE "leads" ADD COLUMN "nextActionNotes" TEXT;
ALTER TABLE "leads" ADD COLUMN "nextActionType" TEXT;
ALTER TABLE "leads" ADD COLUMN "sourceDetails" TEXT;

-- CreateTable
CREATE TABLE "task_subitems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "task_subitems_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "lead_tag_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    CONSTRAINT "lead_tag_assignments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_tag_assignments_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "lead_tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_tag_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
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
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("assigneeId", "completedAt", "createdAt", "creatorId", "description", "dueAt", "id", "leadId", "status", "title") SELECT "assigneeId", "completedAt", "createdAt", "creatorId", "description", "dueAt", "id", "leadId", "status", "title" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "lead_tags_name_key" ON "lead_tags"("name");

-- CreateIndex
CREATE INDEX "lead_tag_assignments_leadId_idx" ON "lead_tag_assignments"("leadId");

-- CreateIndex
CREATE INDEX "lead_tag_assignments_tagId_idx" ON "lead_tag_assignments"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_tag_assignments_leadId_tagId_key" ON "lead_tag_assignments"("leadId", "tagId");
