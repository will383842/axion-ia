-- Type de rendez-vous « Tour de France IA » (visio de 30 min, 2026-10-25).
-- Valeur d'enum AJOUTÉE seulement : rien n'est lu ni retiré. Les lignes
-- existantes (classées `autre` ou NULL) ne bougent pas.
ALTER TYPE "type_rendez_vous" ADD VALUE IF NOT EXISTS 'tour_de_france_ia';
