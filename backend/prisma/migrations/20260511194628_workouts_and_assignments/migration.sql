-- CreateEnum
CREATE TYPE "WorkoutAssignmentScope" AS ENUM ('TURMA', 'STUDENT');

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "notes" VARCHAR(500),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "ownerStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "nameSnapshot" VARCHAR(140) NOT NULL,
    "descriptionSnapshot" VARCHAR(500),
    "videoUrlSnapshot" VARCHAR(2000),
    "order" INTEGER NOT NULL,
    "sets" INTEGER,
    "repetitions" INTEGER,
    "durationSeconds" INTEGER,
    "restSeconds" INTEGER,
    "notes" VARCHAR(280),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "scope" "WorkoutAssignmentScope" NOT NULL,
    "turmaId" TEXT,
    "studentId" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "notes" VARCHAR(280),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workout_tenantId_archived_idx" ON "Workout"("tenantId", "archived");

-- CreateIndex
CREATE INDEX "Workout_tenantId_createdByUserId_idx" ON "Workout"("tenantId", "createdByUserId");

-- CreateIndex
CREATE INDEX "Workout_tenantId_name_idx" ON "Workout"("tenantId", "name");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_libraryItemId_idx" ON "WorkoutExercise"("libraryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutId_order_key" ON "WorkoutExercise"("workoutId", "order");

-- CreateIndex
CREATE INDEX "WorkoutAssignment_tenantId_idx" ON "WorkoutAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "WorkoutAssignment_tenantId_turmaId_idx" ON "WorkoutAssignment"("tenantId", "turmaId");

-- CreateIndex
CREATE INDEX "WorkoutAssignment_tenantId_studentId_idx" ON "WorkoutAssignment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "WorkoutAssignment_workoutId_idx" ON "WorkoutAssignment"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutAssignment_workoutId_turmaId_key" ON "WorkoutAssignment"("workoutId", "turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutAssignment_workoutId_studentId_key" ON "WorkoutAssignment"("workoutId", "studentId");

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_ownerStaffId_fkey" FOREIGN KEY ("ownerStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "ExerciseLibraryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAssignment" ADD CONSTRAINT "WorkoutAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAssignment" ADD CONSTRAINT "WorkoutAssignment_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAssignment" ADD CONSTRAINT "WorkoutAssignment_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAssignment" ADD CONSTRAINT "WorkoutAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAssignment" ADD CONSTRAINT "WorkoutAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Garante XOR entre turmaId/studentId conforme scope (não expressável em Prisma).
ALTER TABLE "WorkoutAssignment"
  ADD CONSTRAINT "WorkoutAssignment_scope_target_check" CHECK (
    ("scope" = 'TURMA'   AND "turmaId" IS NOT NULL AND "studentId" IS NULL) OR
    ("scope" = 'STUDENT' AND "studentId" IS NOT NULL AND "turmaId" IS NULL)
  );
