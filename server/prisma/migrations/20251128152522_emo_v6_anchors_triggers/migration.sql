-- AlterTable
ALTER TABLE "UserEmotionProfile" ADD COLUMN     "emotionalAnchors" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "EmotionalTriggerEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER,
    "type" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmotionalTriggerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmotionalTriggerEvent_userId_createdAt_idx" ON "EmotionalTriggerEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmotionalTriggerEvent_conversationId_createdAt_idx" ON "EmotionalTriggerEvent"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmotionalTriggerEvent" ADD CONSTRAINT "EmotionalTriggerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionalTriggerEvent" ADD CONSTRAINT "EmotionalTriggerEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
