# Résumé exécutif — Plateforme e-learning (LMS) Axion-IA

> Pour Will (fondateur), en mots simples. Ce document dit **ce qu'on construit, ce qu'on réutilise, dans quel ordre, combien ça coûte en temps, et ce qui te reste à faire toi**.
>
> Une annexe technique en fin de page donne les noms exacts (modèles, fichiers, routes) pour l'équipe de dev — tu peux la sauter.
>
> Dernière mise à jour : 2026-06-27. À lire avant tout le reste du dossier `_LMS-ELEARNING/`.

---

## 1. En une phrase

On ajoute à ton site une **école en ligne maison** (un « LMS »), où tes apprenants suivent des cours vidéo/texte à leur rythme, sont **bloqués tant qu'ils n'ont pas réussi le quiz** du module, et **obtiennent un certificat** à la fin — le tout **conforme Qualiopi/FOAD** pour être financé par les OPCO, et **prêt pour le CPF le jour où tu auras la certification**.

C'est **100 % propriétaire** : pas de Moodle, pas de Teachable, pas de 360Learning. Tout vit dans ta plateforme, sous ton contrôle, sans abonnement mensuel à un tiers.

---

## 2. Ce qu'on construit (vu par l'apprenant et par toi)

**Côté apprenant (l'élève) :**

- Il reçoit un **accès par e-mail** (un lien magique, comme aujourd'hui le portail stagiaire). Les entreprises pourront en plus avoir un **mot de passe**.
- Il arrive dans son **espace**, voit ses cours, sa **progression** (barre %), et **reprend automatiquement** là où il s'était arrêté (même en changeant d'appareil).
- Un cours = des **modules** (chapitres) qui contiennent des **leçons** courtes (vidéo, texte, PDF, quiz). Les leçons durent 2 à 10 min (microlearning, c'est la norme 2026).
- Les modules **se déverrouillent** : soit l'un après l'autre, soit à une date, soit X jours après l'inscription, soit **après avoir réussi le quiz** (avec la vraie note, pas juste « j'ai essayé »). Quand c'est verrouillé, il **voit pourquoi**.
- Des **quiz** variés (QCM, vrai/faux, texte à trous, etc.), corrigés automatiquement, avec une **note seuil** à atteindre.
- À la fin : un **certificat de réalisation** (le modèle officiel obligatoire, avec les heures réalisées et un QR code de vérification).
- Le tout **accessible** (malvoyants, navigation clavier…) — c'est une **obligation légale UE depuis le 28/06/2025**.

**Côté toi / ton équipe (l'auteur et l'admin) :**

- Un **outil auteur facile** : tu crées un cours, tu ajoutes modules et leçons, tu **téléverses ta vidéo** (elle est convertie automatiquement), tu ajoutes un quiz, et tu **publies**. Brouillon tant que ce n'est pas prêt.
- Tu **ouvres l'accès à qui tu veux** : automatiquement (un participant de session présentielle reçoit aussi le e-learning), manuellement (1 clic), ou **par import d'un fichier Excel/CSV** (toute une équipe d'entreprise d'un coup).
- Tu **suis tout** : qui a avancé, qui a réussi, qui a décroché, qui a son certificat.
- Toutes les **preuves légales** (FOAD) sont produites et **exportables** pour un contrôle OPCO/DREETS.

---

## 3. Ce qui existe déjà vs ce qui est neuf

La bonne nouvelle : **une grosse moitié des briques existent déjà** dans ta plateforme. On ne réinvente rien.

### On RÉUTILISE (déjà codé, juste à étendre)

| Brique existante                                       | Sert à                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| **Portail stagiaire** (lien magique, cookie)           | base de la **connexion apprenant**                 |
| **Trainee / Enrollment / Client** (CRM)                | les **personnes** et **entreprises** existent déjà |
| **Cloudflare R2** (stockage fichiers)                  | héberger PDF, sous-titres, images                  |
| **Générateur de PDF + QR code** (certificats Qualiopi) | produire les **certificats** e-learning            |
| **Stripe** (déjà installé mais **éteint**)             | le **paiement en ligne** futur, sans recoder       |
| **Moteur IA Formation** (génération pédagogique)       | plus tard, **générer des quiz** et un tuteur       |
| **E-mails maison + files d'attente (BullMQ)**          | invitations, relances                              |
| **Console admin** (gabarits, droits d'accès)           | toute l'interface d'administration                 |

> Cette réutilisation **économise ~35 à 45 jours de dev** par rapport à un LMS parti de zéro.

### On CONSTRUIT du NEUF

- Le **cœur LMS** : cours, modules, leçons, ressources.
- Le **suivi de progression** (reprise auto, complétion, barre).
- Le **moteur de quiz interactif** + le **déverrouillage par note**.
- La **connexion apprenant** étendue (lien magique + mot de passe optionnel entreprise).
- L'**import en masse** (CSV) et l'octroi d'accès.
- La **vidéo en streaming** (Cloudflare Stream : lecture fluide mobile + lien protégé + filigrane au nom de l'apprenant).
- L'**outil auteur** (création de cours).
- Plus tard : **multi-entreprises cloisonnées**, **IA quiz + tuteur**, **CPF/EDOF**.

---

## 4. Dans quel ordre on construit (MVP → V1 → V2)

On livre **vite quelque chose d'utile et conforme**, puis on monte en puissance.

### MVP — « Un cours, finançable OPCO, accès ouvrable »

Le minimum vendable : **un** cours en ligne, qu'on peut **offrir ou vendre** (par virement au début), avec modules déverrouillables, quiz bloquants, progression, certificat, et **toutes les preuves FOAD**. Pas de paiement carte, pas de multi-entreprises, pas d'IA.

> **C'est ce qui te permet de commencer à vendre du e-learning financé OPCO + entreprise + vente directe.**

### V1 — « Industrialisation »

Plusieurs cours, **catalogue public** (référencé Google), outil auteur abouti (glisser-déposer), **banque de questions**, **tableau de bord** complet, **relances automatiques** anti-décrochage, **tuteur IA**, et **activation du paiement carte (Stripe)**.

### V2 — « Échelle »

**Espaces entreprise cloisonnés** (chaque client gère ses équipes), **IA pédagogique avancée**, et **activation CPF/EDOF** (si tu as obtenu la certification).

---

## 5. Le point CPF (important, à bien comprendre)

**Le CPF n'est pas bloqué par la technique. Il est bloqué par une démarche administrative que toi seul peux lancer.**

- Règle dure : un e-learning n'est **éligible CPF que s'il mène à une certification RNCP ou RS**. Ce n'est pas le « format en ligne » qui bloque, c'est **l'absence de certification**.
- Obtenir cette certification = un **dossier auprès de France Compétences**, long, **indépendant du code**.
- **Notre choix** : on construit **tout « prêt pour le CPF » dès le départ** (toutes les preuves d'assiduité, de progression, d'évaluation, le certificat de réalisation). L'intégration technique au CPF (EDOF, FranceConnect+) est **codée mais derrière un interrupteur** (`EDOF_ENABLED`).
- Le jour où tu obtiens l'autorisation France Compétences : on **bascule l'interrupteur**, pas de refonte.

**En clair : la plateforme est finançable OPCO + entreprise + vente directe dès le MVP. Le CPF s'ajoute plus tard d'un geste, une fois ta certification obtenue.**

---

## 6. Combien de temps ça prend (effort dev)

Estimation pour **un développeur senior** qui connaît déjà ta plateforme (sinon +30-40 %).

| Phase              | Ce que ça couvre                                                     | Effort                       | Délai indicatif (1 dev) |
| ------------------ | -------------------------------------------------------------------- | ---------------------------- | ----------------------- |
| **MVP**            | 1 cours finançable, accès ouvrable, quiz bloquants, certificat, FOAD | **~62 jours** (52–74)        | ~13-15 semaines         |
| **+ V1**           | catalogue, paiement carte, tuteur IA, dashboards, relances           | **+50 jours** (≈112 cumulés) | ~24-26 semaines         |
| **+ V2 (complet)** | multi-entreprises, CPF/EDOF, IA avancée                              | **+42 jours** (≈154 cumulés) | ~33-36 semaines         |

> À **2 développeurs en parallèle**, on réduit le délai d'environ 35-45 % après la première brique (le « cœur de données » doit être posé en premier, tout en dépend).
>
> Sans la réutilisation de l'existant, ce serait **165-240 jours** au lieu de **127-186**. Ton socle Qualiopi fait gagner beaucoup.

---

## 7. Ce que disent les audits (vérification adverse du dossier)

Le dossier a été **audité de façon adversariale** sur 6 angles. Résumé honnête :

- **Complétude** : dossier « niveau équipe senior », **très complet**. Le vrai risque n'est **pas** un manque de specs, mais quelques **incohérences de noms entre documents** (le même modèle appelé différemment) — à **trancher avant d'écrire le code** (30 min de décision chacune). 3 points bloquants identifiés et documentés.
- **Conformité FOAD** : **🔴 non finançable EN L'ÉTAT** tant que 4 points ne sont pas corrigés — dont **2 majeurs** : (1) **l'assistance/tutorat** (Qualiopi Ind.19) doit exister **dès le MVP**, pas seulement en V1 ; (2) les **évaluations doivent être reliées aux preuves légales** + un **calcul d'heures réalisées défendable** (Ind.11, non-conformité majeure si absente). C'est **corrigeable** et c'est la **condition d'ouverture commerciale**. → corrigé via le lot conformité du MVP.
- **Sécurité / RGPD** : le socle est bon mais conçu pour un usage **étroit**. 6 points à régler **avant la 1re mise en ligne** : vérifier partout « qui a le droit de voir CE cours » (anti-IDOR), **protéger la vidéo** (lien signé par utilisateur + filigrane), **raccourcir/hacher le token** d'accès, sécuriser le **mot de passe entreprise** (anti-bruteforce), **calculer les notes côté serveur uniquement**, et **purger les logs** d'apprentissage selon les durées légales.
- **UX / accessibilité** : barre haute (player vidéo standard, mobile, **WCAG 2.2 AA obligatoire UE**). Point de vigilance : la **réactivité du lecteur vidéo** vs tes budgets de performance internes.
- **Cohérence avec l'existant** : la réutilisation est **saine**, pas de duplication prévue — à condition de **ne pas re-cloner** l'auth, les certificats, les e-mails ou le stockage qui existent déjà.

> **À retenir : aucun de ces points n'est bloquant au sens « impossible ». Ce sont des corrections connues, chiffrées, à intégrer dans les lots. Le plus important est de corriger la conformité FOAD avant la première vente.**

---

## 8. Décisions déjà figées (pour info)

8 décisions structurantes sont actées (détail dans `DECISIONS-ARBITRAGES.md`) :

1. **Connexion apprenant hybride** : lien magique par défaut + mot de passe optionnel (entreprises), **séparée** du compte admin.
2. **Multi-entreprises** : conçu maintenant, **livré en V2** ; au début, c'est toi qui ouvres les accès en masse.
3. **CPF/RNCP** : tout « prêt », activable par interrupteur après ta certification.
4. **Paiement** : Stripe **gardé éteint** ; au début **virement + ouverture manuelle**.
5. **Vidéo** : **Cloudflare Stream** (tu y es déjà), pas d'auto-hébergement.
6. **Pas de standards SCORM/xAPI** au lancement (contenu maison), mais structure « compatible plus tard ».
7. **Code rangé** dans des dossiers dédiés `elearning/`.
8. **Modifications de base de données toujours additives** (zéro risque pour la prod).

---

## 9. Tes prochaines étapes concrètes (ce qui dépend de toi, pas du dev)

Pour que le dev ne soit **jamais bloqué**, prévois en amont :

1. **Trancher les 3 incohérences P0** du dossier (décisions rapides, l'équipe te les présente) — **avant** d'écrire le code.
2. **Ouvrir un compte Cloudflare Stream** et fournir les clés (nécessaire pour la vidéo).
3. **Cadrer la conformité FOAD avec un regard juridique** : le tutorat/assistance (délais de réponse formalisés) et le **calcul d'heures réalisées** doivent être validés (c'est ce qui te protège en contrôle).
4. **Préparer le contenu pédagogique** du premier cours (vidéos, textes, quiz) — c'est **hors dev**, c'est du métier, et c'est souvent le vrai goulot.
5. **Plus tard** : compte **Stripe** (pour le paiement carte en V1), et **dossier certification RNCP/RS** auprès de France Compétences (pour débloquer le CPF en V2).
6. **Décider du scénario de livraison** : **MVP seul** (≈62 j, vendre vite), **MVP + V1** (≈112 j), ou **complet** (≈154 j).

> **Recommandation : viser le MVP d'abord** (un cours, finançable OPCO, conforme), le vendre, apprendre du terrain, puis enchaîner V1.

---

## 10. Annexe technique (pour l'équipe de dev)

Ancrage sur le code réel — noms exacts à respecter.

**Cœur LMS (neuf)** — `03-DATA-MODEL/01` :

- Modèles `ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource`.
- Enums `ElearningCourseStatut {brouillon, publie, archive}`, `ElearningLessonType {video, texte, pdf, quiz, embed, devoir}`, `ElearningUnlockType {immediat, apres_precedent, date_fixe, offset_inscription, score_quiz}`.
- FK optionnelles `ElearningCourse.formationId → Formation`, `ownerClientId → Client` (relations inverses additives).
- Vidéo via `videoAssetId` (Cloudflare Stream), **pas** R2 ; médias non-vidéo via `ElearningResource.r2Key`.
- ⚠️ **PK/FK en `@db.Uuid`** (arbitrage `06-strategie-migrations.md` §1.3) — les snippets `String @id @default(uuid())` des docs 01/02/03 doivent être lus avec `@db.Uuid`.

**Réutilisé (existant, vérifié dans `schema.prisma`)** :

- `Trainee` (:5274, + `passwordHash?` argon2id nullable, ADR-0001), `Enrollment` (:5310), `Client` (:4890), `Formation` (:5061).
- `PortailAcces` (:6236) + `src/server/qualiopi/portail/portail-service.ts` (`creerAcces`, `verifierToken` timing-safe) → socle auth apprenant.
- `src/lib/r2-storage.ts` (`uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`) — clés namespacées `elearning/...`.
- `DocumentGenere` (:5507) + `qrToken` + `@react-pdf/renderer` → certificats. `DocumentType { certificat_realisation, attestation, attestation_partielle }`.
- Stripe : `src/lib/stripe.ts`, `Invoice`/`Payment`/`Refund`/`StripeWebhookEvent`, flag `STRIPE_ENABLED` (`src/env.ts` ~103-115).
- `EvaluationAcquis` (:5653) / `Questionnaire` (:5704) → **pont** preuve FOAD (Ind.11), pas un moteur quiz.
- BullMQ `queues.ts` + `email-worker` + React Email ; RBAC `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`).
- Nav admin : `admin-nav.ts` (SSOT) — monter via **`AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`).

**Cloisonnement code (ADR-0007)** : `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/components/elearning/**` + `src/components/admin/elearning/**`, workers `src/server/queue/workers/elearning-*-worker.ts`.

**Décisions à trancher AVANT code (audit complétude)** :

- **C1** : type PK `text` vs `@db.Uuid` → **`@db.Uuid` partout**.
- **C2** : `ElearningOrgMembership` (doc 04, SSOT) vs `ElearningCompanyMembership` (personas) → garder doc 04.
- **C3** : registre canonique des workers (`elearning-provisioning/progress-rollup/certificat/relance/video/order/xapi-purge/ai-worker`) dans `04-BACKEND/03`.
- **C4** : `QuestionType` = **12 types** (doc 03 fait foi), pas 9.
- **C6** : ajouter le modèle de **rattachement tuteur ↔ apprenant** (sinon Ind.19 non outillé).
- **G1** : déclarer dans `src/env.ts` les clés `CLOUDFLARE_STREAM_*` + flags `EDOF_ENABLED`, `LEARNER_PASSWORD_ENABLED`, `LMS_TUTOR_ENABLED` (optionnelles au build, stub-aware ADR-0026).

**Contraintes plateforme** : build externalisé GH Actions + magic string `stub.invalid` (pages e-learning derrière auth + `force-dynamic` → OK) ; budgets Web Vitals (risque INP sur le player → lazy-load hls.js, possible ADR d'exception comme `/appel`) ; FR-only (EN désactivé) ; migrations additives ; `pricing.ts` SSOT ; Nodemailer maison.

---

## Liens

- `00-INDEX/README.md` — index maître & table des matières du dossier
- `00-INDEX/DECISIONS-ARBITRAGES.md` — les 8 décisions (ADR) détaillées
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — schéma du cœur LMS
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage MVP / V1 / V2
- `11-ROADMAP/03-estimation-charges.md` — chiffrage détaillé par lot (base du §6)
- `99-VERIFICATION/01-critique-completude.md` — complétude & incohérences à trancher (§7, §10)
- `99-VERIFICATION/03-audit-conformite.md` — conformité FOAD (les 4 NC du §7)
- `99-VERIFICATION/04-audit-securite-rgpd.md` — sécurité & RGPD (les 6 risques du §7)
- `99-VERIFICATION/05-audit-ux-bestpractices.md` — UX & accessibilité
- `99-VERIFICATION/06-coherence-existant.md` — réutilisation de l'existant (anti-duplication)
