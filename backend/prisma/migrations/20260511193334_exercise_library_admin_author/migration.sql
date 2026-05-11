-- ExerciseLibraryItem: torna ownerStaffId nullable e adiciona createdByUserId
-- (autor real — qualquer User, inclusive ADMIN sem StaffProfile — RN-1311).

-- DropForeignKey (vamos recriar com onDelete: SetNull)
ALTER TABLE "ExerciseLibraryItem" DROP CONSTRAINT "ExerciseLibraryItem_ownerStaffId_fkey";

-- AlterTable: ownerStaffId vira nullable
ALTER TABLE "ExerciseLibraryItem" ALTER COLUMN "ownerStaffId" DROP NOT NULL;

-- AlterTable: cria createdByUserId nullable temporariamente para permitir backfill
ALTER TABLE "ExerciseLibraryItem" ADD COLUMN "createdByUserId" TEXT;

-- Backfill: copia userId do StaffProfile correspondente ao ownerStaffId.
-- Itens anteriores sempre tinham ownerStaffId (NOT NULL na versão antiga),
-- então isso preenche todos os registros existentes.
UPDATE "ExerciseLibraryItem" e
SET "createdByUserId" = sp."userId"
FROM "StaffProfile" sp
WHERE sp."id" = e."ownerStaffId";

-- Promove createdByUserId para NOT NULL após o backfill
ALTER TABLE "ExerciseLibraryItem" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- Recria FK do ownerStaffId com onDelete: SetNull
ALTER TABLE "ExerciseLibraryItem"
  ADD CONSTRAINT "ExerciseLibraryItem_ownerStaffId_fkey"
  FOREIGN KEY ("ownerStaffId") REFERENCES "StaffProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Cria FK do createdByUserId (User) — Restrict para não apagar autor com itens
ALTER TABLE "ExerciseLibraryItem"
  ADD CONSTRAINT "ExerciseLibraryItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice para consultas por autor
CREATE INDEX "ExerciseLibraryItem_tenantId_createdByUserId_idx"
  ON "ExerciseLibraryItem"("tenantId", "createdByUserId");
