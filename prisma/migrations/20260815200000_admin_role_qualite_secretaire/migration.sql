-- Deux roles metier qui rendent la matrice d'habilitation EXPRIMABLE.
--
-- Jusqu'ici il n'existait aucun role pour la personne qui gere le dossier sans
-- engager l'organisme : la seule facon de lui donner acces etait `editor`, qui
-- pouvait attester, facturer, conclure un devis et habiliter un formateur.
--
-- AJOUT EN FIN d'enumeration (pas de BEFORE/AFTER) : reordonner un type Postgres
-- change le sens de tout tri par rang, en silence.
--
-- `IF NOT EXISTS` : la migration doit pouvoir rejouer sur une base ou un deploy
-- partiel aurait deja pose l'une des deux valeurs.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'responsable_qualite';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'secretaire';
