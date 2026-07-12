# Runbook — Hub Facturation unifié (5 activités)

> Chantier 2026-07-12 (branche `feat/facturation-unifiee`, 7 phases). Plan :
> `_PLANS/PLAN-FACTURATION-UNIFIEE-2026-07-12.md`. Écran : admin → Qualiopi →
> Commercial → **Facturation (Hub)**, gaté par `FACTURATION_HUB_ENABLED=true`
> (env Coolify, run scope, restart).

## Règles produit (non négociables)

- **Aucun email client automatique.** Les crons détectent (retards, devis sans
  réponse, brouillons récurrents) et PROPOSENT ; l'envoi = clic admin. Un test
  garde-fou (`relances-manuelles-garde-fou.spec.ts`) casse la CI si un envoi
  auto réapparaît.
- **Une facture émise ne se modifie jamais** : correction = avoir (total ou
  partiel), PDF servi depuis l'archive R2 (jamais régénéré).
- **Prix jamais en dur** : catalogue `pricing.ts`, paramètres `SiteSetting`,
  identité/IBAN `legal_overrides`.

## Mise en service (une fois)

1. Console admin → settings → `legal_overrides` : renseigner `siren`, `siret`,
   `vatNumber`, `capitalSocial`, `rcsVille`, `addressSiege` (+ structurée :
   `addressStreet`/`addressPostalCode`/`addressCity`), **`iban`**, **`bic`**,
   `bankAccountHolder` → mentions légales + RIB sur TOUTES les factures.
2. Qualiopi → paramètres : `regime_tva` (assujetti tant que l'attestation
   261-4-4° n'est pas obtenue), `delai_paiement_jours` (30),
   `delai_paiement_financeur_jours` (45).
3. Coolify : `FACTURATION_HUB_ENABLED=true` + restart.
4. Réforme 2026 : s'inscrire à une Plateforme Agréée gratuite (réception,
   avant le 1/9/2026). Émission (1/9/2027) : choisir la PA puis implémenter
   son adaptateur (`e-invoicing/pa-adapter.ts`, interface figée).

## Opérations courantes

- **Devis** : Qualiopi → Devis → nouveau (activité + lignes + TVA/ligne +
  réf. commande). « Envoyer » génère le PDF (bloc Bon pour accord) + signature
  DocuSeal si configurée (`DOCUSEAL_DEVIS_TEMPLATE_ID`). Révision = nouveau
  devis lié, l'ancien expire à l'envoi.
- **Facturer un devis accepté** : `genererFactureDepuisDevisAction` (Hub).
  Client secteur public → alerte **Chorus Pro** (dépôt manuel sur
  chorus-pro.gouv.fr, obligation en vigueur).
- **Encaissement** (virement/chèque/espèces, partiel OK) :
  `enregistrerPaiementFactureAction` — statut recalculé, dossier de
  financement soldé automatiquement quand toutes ses factures sont payées.
- **Paiement OPCO reçu** : saisir l'encaissement sur la facture subrogée →
  le dossier passe `paiement_recu`.
- **Avoir** : `genererAvoirAction` (motif ≥ 5 caractères ; partiel = montant
  HT ; plafond = restant rectifiable).
- **Relances** : Hub → « Relances à traiter » → Envoyer (email + PDF joint,
  message éditable) / Ignorer / Reporter 7 j.
- **Récurrent** : `creerPlanRecurrentAction` (gabarit lignes + périodicité).
  Chaque brouillon généré (cron 05:00 UTC + Telegram) s'émet par
  `emettreFactureBrouillonAction` puis s'envoie manuellement.
- **Reprise d'historique** : `importerFacturesHistoriqueAction` (max 500/lot,
  numéros AXI-\* refusés, idempotent).
- **Export comptable** : CSV (`exportComptaCsvAction`) + **FEC**
  (`exporterFecAction({annee})` → `AXIONIA_FEC_{annee}.txt`, partie double
  vérifiée par test). Rôle lecture seule (comptable) : `reader`.

## Cycle dossier de financement

`a_monter → envoye → accord_recu → facture → paiement_recu → clos`
(refus : `envoye → refuse → clos|envoye`). Transitions manuelles
(`transitionnerDossierAction`), montant reçu dérivé des Payment (jamais saisi).

## Surveillance

- Cron 06:30 UTC : factures en retard (statut seul) + relances proposées.
- Cron 05:00 UTC : brouillons récurrents.
- Telegram interne : relances J15/J30 à traiter, brouillons à valider.
- ⚠️ Après tout deploy à migrations : vérifier `_prisma_migrations` (échec
  silencieux connu). 4 migrations de ce chantier : 20260712120000/140000/
  160000/180000/200000.
