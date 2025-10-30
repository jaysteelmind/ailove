-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bio" TEXT,
    "photos" TEXT[],
    "preferences" JSONB NOT NULL,
    "know_you_meter_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_traits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "trait" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "matched_user_id" TEXT NOT NULL,
    "rbs_score" DOUBLE PRECISION NOT NULL,
    "sr_score" DOUBLE PRECISION NOT NULL,
    "cu_score" DOUBLE PRECISION NOT NULL,
    "ig_score" DOUBLE PRECISION NOT NULL,
    "sc_score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "viewed_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "extracted_traits" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "location" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "feedback_rating" INTEGER,
    "feedback_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causal_uplift_models" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "model_data" BYTEA NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "trained_on" INTEGER NOT NULL,
    "deployed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "causal_uplift_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_traits_user_id_dimension_trait_key" ON "user_traits"("user_id", "dimension", "trait");

-- CreateIndex
CREATE INDEX "matches_user_id_status_idx" ON "matches"("user_id", "status");

-- CreateIndex
CREATE INDEX "matches_matched_user_id_status_idx" ON "matches"("matched_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matches_user_id_matched_user_id_key" ON "matches"("user_id", "matched_user_id");

-- CreateIndex
CREATE INDEX "messages_user_id_created_at_idx" ON "messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "dates_user_id_status_idx" ON "dates"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "causal_uplift_models_version_key" ON "causal_uplift_models"("version");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_traits" ADD CONSTRAINT "user_traits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_matched_user_id_fkey" FOREIGN KEY ("matched_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
