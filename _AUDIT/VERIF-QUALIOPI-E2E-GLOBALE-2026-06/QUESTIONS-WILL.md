# QUESTIONS-WILL — Décisions produit & valeurs légales à saisir

> Ces points NE sont PAS des bugs : ce sont des décisions produit en attente ou des valeurs
> légales que seul Will peut renseigner. L'autopilot ne les a volontairement PAS modifiés.

## A. Décisions produit (questions fermées)

1. **Anti-hallucination bloquante ?** (F1, déjà ouverte) — Le worker détecte les allégations non
   sourcées mais émet seulement un `console.warn` (`qualiopi-formation-engine-worker.ts:839-844`),
   sans bloquer ni marquer en DB. ➜ **Veux-tu que la détection BLOQUE la publication** (ou pose un
   flag `aiUnsourcedClaims` visible par le validateur humain), ou rester en warning-only V1 ?

2. **Gate qualité ≥80 à la publication ?** — Aujourd'hui, après `nbPassesMax` passes de refine, le
   contenu sous-seuil **progresse** vers la validation humaine (`…worker.ts:1122-1133`, warn-only) ;
   `publishFormationAction` exige `validatedBy` + ratio pratique mais **ne lit aucun score qualité**.
   Donc un humain PEUT publier une formation que l'IA a scorée < 80. ➜ **Le score < 80 doit-il
   bloquer dur la publication**, ou la **validation humaine** reste-t-elle le garde-fou suffisant
   (auquel cas on recommande au minimum d'**afficher le score** au validateur) ?

3. **off.29 (insertion professionnelle) applicabilité** — couvert par un proxy faux
   (`nbSessionsRealisees>0`, `conformite-service.ts:311`), sans aucune donnée de suivi post-formation.
   ➜ **off.29 est-il applicable à Axion-IA** (formations non certifiantes → souvent N/A) ? Si oui,
   faut-il un module de suivi d'insertion ? Sinon, on le bascule en `non_applicable` (pas « couvert »).

4. **off.20 (personnel dédié handicap)** — proxy déduit de la présence de stagiaires handicap.
   ➜ Couvrir off.20 via la **déclaration explicite d'un personnel/référent dédié** (déjà en config) ?

5. **Politique de clôture émargement** (F2/R1) — la transition manuelle ET désormais le cron
   refusent de clôturer « réalisée » sans aucun émargement. ➜ **OK pour bloquer** (choix retenu par
   l'autopilot), ou préfères-tu auto-clôturer + alerte a posteriori ?

6. **Polices PDF** — Fraunces/Manrope/Inconsolata absentes de `public/fonts/` → fallback Geist.
   ➜ Ajouter les `.ttf` au repo/image, ou **assumer Geist** (cosmétique) ?

7. **Veille handicap** — pas de type `Veille` dédié (noyé dans `pedagogique`). ➜ Ajouter un type ?

## B. Valeurs légales à saisir (console `/qualiopi/config` — DONNÉE-À-SAISIR, pas des bugs)

Tant que ces clés sont vides, l'ouverture publique (`OF_PUBLIC_DISCLOSURE_ENABLED=true`) reste à éviter.

- `nda_numero` (n° déclaration d'activité DREETS), `qualiopi_numero`, `qualiopi_validite`, `qualiopi_organisme`
- `siret`, `raison_sociale`, `adresse_siege`, `adresse_exercice`, `dirigeant_nom`, `dirigeant_fonction`
- `referent_handicap_email`, `referent_handicap_telephone` (le `nom` a un défaut « Williams Jullin »)
- Barèmes OPCO par branche : `opco_atlas_intra_horaire`, `opco_atlas_inter_presentiel`,
  `opco_atlas_inter_distanciel`, `opco_atlas_plafond_annuel` (+ autres OPCO par dossier)
- `cpf_reste_a_charge` (défaut 103,20 €), `smic_horaire_brut`
- Codes **RS/RNCP** + `cpfEligible` par formation certifiante (par dossier)
- `bpf_annee_deposee` (après dépôt DREETS annuel)
- IBAN/RIB facture, logo (`logo_url`), `site_url`

## C. Point d'exploitation

- **Premier boot prod** : avec le fix du seed auto (P0), le référentiel se peuple SEUL au boot
  (offres + config + grilles). `pnpm qualiopi:seed` manuel n'est **plus nécessaire** (mais reste dispo).
- **RGPD / rétention PDF** : après anonymisation d'un stagiaire, ses PDF (conventions/factures) gardent
  son nom (obligation comptable 10 ans). ➜ À **acter dans le registre des traitements** (justification
  art. 17§3b). L'export RGPD d'un stagiaire anonymisé ré-expose ces PDF — comportement à documenter.
