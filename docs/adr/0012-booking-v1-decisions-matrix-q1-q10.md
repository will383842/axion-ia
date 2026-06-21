# ADR 0012 — Matrice des 10 décisions Q1–Q10 Booking V1

> ⚠️ **SUPERSEDED (identité fiscale) — Axion-IA est désormais une SAS française (régime France).** Le scénario par défaut « Axion-IA OÜ (Estonie) » mentionné ci-dessous est obsolète ; la structure retenue est **Axion-IA SAS**. La mécanique TVA-agnostique (`PricingConfig`) reste valable. Corps historique conservé pour l'audit trail.

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 (`_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`), `STOP-AND-ASK.md` §2, `SYNTHESE-FINALE.md`

---

## Contexte

L'audit booking V2.3 a tranché 32 décisions structurantes (D33 → D64) lors des itérations du 12 mai 2026. Restaient 10 questions ouvertes (Q1 → Q10) listées dans `STOP-AND-ASK.md` §2, nécessitant un arbitrage Will avant de lancer Sprint X.1 (foundation Prisma).

Plutôt que d'organiser une session d'arbitrage bloquante avant chaque sprint code, Will a tranché **les 10 questions par défaut** en ouvrant le build, avec des choix qui :

1. **Minimisent le surface d'attaque V1** (pas d'intégrations exotiques, pas de bibliothèques tierces lourdes).
2. **Préservent les hooks V2+** (toutes les colonnes nécessaires pour migrer plus tard sont déjà dans le schema).
3. **Maximisent le contrôle manuel admin** (Will valide tout en V1 — pas de pilote automatique).

Le présent ADR fige ces 10 réponses pour éviter les drifts ultérieurs et tient lieu d'index vers les ADRs sectoriels (0013–0020).

## Décision

### Q1 — Provider visio cadrage V1 (D10)

**Choix : `manual_external` V1.**
La table `CadrageMeeting.videoProvider` stocke `manual_external` par défaut. Will copie-colle un lien Jitsi / Google Meet / Zoom à la main dans le champ `videoUrl` lors de la création du rendez-vous de cadrage. Pas d'intégration API V1. Hook V2+ préservé : la colonne `videoProvider` accepte aussi `jitsi`, `meet`, `zoom`, `whereby`.

### Q2 — Structure juridique FR vs EE (D15)

**Choix : EE par défaut (architecture agnostique).**
Le scénario par défaut de `legal.ts:44` reste **Axion-IA OÜ** (Estonie). Aucun refactor TVA / mentions légales / CGV n'est figé sur EE : tout passe par des champs configurables (`PricingConfig.vatRate`, `vatReverseCharge`, `vatMention`). Will peut basculer vers une structure FR (SAS, EURL, micro-entreprise) sans toucher le code, uniquement en éditant `PricingConfig` + `legal.ts:44` + factures `Invoice.legalSnapshot`. Voir ADR 0015.

### Q3 — PDF moteur (D31)

**Choix : `react-pdf` (`@react-pdf/renderer`).**
Génération côté serveur (Node), templates en JSX (réutilise les composants design AxionIA). Rejeté : Puppeteer (~250 MB Chromium en RAM, lourd), pdfkit (impératif, pas de réutilisation design), html-pdf-node (déprécié).

### Q4 — Storage PDF (factures + contrats signés + devis)

**Choix : Hetzner Storage Box (S3-compatible, déjà configuré).**
Les variables `HETZNER_STORAGE_*` existent déjà dans `.env.example`. Bucket dédié `axionia-booking-documents/`. Préfixes : `invoices/{year}/{number}.pdf`, `contracts/{bookingId}/v{n}-signed.pdf`, `quotes/{quoteId}/v{n}.pdf`. Lien public signé (URL temporaire 7 jours) pour les clients ; copie chiffrée at-rest pour archivage 10 ans (Agent 11 P1-7).

### Q5 — Drag & drop calendrier admin (Agent 5)

**Choix : V1 minimal.**
Pas de drag-drop natif HTML5 V1. La replanification se fait via **modale `Booking.move`** (nouveau slot sélectionné dans un mini-calendrier picker). Hook V2+ préservé : la table `BookingTransition` enregistre déjà `oldSlotId` / `newSlotId` pour audit. Drag-drop natif arrivera V1.5 ou V2 (Agent 5 §3.4).

### Q6 — Refunds automatiques vs manuel admin (Agent 4)

**Choix : Manuel V1.**
Tous les remboursements (Stripe `refunds.create` ou virement SEPA manuel) déclenchés par bouton admin explicite avec confirmation 2-clics. Pas de policy auto V1 (« annulation J-7 → refund auto 50% »). Hook V2+ : la table `Refund` stocke déjà `triggerSource` (`manual_admin` | `auto_policy`). Workflow d'approbation 2-eyes pour > 5 000 € reporté V2+ (§5.10.8).

