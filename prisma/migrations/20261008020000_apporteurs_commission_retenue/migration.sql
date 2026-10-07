-- Réseau d'apporteurs : commission facturée mais RETENUE pour manquement ou fraude (art. 4.5 bis),
-- neutralisée par un avoir. Ajout seul d'une valeur ; admis dans une transaction depuis PostgreSQL 12.
ALTER TYPE "statut_commission_apporteur" ADD VALUE 'retenue';
