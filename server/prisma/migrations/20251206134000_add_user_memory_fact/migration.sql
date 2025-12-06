-- CreateTable
CREATE TABLE "UserMemoryFact" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sourceMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMemoryFact_userId_kind_idx" ON "UserMemoryFact"("userId", "kind");

-- AddForeignKey
ALTER TABLE "UserMemoryFact" ADD CONSTRAINT "UserMemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMemoryFact" ADD CONSTRAINT "UserMemoryFact_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
