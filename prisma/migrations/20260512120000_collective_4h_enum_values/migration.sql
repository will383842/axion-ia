-- Will (audit /interventions 2026-05-12) — ajout des 2 valeurs enum pour
-- les formations 4 h à prix fixe 390 € (`demarrage_ia_express` + `atelier_ia_cible`).
-- Bug constaté : les pages détail de ces 2 formations câblaient leurs CTAs sur
-- /interventions/demande (formulaire) alors que le prix est fixe → elles
-- devraient être bookables direct sur le calendrier comme les autres formats
-- à prix fixe (Essentielle, Approfondie, Gagner du temps, Productivité
-- dirigeant, Audit Flash terrain).
--
-- Postgres ALTER TYPE ADD VALUE — non transactionnel mais sûr (ajout enum
-- instantané, pas de lock long, pas de migration data, totalement additif).

ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'demarrage_ia_express';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'atelier_ia_cible';
