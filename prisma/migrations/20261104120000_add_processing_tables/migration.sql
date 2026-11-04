-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL,
    "job_type" VARCHAR(50) NOT NULL,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "lease_expires_at" TIMESTAMPTZ(6),
    "worker_id" VARCHAR(100),
    "error_details" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "stream_name" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_imports" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "file_key" VARCHAR(500) NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "file_format" VARCHAR(10) NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'UPSERT',
    "default_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "default_inventory" INTEGER NOT NULL DEFAULT 25,
    "status" VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    "total_groups" INTEGER NOT NULL DEFAULT 0,
    "processed_groups" INTEGER NOT NULL DEFAULT 0,
    "successful_groups" INTEGER NOT NULL DEFAULT 0,
    "failed_groups" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "error_report_key" VARCHAR(500),
    "created_by" VARCHAR(100) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_import_groups" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "group_index" INTEGER NOT NULL,
    "external_ref" VARCHAR(255),
    "slug" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "action" VARCHAR(20) NOT NULL DEFAULT 'SKIPPED',
    "row_count" INTEGER NOT NULL DEFAULT 1,
    "product_id" VARCHAR(100),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_import_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_import_issues" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "group_id" UUID,
    "row_number" INTEGER NOT NULL,
    "level" VARCHAR(10) NOT NULL DEFAULT 'ERROR',
    "code" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "field" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_import_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_import_assets" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "group_id" UUID,
    "source_url" TEXT NOT NULL,
    "target_scope" VARCHAR(20) NOT NULL,
    "target_identifier" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "storage_key" VARCHAR(500),
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_import_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_external_references" (
    "id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
    "external_id" VARCHAR(255) NOT NULL,
    "product_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_external_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_processing_jobs_status_priority" ON "processing_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_processing_jobs_created_at" ON "processing_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_product_imports_status" ON "product_imports"("status");

-- CreateIndex
CREATE INDEX "idx_product_imports_file_hash" ON "product_imports"("file_hash");

-- CreateIndex
CREATE INDEX "idx_product_imports_created_by" ON "product_imports"("created_by");

-- CreateIndex
CREATE INDEX "idx_product_imports_created_at" ON "product_imports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_product_import_groups_import_status" ON "product_import_groups"("import_id", "status");

-- CreateIndex
CREATE INDEX "idx_product_import_groups_slug" ON "product_import_groups"("slug");

-- CreateIndex
CREATE INDEX "idx_product_import_groups_external_ref" ON "product_import_groups"("external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_import_group_index" ON "product_import_groups"("import_id", "group_index");

-- CreateIndex
CREATE INDEX "idx_product_import_issues_import" ON "product_import_issues"("import_id");

-- CreateIndex
CREATE INDEX "idx_product_import_issues_group" ON "product_import_issues"("group_id");

-- CreateIndex
CREATE INDEX "idx_product_import_issues_level" ON "product_import_issues"("level");

-- CreateIndex
CREATE INDEX "idx_product_import_assets_import" ON "product_import_assets"("import_id");

-- CreateIndex
CREATE INDEX "idx_product_import_assets_status" ON "product_import_assets"("status");

-- CreateIndex
CREATE INDEX "idx_product_external_ref_product" ON "product_external_references"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_external_ref" ON "product_external_references"("source", "external_id");

-- AddForeignKey
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "processing_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_import_groups" ADD CONSTRAINT "product_import_groups_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "product_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_import_issues" ADD CONSTRAINT "product_import_issues_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "product_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_import_issues" ADD CONSTRAINT "product_import_issues_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_import_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_import_assets" ADD CONSTRAINT "product_import_assets_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "product_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_import_assets" ADD CONSTRAINT "product_import_assets_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_import_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
