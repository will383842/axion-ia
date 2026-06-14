# Runbook — Parcours AFEST 1-to-1 (exploitation)

## Créer un parcours AFEST et produire le dossier
1. **Espace formateur** : le coach crée une séance/parcours 1-to-1 (`/espace-formateur`), renseigne la **cartographie** (≥1 tâche), les **optimisations**, le **plan**, et pour chaque séance un **compte-rendu** avec **durée (min)**, **mises en situation** et **phases réflexives** (obligatoires pour l'alternance AFEST).
2. **Console admin coaching** (`/[adminPrefix]/coaching/seances/[id]`) → panneau **AFEST · documents légaux** (`AfestPanel`) :
   - **Cadrage** : cocher « Parcours cadré en AFEST », saisir **heures prévues (convention)** + **tuteur entreprise** → *Enregistrer le cadrage*.
   - **Générer le protocole AFEST** (doc `AXI-FORM-…`).
   - Passer la séance à **« réalisée »** une fois les comptes-rendus saisis.
   - **Générer l'attestation en heures** (= Σ des durées de séance ; complète ≥80 % / partielle 60-79 % / aucune <60 %).
3. **Heures réelles** = somme des `CompteRenduSeance.dureeMinutes` (jamais `Formation.dureeHeures × taux`).
4. **Facture OPCO** : *(actuellement service `genererFactureCoaching` non câblé à l'UI — cf. défaut D-03)*.

## Où sont les documents
- Tous les PDF officiels → table `DocumentGenere` (rattachés via `coachingSessionId`), numéro immuable `AXI-…`, QR de vérification, archivés R2, **rétention 5 ans** (`suppressionPrevueAt`).
- Visibles dans le panneau AFEST (liste + lien PDF) et dans le **mode auditeur** (`evaluerConformite` / `genererManifesteAudit`).

## À vérifier avant un audit Qualiopi
- off.**28** (AFEST) « couvert » avec preuve (≥1 parcours réalisé avec cartographie + alternance + évaluation).
- ⚠️ off.13/14/15 sont des indicateurs **apprentissage (CFA)** — ils NE doivent PAS apparaître couverts par l'AFEST (cf. défaut D-01 à corriger).
- Attestation : heures = Σ séances, mention L.6353-1/D.6353-1, QR vérifiable.
- Facture : exonération TVA 261-4-4°, subrogation + n° dossier OPCO si applicable.
- Mentions légales : NDA / Qualiopi / SIRET renseignés dans `SiteSetting` cat. `qualiopi`.

## Rejouer la vérification end-to-end (DB jetable)
```bash
# 1. DB jetable pgvector
docker run -d --name qualiopi-e2e -e POSTGRES_PASSWORD=e2e -e POSTGRES_USER=e2e -e POSTGRES_DB=e2e -p 55433:5432 pgvector/pgvector:pg16
# 2. migrations + fixture + chaîne
export DATABASE_URL="postgresql://e2e:e2e@localhost:55433/e2e?schema=public"; export DIRECT_URL="$DATABASE_URL"; export SKIP_ENV_VALIDATION=true
pnpm exec prisma migrate deploy
pnpm exec tsx scripts/qualiopi/e2e-afest-verif.ts   # → _AUDIT/VERIF-.../e2e-results.json + pdf/
docker rm -f qualiopi-e2e
```

## Flags d'enforcement (SiteSetting cat. qualiopi — à activer post-certificateur)
`afest_perimetre_certifie` · `afest_tuteur_obligatoire` · `afest_formateur_habilitation_requise` · `afest_seuil_heures_min` — tous `false`/0 par défaut.
