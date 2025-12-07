-- CreateTable
CREATE TABLE "UserPersonaTrust" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "personaId" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustLevel" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "distinctDaysCount" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3),
    "lastWhisperUnlockedAt" TIMESTAMP(3),

    CONSTRAINT "UserPersonaTrust_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaWhisper" (
    "id" SERIAL NOT NULL,
    "personaId" TEXT NOT NULL,
    "levelRequired" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "contentTemplate" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "tags" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PersonaWhisper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserUnlockedWhisper" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "personaId" TEXT NOT NULL,
    "whisperId" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstRevealedAt" TIMESTAMP(3),

    CONSTRAINT "UserUnlockedWhisper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmotionalEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "personaId" TEXT NOT NULL,
    "conversationId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dominantEmotion" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL,
    "valence" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tags" JSONB,

    CONSTRAINT "EmotionalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmotionalDailySummary" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "personaId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "topEmotion" TEXT,
    "avgIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emotionCounts" JSONB,
    "firstMessageAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "voiceMessageCount" INTEGER NOT NULL DEFAULT 0,
    "whisperUnlockCount" INTEGER NOT NULL DEFAULT 0,
    "mirrorSessionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EmotionalDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MirrorSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "personaId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rangeDays" INTEGER NOT NULL,
    "summaryText" TEXT NOT NULL,
    "dominantTrend" TEXT,

    CONSTRAINT "MirrorSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPersonaTrust_userId_personaId_idx" ON "UserPersonaTrust"("userId", "personaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonaTrust_userId_personaId_key" ON "UserPersonaTrust"("userId", "personaId");

-- CreateIndex
CREATE INDEX "UserUnlockedWhisper_userId_personaId_idx" ON "UserUnlockedWhisper"("userId", "personaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUnlockedWhisper_userId_whisperId_key" ON "UserUnlockedWhisper"("userId", "whisperId");

-- CreateIndex
CREATE INDEX "EmotionalEvent_userId_personaId_timestamp_idx" ON "EmotionalEvent"("userId", "personaId", "timestamp");

-- CreateIndex
CREATE INDEX "EmotionalEvent_userId_timestamp_idx" ON "EmotionalEvent"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "EmotionalDailySummary_userId_personaId_date_idx" ON "EmotionalDailySummary"("userId", "personaId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmotionalDailySummary_userId_personaId_date_key" ON "EmotionalDailySummary"("userId", "personaId", "date");

-- CreateIndex
CREATE INDEX "MirrorSession_userId_personaId_generatedAt_idx" ON "MirrorSession"("userId", "personaId", "generatedAt");

-- AddForeignKey
ALTER TABLE "UserPersonaTrust" ADD CONSTRAINT "UserPersonaTrust_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnlockedWhisper" ADD CONSTRAINT "UserUnlockedWhisper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnlockedWhisper" ADD CONSTRAINT "UserUnlockedWhisper_whisperId_fkey" FOREIGN KEY ("whisperId") REFERENCES "PersonaWhisper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionalEvent" ADD CONSTRAINT "EmotionalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionalEvent" ADD CONSTRAINT "EmotionalEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmotionalDailySummary" ADD CONSTRAINT "EmotionalDailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MirrorSession" ADD CONSTRAINT "MirrorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
