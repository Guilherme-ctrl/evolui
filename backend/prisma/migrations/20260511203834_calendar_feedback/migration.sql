-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "feedbackDimensions" JSONB;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "defaultFeedbackDimensions" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "CalendarEventFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "notes" VARCHAR(280),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEventFeedback_tenantId_studentId_createdAt_idx" ON "CalendarEventFeedback"("tenantId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "CalendarEventFeedback_eventId_idx" ON "CalendarEventFeedback"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventFeedback_eventId_studentId_key" ON "CalendarEventFeedback"("eventId", "studentId");

-- AddForeignKey
ALTER TABLE "CalendarEventFeedback" ADD CONSTRAINT "CalendarEventFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventFeedback" ADD CONSTRAINT "CalendarEventFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventFeedback" ADD CONSTRAINT "CalendarEventFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventFeedback" ADD CONSTRAINT "CalendarEventFeedback_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
