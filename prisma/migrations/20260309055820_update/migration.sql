/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `system_embeddings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "system_embeddings_userId_key" ON "system_embeddings"("userId");
