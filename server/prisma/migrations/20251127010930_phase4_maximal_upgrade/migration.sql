-- CreateEnum
CREATE TYPE "EmotionTrend" AS ENUM ('UP', 'DOWN', 'STABLE', 'VOLATILE');

-- CreateEnum
CREATE TYPE "UserMemoryMode" AS ENUM ('LIGHT', 'STANDARD', 'RICH');

-- AlterTable
ALTER TABLE "ConversationEmotionState" ADD COLUMN     "activeThreads" JSONB,
ADD COLUMN     "currentBaselineEmotion" "EmotionLabel",
ADD COLUMN     "flags" JSONB,
ADD COLUMN     "lastKernelUpdateAt" TIMESTAMP(3),
ADD COLUMN     "rollingEmotionStats" JSONB,
ADD COLUMN     "rollingTopicStats" JSONB,
ADD COLUMN     "sessionBaselineEmotion" "EmotionLabel",
ADD COLUMN     "stabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "windowSize" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "MessageEmotion" ADD COLUMN     "detectorVersion" TEXT,
ADD COLUMN     "emotionVector" JSONB,
ADD COLUMN     "intensityDelta" DOUBLE PRECISION,
ADD COLUMN     "isKernelRelevant" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "secondaryEmotion" "EmotionLabel",
ADD COLUMN     "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "trend" "EmotionTrend";

-- AlterTable
ALTER TABLE "UserEmotionProfile" ADD COLUMN     "emotionStats" JSONB,
ADD COLUMN     "emotionTraitVector" JSONB,
ADD COLUMN     "lastPatternRefreshAt" TIMESTAMP(3),
ADD COLUMN     "memoryMode" "UserMemoryMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "personaAffinity" JSONB,
ADD COLUMN     "recentKernelSnapshot" JSONB,
ADD COLUMN     "retentionPolicy" JSONB,
ADD COLUMN     "topicProfile" JSONB,
ADD COLUMN     "volatilityIndex" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmotionalPattern" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "EmotionalPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmotionalPattern_userId_idx" ON "EmotionalPattern"("userId");

-- CreateIndex
CREATE INDEX "EmotionalPattern_userId_kind_idx" ON "EmotionalPattern"("userId", "kind");

-- AddForeignKey
ALTER TABLE "EmotionalPattern" ADD CONSTRAINT "EmotionalPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
