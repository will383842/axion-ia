-- Add un_a_un value to ServiceSector enum (4e verticale accompagnement individuel).
-- PostgreSQL: ADD VALUE is non-destructive, no data loss, no lock on existing rows.

ALTER TYPE "ServiceSector" ADD VALUE 'un_a_un';