### Q7 — J+1 debrief NPS (cron `booking-j1-debrief`)

**Choix : Non V1 (D57 confirmé).**
Pas de cron NPS, pas de questionnaire J+1, pas de table `NpsResponse`. Reporté V2+. Will collectera les retours par email manuel ou rendez-vous de debrief à la demande.

### Q8 — Admin EN bilingue (Agent 2)

**Choix : FR only V1.**
L'admin (`/admin/*`) est en français uniquement. Les emails clients restent bilingues FR/EN (basés sur `Client.locale`). Hook V2+ : l'arborescence `messages/{fr,en}.json` accepte déjà la traduction des libellés admin, mais aucune route admin n'est exposée en EN V1.

### Q9 — Liste fermée secteurs sensibles (NDA auto — D12)

**Choix : 7 secteurs.**
La liste fermée V1 est : `finance`, `health`, `defense`, `aerospace`, `energy`, `telecom`, `legal`. Stockée en enum Prisma `SensitiveSector` (les autres clients reçoivent `none`). Pour ces 7 secteurs, le formulaire visiteur (`/reserver`) propose automatiquement le **NDA Axion-IA standard** (template `ContractTemplate.type=nda`) signature DocuSeal **avant** la divulgation du devis détaillé. Hook V2+ : la liste devient éditable depuis `/admin/parametres/secteurs` une fois validée.

### Q10 — Acompte par défaut par format

**Choix : selon D40 — 4 profils par défaut couplés à `PaymentScheduleProfile`.**

| Profil             | Format type                              | Échéancier par défaut                                  |
| ------------------ | ---------------------------------------- | ------------------------------------------------------ |
| `full_upfront`     | Conférence 1j, Audit flash 4h            | 100% à la confirmation                                 |
| `deposit_50_50`    | Essentielle 4h / 1j, Coaching individuel | 50% confirmation + 50% J−7                             |
| `deposit_30_30_40` | Approfondie 2j, Formations 2j+, CODIR    | 30% confirmation + 30% J−14 + 40% J+0 (post-livraison) |
| `custom`           | À l'unité, override par booking          | Saisie libre admin                                     |

Mapping initial entre `INTERVENTION_FORMATS` et `PaymentScheduleProfile` seedé à l'install. Les % et les délais sont **configurables depuis admin `/admin/tarifs`** sans déploiement.

## Conséquences

### Techniques

- 0 dépendance npm nouvelle au-delà du périmètre déjà acté (`@react-pdf/renderer`, `stripe`, `docuseal-self-hosted-client`).
- 0 service externe payant ajouté V1 (DocuSeal self-hosted gratuit, OSM Nominatim gratuit, Stripe paiement à la transaction).
- Tous les hooks V2+ sont préservés dans le schema Prisma : colonnes `triggerSource`, `videoProvider`, `nps*`, `qualiopi*` existent même non utilisées V1.

### Business

- Will conserve un contrôle manuel total (validation 2 clics, refunds manuels, replanification modale).
- Migration vers une structure FR ou un workflow OPCO/Qualiopi possible sans refactor (seulement config + ADRs nouveaux).
- Les 7 secteurs sensibles capturent ~80 % des clients à risque IP/RGPD majorés.

## Alternatives écartées

- **Visio API V1 (Q1)** : ajout d'un provider auto (Jitsi self-hosted, Daily, Whereby API) — rejeté pour ne pas multiplier les surfaces V1.
- **Structure FR figée (Q2)** : créerait des refactors massifs si bascule EE → FR plus tard ; agnostique gagne.
- **Puppeteer PDF (Q3)** : ~250 MB Chromium, lent, fragile sur Hetzner CPX32.
- **AWS S3 / Backblaze (Q4)** : sortie de l'UE, sortie du périmètre Hetzner déjà acté ADR 0009.
- **Drag-drop natif V1 (Q5)** : surface UX + tests E2E qui n'apporte pas de valeur immédiate.
- **Refunds auto policy V1 (Q6)** : trop de cas particuliers, risque financier en cas de bug.
- **NPS J+1 V1 (Q7)** : déjà retiré D57 pour réduire le scope.
- **Admin EN V1 (Q8)** : 0 client EN admin actuel, surcharge de traduction.
- **Liste secteurs ouverte (Q9)** : impossible de figer le contenu NDA si la liste est libre.
- **Acompte unique V1 (Q10)** : ignore la réalité business (Conf 1 j ≠ Approfondie 2 j en cash-flow).

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` §2 (Q1–Q10)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.1 (schema cible), §5.14 (échéanciers)
- ADRs sectoriels : 0013 (Stripe), 0014 (DocuSeal), 0015 (TVA), 0016 (PricingConfig), 0017 (multi-options), 0018 (validation 2 clics), 0019 (modes manuels D64), 0020 (migration V0→V1)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/SYNTHESE-FINALE.md`
