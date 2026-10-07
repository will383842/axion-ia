-- Réseau d'apporteurs : une commission pas encore facturée peut être ANNULÉE (commande annulée,
-- prestation non réalisée, présentation démentie ou frauduleuse). La ligne reste en base.
-- Ajout seul d'une valeur ; admis dans une transaction depuis PostgreSQL 12.
ALTER TYPE "statut_commission_apporteur" ADD VALUE 'annulee';
