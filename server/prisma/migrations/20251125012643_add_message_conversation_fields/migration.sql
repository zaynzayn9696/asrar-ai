/*
  Warnings:

  - Added the required column `conversationId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmotionLabel" AS ENUM ('NEUTRAL', 'SAD', 'ANXIOUS', 'ANGRY', 'LONELY', 'STRESSED', 'HOPEFUL', 'GRATEFUL');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "conversationId" INTEGER NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "characterId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEmotion" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "primaryEmotion" "EmotionLabel" NOT NULL,
    "intensity" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "cultureTag" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEmotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationEmotionState" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "dominantEmotion" "EmotionLabel" NOT NULL,
    "avgIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sadnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anxietyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "angerScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lonelinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationEmotionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmotionalTimelineEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "emotion" "EmotionLabel" NOT NULL,
    "intensity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tag" TEXT,

    CONSTRAINT "EmotionalTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEmotionProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sadnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anxietyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "angerScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lonelinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hopeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gratitudeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEmotionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationStateMachine" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "currentState" TEXT NOT NULL,
    "lastEmotion" "EmotionLabel" NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ConversationStateMachine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageEmotion_messageId_key" ON "MessageEmotion"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationEmotionState_conversationId_key" ON "ConversationEmotionState"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEmotionProfile_userId_key" ON "UserEmotionProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationStateMachine_conversationId_key" ON "ConversationStateMachine"("conversationId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEmotion" ADD CONSTRAINT "MessageEmotion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEmotionState" ADD CONSTRAINT "ConversationEmotionState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionalTimelineEvent" ADD CONSTRAINT "EmotionalTimelineEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionalTimelineEvent" ADD CONSTRAINT "EmotionalTimelineEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmotionProfile" ADD CONSTRAINT "UserEmotionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationStateMachine" ADD CONSTRAINT "ConversationStateMachine_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
