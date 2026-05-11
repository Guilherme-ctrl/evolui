-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "feedbackDimensions" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "WorkoutFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "submittedDate" DATE NOT NULL,
    "scores" JSONB NOT NULL,
    "notes" VARCHAR(280),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutFeedback_tenantId_studentId_submittedDate_idx" ON "WorkoutFeedback"("tenantId", "studentId", "submittedDate");

-- CreateIndex
CREATE INDEX "WorkoutFeedback_workoutId_submittedDate_idx" ON "WorkoutFeedback"("workoutId", "submittedDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutFeedback_workoutId_studentId_submittedDate_key" ON "WorkoutFeedback"("workoutId", "studentId", "submittedDate");

-- AddForeignKey
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
