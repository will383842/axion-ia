# Audit du moteur d'alertes Qualiopi — 2026-09-04

> Rendu par un agent d'audit **tué en pleine session** le 2026-09-04 à 23:43.
> Le rapport, lui, était terminé : il est repris ici mot pour mot. Il est la
> source du lot D. Ne pas repayer cet audit.

# Audit du moteur d'alertes Qualiopi

Périmètre lu : `catalogue.ts` (1065 l.), `evaluateur.ts` (3201 l.), `routage.ts`, `alertes-service.ts`, plus les 8 émetteurs hors balayage. **80 codes au catalogue**, **54 règles** dans `REGLES` (evaluateur.ts:3028-3086).

## 1. Catalogue complet (niveau · déclencheur · auto-résolution)

| Code | Niv. | Déclenche quand | Auto |
|---|---|---|---|
| `referent_handicap_absent` | crit | `referent_handicap_email` vide (evaluateur.ts:124) | oui |
| `responsable_qualite_absent` | imp | `responsable_qualite_email` vide (148) | oui |
| `facture_mentions_legales_absentes` | crit | forme juridique/capital/RCS/TVA absents (307) | oui |
| `categories_certifiees_non_renseignees` | imp | catégories du certificat non saisies (187) | oui |
| `catalogue_certifiant_incoherent` | imp | code RNCP/RS présent, aucune formation « certifiante » (245) | oui |
| `offres_site_non_verifiees` | info | offre active non vérifiée > 30 j (2643) | oui |
| `reclamation_sans_reponse_j15` | crit | réclamation ouverte sans réponse > 15 j (338) | oui |
| `emargement_manquant` | crit | session `realisee` +48 h, inscrit sans aucune trace (375) | oui |
| `session_bloquee_en_cours` | crit | `en_cours`, fin +72 h, 0 trace, ≥1 inscrit (413) | oui |
| `session_sans_dispositif_emargement` | crit | commencée ≤7 j, aucun jeton vivant (642) | oui |
| `emargement_aucune_signature` | crit | jetons vivants, 0 signature, jusqu'à fin+48 h (526) | oui |
| `journee_sans_creneaux` | imp | journée déclarée sans créneau (605) | oui |
| `rappel_j7_non_envoye` | imp | session commencée, `rappelJ7EnvoyeAt` nul (625) | **non** |
| `session_sans_formateur` | imp | J-7→J+365, `formateurPrincipalId` nul (698) | oui |
| `kit_sorties_non_pretes` | imp | J-7, kit publié, sorties absentes ou non relues (760) | oui |
| `diaporama_manquant_session` | imp | J-7, slot `diaporama` sans version courante (838) | oui |
| `session_contact_sur_place_absent` | imp/**info** | J-14, sur_site sans contact/consignes ; distanciel sans contact (944) | oui |
| `positionnement_sans_reponse` | imp | J-2, session `planifiee`, positionnement non répondu (1095) | oui |
| `satisfaction_manquante` | imp | réalisée +7 j, satisfaction à chaud non répondue (1046) | **non** |
| `suivi_froid_manquant` | imp | réalisée entre J+37 et J+120, froid non répondu (1153) | **non** |
| `satisfaction_sous_seuil` | imp | moyenne < `seuil_satisfaction_pct` (1238) | **non** |
| `evaluation_acquis_manquante` | crit | réalisée +2 j, aucune évaluation `finale` (1184) | **non** |
| `attestation_non_envoyee` | imp | réalisée +3 j, `attestationGenereeAt` nul (1213) | **non** |
| `qualiopi_expire_j90` / `_j30` / `_expire` | imp / crit / crit | date `qualiopi_validite` (1284) | oui/oui/**non** |
| `bpf_a_deposer_j60/_j30/_j7/bpf_en_retard` | info/imp/crit/crit | NDA saisi + BPF N-1 non déposé, seuils 1ᵉʳ avr/mai/24 mai/31 mai (1325) | oui |
| `veille_inactive_j45` | imp | dernière veille > 45 j ou aucune (1398) | oui |
| `cv_formateur_perime` | imp | formateur actif, CV > 12 mois ou absent (1421) | oui |
| `sous_traitant_qualiopi_expire` / `_j60` | crit / imp | `sousTraitantVerifieAt` > 12 mois / dans 60 j (1452) | **non** / oui |
| `sous_traitant_contrat_cadre_manquant` | crit | `contratSigneAt` nul (1583) | oui |
| `sous_traitant_rc_pro_absente` / `_expiree` / `_expire_j60` | imp / crit / imp | attestation RC pro (1596-1622) | oui |
| `sous_traitant_verification_annuelle_due` | imp | `prochaineVerifAt` ≤ J+30 (1625) | oui |
| `sous_traitant_incidents_repetes` | imp | ≥2 désistements/annulations tardives en 24 mois (1647) | oui |
| `vigilance_urssaf_absente` / `_perimee` / `_expire_j30` | crit / crit / imp | seuil 5 000 € franchi, attestation absente/périmée/à 30 j (2408) | oui |
| `opco_sans_accord` | imp | J-7, `non_demande`/`demande_en_cours`, dossier ou subrogation (1690) | oui |
| `opco_formation_demarree_sans_accord` | crit | `en_cours` sans accord (1743) | **non** |
| `convention_tripartite_manquante` | crit | subrogation, non signée, J-3, session `planifiee` (1767) | oui |
| `convention_formation_manquante` | crit | planifiee/en_cours/realisee ≤J+5, aucun doc convention/contrat (2495) | oui |
| `facture_impayee_j60` | crit | facture ouverte, échéance +60 j (1821) | oui |
| `facture_impayee_j30` | imp | **plus émis** — conservé pour l'auto-résolution (catalogue.ts:845-864) | oui |
| `facture_sans_echeance` | imp | facture ouverte, `echeanceAt` nul (1874) | oui |
| `relance_sans_effet` | imp | relance `envoyee` +15 j, aucun encaissement depuis (1922) | oui |
| `dossier_financement_sans_reponse` | imp | dossier `envoye` +30 j (2329) | oui |
| `financeur_paiement_en_retard` | crit | accord/facturé, échéance dépassée, non payé (2352) | oui |
| `devis_sans_reponse` / `devis_expire_j7` / `devis_expire` | imp / imp / info | envoyé +7 j / échéance ≤7 j / expiré sans révision (2011-2076) | oui |
| `devis_signe_convention` | imp | devis `accepte` sans session ni parcours (2114) | oui |
| `moteur_assemble_a_publier` | imp | formation `statutGeneration: assemble` (2148) | oui |
| `signature_en_attente` / `signature_contreseing_du` | imp→**crit** | pièce non signée / signée d'un côté, 7 j ou session ≤J+5 (2175, seuil-signature.ts:65) | oui |
| `emails_en_attente_validation` | imp | ≥1 e-mail dans la corbeille (2620) | oui |
| `suppression_rgpd_j30` | **info** | demande de suppression > 30 j (2473) | **non** |
| `revue_trimestrielle_a_faire` | info | aucune revue depuis le trimestre précédent (2554) | oui |
| `bareme_opco_perime` | imp | relevé portail > 12 mois (2587) | oui |
| `formateur_mission_refusee` | crit | mission `refusee`, session future sans principal (2679) | oui |
| `formateur_mission_sans_reponse` | imp→**crit** (≤J-7) | `en_attente`, mi-délai écoulé, session future (2725) | oui |
| `formateur_mission_sans_reponse_delai` | crit | `sans_reponse`, session future, aucune acceptée (2801) | oui |
| `formateur_mission_expiree` | crit | `expiree`, session démarrée, aucune acceptée (2870) | oui |
| `formateur_indisponible_sur_session` | crit | formateur affecté sur ses jours d'indispo (2923) | oui |
| `formateur_non_habilite_assigne` | imp | principal sans habilitation active, session future (2983) | oui |
| **Hors balayage** — `besoin_adaptation_declare` imp (portail.ts:304,383) ; `cloture_trace_presence_incomplete` imp (signal-cloture.ts:62) ; `report_accord_financement_a_refaire` imp (sessions-recurrentes.ts:779) ; `email_rebond_dur` imp (zeptomail/webhook/route.ts:251) ; `formateur_message_apres_delai` imp (message-apres-delai.ts:85) ; `job_ia_echoue` imp (engine-worker.ts:1189,1619) ; `emails_en_echec`, `emails_bloques_en_file`, `emails_sante_non_mesurable`, `emails_rebonds`, `emails_rebonds_non_detectes`, `emails_approuves_abandonnes` crit (health.ts:231-320) | | | **non** (toutes) |

## 2. Les TROUS

1. **Formateur qui accepte puis se désiste la veille — AUCUNE ALERTE.** Le statut `retiree` (mission-formateur.ts:186,306) n'est lu par aucune règle ; l'incident `desistement` (incidents.ts:42) n'alimente que `sous_traitant_incidents_repetes`, qui exige **≥2 faits sur 24 mois** (evaluateur.ts:1660) et regarde en arrière. La session perdue le jour même est muette. → `formateur_desiste_session`, critique, dès qu'une mission `acceptee` bascule ou qu'un incident d'absence vise une session future.
2. **Démarrage sans formateur confirmé — PARTIEL.** `formateur_mission_expiree` (2870) et `session_sans_formateur` (698) couvrent l'expiration et le principal nul. Non couvert : principal affecté **sans mission acceptée** (affectation directe), et mission acceptée puis retirée.
3. **Distanciel sans lien de connexion — AUCUNE.** `TrainingSession.lieuVisioUrl` (schema.prisma) n'apparaît nulle part dans `evaluateur.ts`. `session_contact_sur_place_absent` (944) ne lit que `contactSurPlaceNom/Telephone/consignesAcces` et sort en **`info`** en distanciel (1033). → `session_distanciel_sans_lien`, critique à J-2.
4. **Convention non signée au démarrage — PARTIEL et ambigu.** `convention_formation_manquante` (2495) teste l'**existence** d'un `DocumentGenere` (2517), pas sa signature ; la signature est portée par `signature_en_attente/_contreseing_du`, qui passent bien en critique une fois la session commencée (2239). Mais aucune borne basse.
5. **Stagiaire sans convocation à J-1 — AUCUNE.** `Enrollment.convocationEnvoyeeAt` n'est lu que comme **garde** du rappel J-7 (crons-worker.ts:546-561). → `convocation_stagiaire_manquante`, critique à J-2.
6. **Positionnement jamais répondu — COUVERT** (1095, J-2) mais s'éteint au démarrage (auto, assumé catalogue.ts:517-524). Le complément `positionnement_hors_delai` (satisfaction-service.ts:382) est **hors catalogue** → jamais routé.
7. **Évaluation finale manquante — COUVERT** (1184, critique) mais la condition est `evaluations: { none: { type: "finale" } }` : une ligne suffit à éteindre, alors que le motif catalogue (573) exige une évaluation **validée par un habilité**.
8. **Attestation non délivrée — COUVERT partiellement.** La règle teste `attestationGenereeAt` (1219) = génération ; le titre annonce « non envoyée ». Une attestation générée jamais envoyée est invisible.
9. **Émargement incomplet — TROU RÉEL.** Les quatre règles d'émargement traitent le **zéro** : `sansAucuneTraceDePresence()` (383) et `enrollments: { none: porteUneTraceDePresence() }` (557). Un stagiaire présent 2 jours sur 3 n'est vu par rien avant la clôture (`cloture_trace_presence_incomplete`, signal-cloture.ts:62). → `emargement_partiel`, important, à J+1 sur créneaux non signés.
10. **Facture impayée — COUVERT** à J+60 seulement (1821), J+30 délibérément retiré (catalogue.ts:845-864). Trou voisin : **session réalisée jamais facturée** — aucune règle.
11. **RC pro / vigilance URSSAF périmée — COUVERT UNIQUEMENT pour `statut: "sous_traitant"`** (1546, 2412). Un formateur salarié ou vacataire n'a **aucun** contrôle RC pro ni URSSAF.
12. **Effectif inscrit > effectif prévu — AUCUNE.** `nbParticipantsPrevus` n'est lu par aucune règle (usages : écrans et devis uniquement). → `effectif_depasse`, important.

## 3. Les INCOHÉRENCES

- **Exclusion mutuelle (précédent documenté).** evaluateur.ts:2846-2869 et catalogue.ts:689-703 : `formateur_mission_sans_reponse` exige `en_attente` + `dateDebut > now`, le cron passe la mission en `expiree` **à l'instant du démarrage**, et `session_sans_formateur` exige `formateurPrincipalId: null` que l'expiration ne pose pas. Corrigé par `formateur_mission_expiree`.
- **Alertes qui s'éteignent quand le risque devient un fait — encore ouvertes :**
  - `convention_tripartite_manquante` : `statut: "planifiee"` seul (1770) + `resolutionAuto: true` → la session passe `en_cours`, l'alerte **critique se résout toute seule** alors que la subrogation est perdue. Contraste direct avec `convention_formation_manquante`, qui couvre `planifiee|en_cours|realisee` (2509).
  - `formateur_non_habilite_assigne` : `planifiee` + `dateDebut > now` (2986-2987) → l'alerte ind.21/22 se ferme **le jour où le formateur non habilité anime**.
  - `formateur_indisponible_sur_session` : même borne (2927-2928).
  - `formateur_mission_refusee` (2684) et `_sans_reponse_delai` (2805) : `dateDebut > now`. Au démarrage, seul `session_sans_formateur` reprend — en `important` (729) : **dégradation critique → important au pire moment**.
  - Trou de **24 h** entre `emargement_aucune_signature` (borne `dateFin + 48 h`, 533) et `session_bloquee_en_cours` (`dateFin + 72 h`, 421).
- **Code au catalogue qu'aucune règle n'émet :** `facture_impayee_j30` uniquement — délibéré et documenté (catalogue.ts:845-864).
- **Règles qui émettent un code ABSENT du catalogue — le défaut du 2026-08-05 est revenu, trois fois :** `email_corbeille_indisponible` (queues.ts:717, **critique**), `positionnement_hors_delai` (satisfaction-service.ts:382), `email_retenu_rebond_dur|_desabonne|_oppose` (suppression.ts:165). Conséquence mécanique : `guichetPourCode` rend `undefined` (routage.ts:176) → `sansGuichet` (routage.ts:249) → **aucune boîte**, et absents de `codesAutoResolution` (alertes-service.ts:294) → **ouvertes pour toujours**.
- **Niveaux mal calibrés / divergences catalogue ↔ émission :**
  - `session_sans_formateur` reste `important` même sur « a démarré sans formateur principal » (729-733), tandis que `formateur_mission_expiree` — où l'affectation tient encore — est `critique` (2908).
  - `suppression_rgpd_j30` = **`info`** (catalogue.ts:944) pour un dépassement de délai RGPD opposable.
  - `attestation_non_envoyee` = `important` (droit du stagiaire L.6353-1) sous `evaluation_acquis_manquante` = `critique`.
  - Le catalogue **ment sur trois niveaux** : `session_contact_sur_place_absent` catalogué `important` (501) mais émis `info` en distanciel (1033) ; `formateur_mission_sans_reponse` catalogué `important` (677) émis `critique` à ≤J-7 (2772) ; `signature_*` catalogués `important` (299,305) émis `critique` (2239). Idem titres : `vigilance_urssaf_expire_j30` catalogue « expire dans 30 jours » (246) vs émis « à renouveler sous 30 jours » (2460).
  - **Accumulation infinie** : `emargement_manquant` (379), `satisfaction_manquante` (1050), `evaluation_acquis_manquante` (1188), `attestation_non_envoyee` (1217), `signature_*` (2188) n'ont **aucune borne basse**, contrairement à la doctrine « fenêtre glissante » appliquée cinq fois ailleurs (421, 707, 767, 844, 2510) — et quatre d'entre elles sont `resolutionAuto: false`.

## 4. Alertes à AJOUTER, par priorité

1. `formateur_desiste_session` — critique, mission acceptée annulée/retirée ou incident d'absence sur session future (le seul risque du lot 100 % muet).
2. `convocation_stagiaire_manquante` — critique à J-2 sur `Enrollment.convocationEnvoyeeAt` nul.
3. `session_distanciel_sans_lien` — critique à J-2 sur `lieuVisioUrl` vide quand `lieuType = distanciel`.
4. **Élargir les bornes** de `convention_tripartite_manquante`, `formateur_non_habilite_assigne`, `formateur_indisponible_sur_session` à `en_cours` (ou basculer en `resolutionAuto: false`) : quatre alertes critiques s'auto-effacent au démarrage.
5. **Cataloguer** `email_corbeille_indisponible`, `positionnement_hors_delai`, `email_retenu_*` — sinon elles n'arrivent nulle part et ne se ferment jamais.
6. `emargement_partiel` — important, créneaux non signés sur session en cours.
7. `formateur_rc_pro_absente` / `formateur_vigilance_urssaf` étendues aux formateurs hors `statut: "sous_traitant"`.
8. `effectif_depasse` — important, inscrits actifs > `nbParticipantsPrevus`.
9. `session_realisee_non_facturee` — important, J+15 après clôture.
10. Recalibrer : `session_sans_formateur` en `critique` quand `dateDebut < now` ; `suppression_rgpd_j30` en `important`.

---

La tâche de fond qui tournait s'est terminée : elle confirme le point 3 du rapport.

**Résultat** : sur les codes du catalogue, **`facture_impayee_j30` est le seul orphelin** — aucun émetteur en dehors du catalogue lui-même. C'est bien le cas délibéré et documenté (`catalogue.ts:845-864` : entrée conservée exprès pour que les alertes déjà en base puissent s'auto-résoudre, l'émission ayant été supprimée le 2026-08-02 au profit de la `RelanceProposee` J30).

Deux réserves de méthode sur cette passe de fond, qui ne changent pas la conclusion mais méritent d'être dites :

- Elle a compté **82 clés** là où l'extraction fiable (outil Grep/ripgrep) en trouve **80**, et son extraction avait silencieusement **omis `formateur_message_apres_delai` et `formateur_mission_sans_reponse_delai`** — les deux codes les plus récents (`catalogue.ts:710` et `:720`). L'outil Bash lit ici un instantané périmé du dépôt (`catalogue.ts` à 1038 lignes contre 1065 réellement présentes) ; c'est pourquoi le rapport s'appuie sur Grep/Read, qui concordent entre eux.
- Ces deux codes sont bien émis : `formateur_mission_sans_reponse_delai` par `evaluateur.ts:2831`, `formateur_message_apres_delai` par `message-apres-delai.ts:85`. Aucun des deux n'est orphelin.

Le rapport rendu reste donc valable tel quel, y compris le sens inverse du contrôle — les **trois codes émis sans entrée au catalogue** (`email_corbeille_indisponible`, `positionnement_hors_delai`, `email_retenu_*`), que cette commande ne pouvait pas voir puisqu'elle ne cherchait que dans un sens.