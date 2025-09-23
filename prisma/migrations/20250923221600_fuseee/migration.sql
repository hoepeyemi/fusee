/*
  Warnings:

  - A unique constraint covering the columns `[multisigPda]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[multisigCreateKey]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "multisig_members" DROP CONSTRAINT "multisig_members_multisigId_fkey";

-- AlterTable
ALTER TABLE "multisig_members" ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "multisigId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hasMultisig" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "multisigCreateKey" TEXT,
ADD COLUMN     "multisigPda" TEXT,
ADD COLUMN     "multisigThreshold" INTEGER,
ADD COLUMN     "multisigTimeLock" INTEGER DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "users_multisigPda_key" ON "users"("multisigPda");

-- CreateIndex
CREATE UNIQUE INDEX "users_multisigCreateKey_key" ON "users"("multisigCreateKey");

-- AddForeignKey
ALTER TABLE "multisig_members" ADD CONSTRAINT "multisig_members_multisigId_fkey" FOREIGN KEY ("multisigId") REFERENCES "multisigs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multisig_members" ADD CONSTRAINT "multisig_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
