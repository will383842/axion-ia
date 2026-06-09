-- Candidature : photo OPTIONNELLE + prétention de revenus OPTIONNELLE.
ALTER TABLE "job_applications" ADD COLUMN "photo_storage_path" VARCHAR(255);
ALTER TABLE "job_applications" ADD COLUMN "photo_original_name" VARCHAR(255);
ALTER TABLE "job_applications" ADD COLUMN "photo_mime_type" VARCHAR(100);
ALTER TABLE "job_applications" ADD COLUMN "salary_expectation" VARCHAR(80);
