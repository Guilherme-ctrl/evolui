-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TREINADOR', 'ATLETA');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TREINO', 'JOGO', 'AMISTOSO', 'EVENTO', 'CAMPEONATO', 'AVALIACAO', 'REUNIAO');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CommunicationScope" AS ENUM ('GLOBAL', 'TURMA', 'DIRECT');

-- CreateEnum
CREATE TYPE "EvaluationModel" AS ENUM ('STARS', 'SIMPLE_SCALE');

-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('MARK_PRESENT', 'MARK_ABSENT');

-- CreateEnum
CREATE TYPE "StudentDocumentType" AS ENUM ('CPF', 'RG', 'RNE', 'OUTRO');

-- CreateEnum
CREATE TYPE "ProfessionalType" AS ENUM ('PROFESSOR', 'FISIOTERAPEUTA', 'PREPARADOR_FISICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "IndividualPlanType" AS ENUM ('TREINO', 'REFORCO_TECNICO', 'TRATAMENTO', 'RECUPERACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "IndividualPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "evaluationModel" "EvaluationModel" NOT NULL DEFAULT 'STARS',
    "evaluationDimensions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsKinship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "kinship" TEXT,
    "address" TEXT,
    "cpf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "birthDate" DATE,
    "categoryLabel" TEXT,
    "preferredPosition" TEXT,
    "emergencyContact" TEXT,
    "medicalNotes" TEXT,
    "physicalRestrictions" TEXT,
    "documentType" "StudentDocumentType",
    "documentNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "accountUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalType" "ProfessionalType" NOT NULL,
    "registry" TEXT,
    "bio" VARCHAR(280),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedProfessionalId" TEXT NOT NULL,
    "type" "IndividualPlanType" NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "goal" VARCHAR(500),
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "weeklyFrequency" INTEGER,
    "status" "IndividualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "completionNote" VARCHAR(280),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndividualPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualPlanSession" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "instructions" VARCHAR(1000),
    "estimatedDurationMinutes" INTEGER,

    CONSTRAINT "IndividualPlanSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualPlanExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "videoUrl" TEXT,
    "sets" INTEGER,
    "repetitions" INTEGER,
    "durationSeconds" INTEGER,
    "restSeconds" INTEGER,
    "notes" VARCHAR(280),

    CONSTRAINT "IndividualPlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualPlanAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousJson" JSONB,
    "nextJson" JSONB,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndividualPlanAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "isPrimaryForBilling" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageRangeText" TEXT,
    "weekDaysText" TEXT,
    "scheduleText" TEXT,
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "categoryLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaScheduleAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "previousJson" JSONB NOT NULL,
    "nextJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaScheduleAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelReason" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledById" TEXT,
    "isWholeSchool" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "previousJson" JSONB NOT NULL,
    "nextJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventTurma" (
    "eventId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,

    CONSTRAINT "CalendarEventTurma_pkey" PRIMARY KEY ("eventId","turmaId")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mode" "AttendanceMode" NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "reopenedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceReopenAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reopenedById" TEXT NOT NULL,
    "reopenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceReopenAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDeletionAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullNameSnapshot" TEXT NOT NULL,
    "deletedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDeletionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentHealthAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentHealthAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" VARCHAR(140),
    "autoFeedback" TEXT NOT NULL,
    "scores" JSONB NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "dataJson" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" "CommunicationScope" NOT NULL,
    "turmaId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "calendarEventId" TEXT,
    "recipientUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "turmaId" TEXT,
    "eventId" TEXT,
    "thumbnailKey" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaTagStudent" (
    "mediaId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "MediaTagStudent_pkey" PRIMARY KEY ("mediaId","studentId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payloadJson" JSONB,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDENTE',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialChargeAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "fromStatus" "ChargeStatus" NOT NULL,
    "toStatus" "ChargeStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialChargeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLibraryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerStaffId" TEXT NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "videoUrl" VARCHAR(2000),
    "defaultSets" INTEGER,
    "defaultRepetitions" INTEGER,
    "defaultDurationSeconds" INTEGER,
    "defaultRestSeconds" INTEGER,
    "notes" VARCHAR(280),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Guardian_tenantId_idx" ON "Guardian"("tenantId");

-- CreateIndex
CREATE INDEX "Student_tenantId_idx" ON "Student"("tenantId");

-- CreateIndex
CREATE INDEX "Student_tenantId_active_idx" ON "Student"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Student_tenantId_documentNumber_idx" ON "Student"("tenantId", "documentNumber");

-- CreateIndex
CREATE INDEX "Student_tenantId_accountUserId_idx" ON "Student"("tenantId", "accountUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_tenantId_idx" ON "StaffProfile"("tenantId");

-- CreateIndex
CREATE INDEX "StaffProfile_tenantId_professionalType_idx" ON "StaffProfile"("tenantId", "professionalType");

-- CreateIndex
CREATE INDEX "IndividualPlan_tenantId_studentId_idx" ON "IndividualPlan"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "IndividualPlan_tenantId_assignedProfessionalId_idx" ON "IndividualPlan"("tenantId", "assignedProfessionalId");

-- CreateIndex
CREATE INDEX "IndividualPlan_tenantId_status_idx" ON "IndividualPlan"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IndividualPlanSession_planId_order_key" ON "IndividualPlanSession"("planId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "IndividualPlanExercise_sessionId_order_key" ON "IndividualPlanExercise"("sessionId", "order");

-- CreateIndex
CREATE INDEX "IndividualPlanAudit_tenantId_planId_idx" ON "IndividualPlanAudit"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "StudentGuardian_tenantId_idx" ON "StudentGuardian"("tenantId");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE INDEX "Turma_tenantId_idx" ON "Turma"("tenantId");

-- CreateIndex
CREATE INDEX "Turma_tenantId_coachUserId_idx" ON "Turma"("tenantId", "coachUserId");

-- CreateIndex
CREATE INDEX "TurmaScheduleAudit_tenantId_turmaId_idx" ON "TurmaScheduleAudit"("tenantId", "turmaId");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_turmaId_idx" ON "Enrollment"("tenantId", "turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_turmaId_key" ON "Enrollment"("studentId", "turmaId");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_startsAt_idx" ON "CalendarEvent"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_status_idx" ON "CalendarEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CalendarEventAudit_tenantId_eventId_idx" ON "CalendarEventAudit"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "CalendarEventTurma_turmaId_idx" ON "CalendarEventTurma"("turmaId");

-- CreateIndex
CREATE INDEX "AttendanceSession_tenantId_turmaId_idx" ON "AttendanceSession"("tenantId", "turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_turmaId_eventId_key" ON "AttendanceSession"("turmaId", "eventId");

-- CreateIndex
CREATE INDEX "AttendanceReopenAudit_tenantId_sessionId_idx" ON "AttendanceReopenAudit"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "StudentDeletionAudit_tenantId_idx" ON "StudentDeletionAudit"("tenantId");

-- CreateIndex
CREATE INDEX "StudentDeletionAudit_tenantId_studentId_idx" ON "StudentDeletionAudit"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentHealthAudit_tenantId_studentId_idx" ON "StudentHealthAudit"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Evaluation_tenantId_studentId_idx" ON "Evaluation"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Evaluation_tenantId_turmaId_idx" ON "Evaluation"("tenantId", "turmaId");

-- CreateIndex
CREATE INDEX "Report_tenantId_studentId_idx" ON "Report"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Report_tenantId_status_idx" ON "Report"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CommunicationMessage_tenantId_createdAt_idx" ON "CommunicationMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationMessage_tenantId_turmaId_idx" ON "CommunicationMessage"("tenantId", "turmaId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_userId_idx" ON "CommunicationRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationRecipient_messageId_userId_key" ON "CommunicationRecipient"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_turmaId_idx" ON "MediaAsset"("tenantId", "turmaId");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_eventId_idx" ON "MediaAsset"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationPreference_tenantId_idx" ON "NotificationPreference"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "FinancialCharge_tenantId_status_idx" ON "FinancialCharge"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinancialCharge_tenantId_studentId_idx" ON "FinancialCharge"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "FinancialChargeAudit_tenantId_chargeId_idx" ON "FinancialChargeAudit"("tenantId", "chargeId");

-- CreateIndex
CREATE INDEX "ExerciseLibraryItem_tenantId_archived_idx" ON "ExerciseLibraryItem"("tenantId", "archived");

-- CreateIndex
CREATE INDEX "ExerciseLibraryItem_tenantId_ownerStaffId_idx" ON "ExerciseLibraryItem"("tenantId", "ownerStaffId");

-- CreateIndex
CREATE INDEX "ExerciseLibraryItem_tenantId_name_idx" ON "ExerciseLibraryItem"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_accountUserId_fkey" FOREIGN KEY ("accountUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlan" ADD CONSTRAINT "IndividualPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlan" ADD CONSTRAINT "IndividualPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlan" ADD CONSTRAINT "IndividualPlan_assignedProfessionalId_fkey" FOREIGN KEY ("assignedProfessionalId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlan" ADD CONSTRAINT "IndividualPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlanSession" ADD CONSTRAINT "IndividualPlanSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "IndividualPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlanExercise" ADD CONSTRAINT "IndividualPlanExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IndividualPlanSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlanAudit" ADD CONSTRAINT "IndividualPlanAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlanAudit" ADD CONSTRAINT "IndividualPlanAudit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "IndividualPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualPlanAudit" ADD CONSTRAINT "IndividualPlanAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaScheduleAudit" ADD CONSTRAINT "TurmaScheduleAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaScheduleAudit" ADD CONSTRAINT "TurmaScheduleAudit_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaScheduleAudit" ADD CONSTRAINT "TurmaScheduleAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAudit" ADD CONSTRAINT "CalendarEventAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAudit" ADD CONSTRAINT "CalendarEventAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAudit" ADD CONSTRAINT "CalendarEventAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventTurma" ADD CONSTRAINT "CalendarEventTurma_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventTurma" ADD CONSTRAINT "CalendarEventTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceReopenAudit" ADD CONSTRAINT "AttendanceReopenAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceReopenAudit" ADD CONSTRAINT "AttendanceReopenAudit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceReopenAudit" ADD CONSTRAINT "AttendanceReopenAudit_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeletionAudit" ADD CONSTRAINT "StudentDeletionAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeletionAudit" ADD CONSTRAINT "StudentDeletionAudit_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHealthAudit" ADD CONSTRAINT "StudentHealthAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHealthAudit" ADD CONSTRAINT "StudentHealthAudit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHealthAudit" ADD CONSTRAINT "StudentHealthAudit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunicationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTagStudent" ADD CONSTRAINT "MediaTagStudent_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTagStudent" ADD CONSTRAINT "MediaTagStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCharge" ADD CONSTRAINT "FinancialCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCharge" ADD CONSTRAINT "FinancialCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialChargeAudit" ADD CONSTRAINT "FinancialChargeAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialChargeAudit" ADD CONSTRAINT "FinancialChargeAudit_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "FinancialCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialChargeAudit" ADD CONSTRAINT "FinancialChargeAudit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLibraryItem" ADD CONSTRAINT "ExerciseLibraryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLibraryItem" ADD CONSTRAINT "ExerciseLibraryItem_ownerStaffId_fkey" FOREIGN KEY ("ownerStaffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
