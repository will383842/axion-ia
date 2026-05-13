# 07 — CLIENT SURFACE — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` §10.3 + Agent 7 (~ligne 286)
> Agent : 7 — Surface client connectée
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucun code .tsx, aucune migration, aucun `pnpm add`)
> Référence code : HEAD `main` (commit `95bba36`)
> Reality check : `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md`
> Liens transverses : Agent 1 (data model), Agent 4 (server actions), Agent 6 (public surface), Agent 9 (RGPD), Agent 18 (tests)

---

## 0. TL;DR

- **Cible V1** : surface client `/fr/mes-ressources/` consommée par les clients post-booking, **gated par magic-token** (pattern Sprint X.15 réutilisé, **pas** NextAuth — voir §2). Feed personnalisé filtré par `audience IN ('public', 'client')` + tags dérivés du `Booking.interventionType` + `Booking.companySize`.
- **Cible V1.5** : sous-route `/favoris/` + `KnowledgeBookmark` + notes privées. La V1 livre uniquement la lecture (pas d'écriture client).
- **Hors scope V1/V1.5** : compte client persistant avec mot de passe, profil édité par le client, notifications push, abonnement email auto. Restent en V2+.
- **Pré-requis** : décision Will sur l'auth method (§10 STOP & ASK 1) avant Phase B. Recommandation reality check : **magic-token longue durée (90 j renouvelable)** plutôt que NextAuth client (zéro friction, zéro mot de passe, aligné Booking V1).

---

## 1. CONTEXTE & CONTRAINTES — issues du reality check + relecture code

### 1.1 Pas de NextAuth client dans le repo

- `src/auth.ts` + `src/auth.config.ts` instancient **NextAuth v5 sur le seul modèle `AdminUser`** (Credentials provider email/password + TOTP). Aucun `ClientUser` / `User` n'existe en DB.
- Le seul flow d'authentification client existant est **magic-token HMAC-SHA256** (`src/lib/magic-token.ts`) avec scopes `cancel` / `reschedule` / `portal`, déclenchés depuis emails post-booking et utilisés sans login (cf. `src/app/[locale]/booking/[token]/cancel/page.tsx` + `src/app/[locale]/booking/[token]/reschedule/page.tsx`).
- **Aucune route `/fr/mes-rendez-vous/`** n'existe à HEAD `main` — c'est une route **à créer en V1** (cf. §5 et lien post-booking).
- `Booking.submission.contactEmail` est la seule "identité" client traçable. C'est le champ pivot pour le matching booking↔tags.

### 1.2 Conséquence stratégique

Le prompt §10.3 dit « Login NextAuth requis (rôle `CLIENT` + booking confirmé) ». **Cette formulation est obsolète vs reality** : il n'existe pas de rôle `CLIENT` dans `AdminRole` ni de modèle de session client. La cible V1 doit basculer sur **magic-token longue durée**, qui réutilise 100 % de l'infra Booking V1.

**Décision Phase A — recommandation forte** : ne **pas** créer NextAuth client en V1. Étendre le pattern magic-token existant avec un nouveau scope `client_kb` (TTL ~90 j) + cookie HttpOnly+SameSite=Strict côté navigateur pour persistance.

---

## 2. AUTH GATE — magic-token longue durée (V1)

### 2.1 Pattern proposé

```
Booking confirmé
    │
    ├─ Email confirmation (existant) → ajoute lien
    │   https://axion-ia.com/fr/mes-ressources?t=<magic-token scope='client_kb' ttl=90d resourceId=<bookingId>>
    │
    └─ Email post-cadrage / J-1 / J+7 → même lien réutilisable (rotation TTL côté serveur)

Premier clic
    │
    ├─ Server action `enterClientSurfaceAction(token)`
    │   1. verifyMagicToken({scope:'client_kb', resourceId:<bookingId>})
    │   2. Set HttpOnly cookie `kb_client_session` = HMAC(bookingId,contactEmail,exp) (TTL 90 j)
    │   3. redirect → /fr/mes-ressources/
    │
    └─ Clics suivants
        └─ Cookie présent → SSR lit cookie, hydrate session client read-only
```

### 2.2 Pourquoi pas NextAuth client en V1

| Critère         | NextAuth client                                      | Magic-token longue durée            |
| --------------- | ---------------------------------------------------- | ----------------------------------- |
| Friction client | Email + password + recovery flow                     | Zéro (clic email)                   |
| Tables Prisma   | `ClientUser` + `Session` (V1=NON ➜ migration lourde) | Réutilise `Booking` + cookie HMAC   |
| Surface attaque | Password leaks, brute force, MFA TOTP                | Token signé HMAC + cookie HttpOnly  |
| Alignement repo | Diverge totalement                                   | Aligné Sprint X.15 self-service     |
| Effort V1       | ~3-5 j dev (modèles, UI signup, recovery)            | ~0.5 j (réutilise `magic-token.ts`) |
| RGPD            | Stockage password hash + tentatives login            | Aucune donnée nouvelle persistée    |

**Tradeoff** : magic-token ne supporte pas multi-device persistant si cookie purgé → client redemande email. Acceptable en V1 (UX rare). V2+ pourra ajouter NextAuth client si besoin de compte « lourd ».

### 2.3 Schéma cookie session client

```typescript
// Payload cookie kb_client_session (HMAC-SHA256, base64url, format : <payload>.<sig>)
{
  bookingId: string,        // FK Booking.id (seul lien identité)
  contactEmail: string,     // pour audit log + double-check
  scope: 'client_kb',
  exp: number,              // unix ms, 90 j
  jti: string               // pour revocation V1.5
}
```

- HttpOnly + Secure + SameSite=Strict + Path=`/`.
- Revocation V1 = effacer le cookie côté admin (action `revokeClientSession(bookingId)`).
- Revocation V1.5 = jti store Redis SETEX (aligné `magic-token.ts` ligne 17-22).

### 2.4 Pas de password reset, pas de signup

Le client **n'a pas de compte au sens classique** en V1. Tout client avec un `Booking` confirmé reçoit son lien dans l'email. **Aucune route `/inscription`, `/connexion-client`, `/mot-de-passe-oublie`** créée.

---

## 3. ARCHITECTURE — `/fr/mes-ressources/` — maquettes ASCII

### 3.1 Feed personnalisé (`/fr/mes-ressources/`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER PUBLIC (Container existant, terracotta, MAIS bandeau "Espace client") │
│                                                                              │
│  ⚠ Espace client — Bonjour [contactName]                          [Sortir]   │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   Mes ressources Axion-IA                                                    │
│   Sélectionnées pour votre intervention « Audit Approfondie » du 14/06.      │
│                                                                              │
│  ┌────────────────┐  ┌─────────────────────────────────────────────────────┐ │
│  │ TAGS (sticky)  │  │ 🔍 Rechercher dans mes ressources...               │ │
│  │ ☑ audit        │  └─────────────────────────────────────────────────────┘ │
│  │ ☑ approfondie  │                                                          │
│  │ ☐ flash        │  ┌─────────────────────────────────────────────────────┐ │
│  │ ☐ implem-ia    │  │ [Type pill] CAS CONCRET                              │ │
│  │ ☐ pme          │  │ "Comment PME-X a libéré 6h/sem grâce à un audit..."  │ │
│  │ ──────         │  │ ★ Manon Larivière · 12 min · publié 2026-04-02       │ │
│  │ TYPES          │  └─────────────────────────────────────────────────────┘ │
│  │ ☑ tous         │                                                          │
│  │ ☐ articles     │  ┌─────────────────────────────────────────────────────┐ │
│  │ ☐ cas concrets │  │ [Type pill] ARTICLE                                  │ │
│  │ ☐ playbooks    │  │ "Préparer son audit IA : la checklist 21 questions"  │ │
│  │ ☐ FAQ          │  │ ★ Manon Larivière · 8 min · publié 2026-03-18        │ │
│  │ ☐ glossaire    │  └─────────────────────────────────────────────────────┘ │
│  │                │                                                          │
│  │ AUDIENCE       │  ┌─────────────────────────────────────────────────────┐ │
│  │ ☑ public       │  │ [Type pill] PLAYBOOK · 🔒 CLIENT UNIQUEMENT          │ │
│  │ ☑ client       │  │ "Onboarding 21 jours après votre audit"              │ │
│  │ (jamais team   │  │ ★ Manon Larivière · 18 min · publié 2026-05-01       │ │
│  │  ni will-only) │  └─────────────────────────────────────────────────────┘ │
│  │                │                                                          │
│  └────────────────┘  [ Voir plus (32 sur 47) ]                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Notes UX** :

- Bandeau « Espace client » différencie visuellement de la surface publique (pattern terracotta + halo). Bouton « Sortir » purge le cookie + redirect `/`.
- Tags pré-cochés = dérivés du booking (algorithme §4). Le client peut **désactiver** un tag pour élargir, mais pas en ajouter d'arbitraires.
- Type pills colorés par `KnowledgeEntry.type` (mapping SSOT `knowledge-base.ts`).
- Pas de pagination « page 2 » mais « Voir plus » (`cursor`-based infinite, doctrine Web Vitals INP).

### 3.2 Sous-routes V1.5

```
/fr/mes-ressources/                      (V1) Feed personnalisé
/fr/mes-ressources/[slug]                (V1) Détail entrée (audience='public'|'client')
/fr/mes-ressources/favoris/              (V1.5) Bookmarks personnels
/fr/mes-ressources/notes/                (V1.5) Notes privées par entrée
/fr/mes-ressources/onboarding/           (V1.5) Onboarding journey (cf. §6)
```

### 3.3 Détail entrée `/fr/mes-ressources/[slug]`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠ Espace client — [contactName]              [⭐ Marquer favori] [Sortir]    │
└──────────────────────────────────────────────────────────────────────────────┘
┌────────────────────┬─────────────────────────────────────────────────────────┐
│ TOC (sticky)       │                                                         │
│                    │   [Breadcrumb : Mes ressources › Playbooks › Slug]      │
│ 1. Introduction    │                                                         │
│ 2. Étape 1         │   PLAYBOOK · 🔒 CLIENT UNIQUEMENT                       │
│ 3. Étape 2         │                                                         │
│ 4. ...             │   Onboarding 21 jours après votre audit                 │
│                    │                                                         │
│ ──────             │   ★ Manon Larivière · 18 min · publié 2026-05-01        │
│                    │     dernière revue : 2026-05-10                         │
│ Mes notes privées  │                                                         │
│ ┌──────────────┐   │   [Cover Image SSR optimisée AVIF/WebP/JPEG]            │
│ │ (V1.5)       │   │                                                         │
│ │ markdown...  │   │   ## 1. Introduction                                    │
│ └──────────────┘   │   Lorem ipsum...                                        │
│                    │                                                         │
│                    │   ## 2. Étape 1 — Cadrer                                │
│                    │   ...                                                   │
│                    │                                                         │
│                    │   ─────────────────────────────────────────────         │
│                    │   Voir aussi (relations) :                              │
│                    │   ▸ Article : Préparer son audit IA                     │
│                    │   ▸ Cas concret : PME-X libère 6h/sem                   │
│                    │                                                         │
│                    │   Bouton « ⭐ Marquer favori » (V1.5)                   │
│                    │   Bouton « 📋 Copier le lien »                          │
│                    │   Pas de partage social (audience='client' = privé)     │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

**Notes UX** :

- **Pas** de section commentaires/feedback `kb_helpful` (👍/👎) côté client en V1 (réservée surface publique). Décision : ajouter en V1.5 sous forme « cette ressource vous a-t-elle aidé ? » pour `audience='client'`.
- Lien partage social masqué pour `audience='client'` (anti-leak).
- `lastReviewedAt` toujours visible (doctrine §0.0/22 E-E-A-T).

### 3.4 Maquette `/favoris/` (V1.5)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Mes favoris (12)                                                             │
│                                                                              │
│  [ Filtrer par type ▼ ]   [ Trier : ajoutés récemment ▼ ]                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ ★ ─ │   │
│  │ [Type] Playbook · Onboarding 21 jours après votre audit         │     │   │
│  │ Ajouté 2026-05-12 · 18 min · ★ Manon Larivière                  │     │   │
│  │ Note privée : « À relire J+14 »                                 │     │   │
│  └─────────────────────────────────────────────────────────────────┘ [✕] │   │
│  ...                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. FILTRAGE SERVEUR — algorithme matching booking ↔ tags

### 4.1 Filtre de base — **CRITIQUE SÉCURITÉ**

```sql
SELECT * FROM knowledge_entries ke
WHERE ke.status = 'published'
  AND ke.audience IN ('public', 'client')
  -- JAMAIS audience='team' ni 'will-only' (test bloquant §8)
  AND (
    -- Cas 1 : entrée publique tous tags → toujours visible
    ke.audience = 'public'
    OR
    -- Cas 2 : entrée client → exige correspondance tags client
    EXISTS (
      SELECT 1 FROM knowledge_entry_tags ket
      WHERE ket.knowledge_entry_id = ke.id
        AND ket.tag = ANY(:client_tags)
    )
  )
ORDER BY ke.pinned DESC, ke.published_at DESC
LIMIT 20 OFFSET :cursor;
```

### 4.2 Algorithme dérivation `client_tags` depuis `Booking`

Source des données : `Booking` (cf. lignes 522-641 `schema.prisma`) + `Submission.details`.

```
Inputs :
  booking.interventionType : InterventionType enum
  booking.companySize       : CompanySize enum nullable
  booking.cadrageMeeting    : si cadrage planifié → tag 'cadrage'
  booking.quote             : si devis signé → tag 'devis-signé'
  booking.originPath        : 'direct' | 'qualified'

Pipeline (server-side, idempotent) :

  1. Tag format depuis interventionType
     audit_flash_distance       → 'format:flash-distance'
     audit_flash_site           → 'format:flash-site'
     audit_approfondie_jour     → 'format:approfondie'
     audit_approfondie_2_jours  → 'format:approfondie'
     atelier_collective_*       → 'format:collective'
     intervention_individuelle  → 'format:individuel'
     intervention_dirigeants    → 'format:dirigeants'
     conference                 → 'format:conference'
     implementation_*           → 'format:implementation'
     [...mapping SSOT exhaustif dans knowledge-base.ts]

  2. Tag famille (regroupement plus large)
     audit_*                    → 'famille:audit'
     atelier_collective_*       → 'famille:collective'
     intervention_individuelle  → 'famille:individuel'
     intervention_dirigeants    → 'famille:dirigeants'
     conference                 → 'famille:conference'
     implementation_*           → 'famille:implementation'

  3. Tag taille entreprise (depuis Submission.details ou Booking.companySize INSEE)
     tpe       → 'taille:tpe'
     pme       → 'taille:pme'
     eti       → 'taille:eti'
     grande    → 'taille:grande-entreprise'

  4. Tag phase
     bookingDate dans futur → 'phase:avant-intervention'
     bookingDate dans passé < 30j → 'phase:apres-intervention'
     bookingDate dans passé ≥ 30j → 'phase:long-terme'

  5. Tag opt-in features (si applicable)
     cadrageMeetingId != null    → 'feature:cadrage'
     quoteId != null              → 'feature:devis'
     contractDocumentId != null   → 'feature:contrat-signe'

  6. Tags toujours présents
     'audience:client'

Output : client_tags[] = string[] (déterministe, cacheable par bookingId+date)
```

### 4.3 Implémentation côté code

- Helper `src/lib/knowledge/derive-client-tags.ts` (pas `.tsx`).
- Pure function `deriveClientTags(booking: BookingForKB): readonly string[]`.
- Tests unitaires Vitest (~15 cas) — colocalisés `derive-client-tags.test.ts`.
- Appel en SSR loader `/fr/mes-ressources/page.tsx` après lecture cookie session + lookup Booking.
- Cache mémoire 60 s par bookingId (pattern `getCachedAdminStatus` `auth.ts:31-45`) pour éviter recompute à chaque scroll/filter.

### 4.4 Anti-fuite — invariant testé en CI

```
ASSERT : pour TOUT KnowledgeEntry e tel que e.audience IN ('team', 'will-only'),
         AUCUNE requête côté /fr/mes-ressources/* ne doit le retourner,
         peu importe la combinaison de tags client/filtres.
```

Test E2E Playwright dédié (`@kb-leak`) qui seede 1 entrée `team` + 1 entrée `will-only` puis tente 8 combinaisons de filtres → toutes vérifient absence dans `screen.getByRole('list')`.

---

## 5. LIEN POST-BOOKING — emails + `/mes-rendez-vous` (à créer)

### 5.1 Email confirmation booking — extension Sprint X.13

Le module email existant (`enqueueEmail("booking-validated-on-calendar", ...)` dans `self-service-actions.ts:285-300`) doit être étendu pour injecter dans **tous les templates booking** (`booking-confirmed`, `cancellation-confirmed-by-user`, `reminded-j7`, etc.) un bloc CTA :

```
┌──────────────────────────────────────────────────────────────┐
│ Vos ressources Axion-IA personnalisées                       │
│                                                              │
│ Nous avons sélectionné playbooks, cas concrets et guides     │
│ pour préparer votre intervention « {interventionType} ».    │
│                                                              │
│ [ Accéder à mes ressources → ]                               │
│   (lien : /fr/mes-ressources?t={magic_token_90j})            │
└──────────────────────────────────────────────────────────────┘
```

- Token généré via `signMagicToken({scope:'client_kb', resourceId: bookingId, email: contactEmail, ttlMs: 90*24*60*60*1000})`.
- **Rotation** : chaque email régénère un nouveau token (TTL 90 j fresh). Anciens tokens restent valides jusqu'à expiration naturelle (pas de revoke).

### 5.2 Page `/fr/mes-rendez-vous/` — **à créer en V1**

Cette route est **absente** à HEAD (cf. §1.1). Le prompt §10.3 la mentionne comme « lien depuis `/mes-rendez-vous` » mais elle n'existe pas. **Décision Phase A** : la création de cette page est **hors scope Knowledge Base V1**, c'est un sprint Booking dédié (proposer Sprint X.21 « Espace client booking »). **Reportable**.

Alternative V1 KB-only : le seul lien d'entrée vers `/mes-ressources/` reste **les emails**. Acceptable, aligné Booking V1 self-service.

### 5.3 Lien depuis `/fr/booking/[token]/cancel/` et `/reschedule/`

Pages existantes (`src/app/[locale]/booking/[token]/cancel/page.tsx` notamment). **Proposition** : ajouter en bas un CTA « Découvrir vos ressources Axion-IA » qui régénère un token `client_kb` côté server action et redirige.

**Décision** : V1 simple = ne touche pas ces pages. V1.5 = ajout CTA si Will valide.

---

## 6. ONBOARDING JOURNEY — `type='onboarding_step'`

### 6.1 Modèle

- Nouveau `type` enum dans `knowledge-base.ts` SSOT : `onboarding_step`.
- Chaque entrée `onboarding_step` a des métadonnées additionnelles (JSON) :
  - `sequence`: number (1..N)
  - `triggerInterventionTypes`: InterventionType[] (formats déclenchant cette séquence)
  - `triggerPhase`: 'before' | 'after' (avant ou après date booking)
  - `triggerOffsetDays`: number (J+N par rapport à bookingDate)

### 6.2 Matching algorithme

```
Input : booking.interventionType, booking.bookingDate

Pour chaque KnowledgeEntry où type='onboarding_step' :
  SI entry.triggerInterventionTypes contient booking.interventionType
  ET entry.triggerPhase respecté vs Date.now() vs booking.bookingDate
  ALORS inclure dans la séquence onboarding ordonnée par entry.sequence

Output : OnboardingStep[] ordonnés
```

### 6.3 Affichage V1.5 — `/fr/mes-ressources/onboarding/`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Votre parcours « Audit Approfondie »                                         │
│                                                                              │
│ ┌────────┐  ✅ Étape 1 : Préparer votre audit (J-7)                          │
│ │   1    │     « Cochez ces 12 prérequis avant notre intervention »          │
│ └────────┘     Lecture 8 min · publié 2026-04-12                             │
│                                                                              │
│ ┌────────┐  ⏳ Étape 2 : Le jour J (J-0)                                     │
│ │   2    │     « À quoi ressemblera l'intervention concrètement »            │
│ └────────┘     Lecture 5 min · publié 2026-04-12                             │
│                                                                              │
│ ┌────────┐  🔒 Étape 3 : Vos premières actions (J+7)                         │
│ │   3    │     (déverrouillé après l'intervention)                           │
│ └────────┘                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Verrouillage temporel : `triggerPhase='after' + triggerOffsetDays=7` → masqué tant que `Date.now() < bookingDate + 7d`.
- V1 = pas d'UI dédiée, simplement injection des onboarding_steps dans le feed `/mes-ressources/` avec pin élevé.
- V1.5 = route `/onboarding/` dédiée + visualisation séquence.

---

## 7. MODÈLE `KnowledgeBookmark` (V1.5)

### 7.1 Schéma Prisma (à inclure Sprint KB-18)

```prisma
model KnowledgeBookmark {
  id              String          @id @default(uuid()) @db.Uuid
  knowledgeEntry  KnowledgeEntry  @relation(fields: [knowledgeEntryId], references: [id], onDelete: Cascade)
  knowledgeEntryId String         @map("knowledge_entry_id") @db.Uuid

  // PAS de FK ClientUser car pas de modèle User client.
  // Pivot d'identité = bookingId (cohérent avec magic-token session).
  bookingId       String          @map("booking_id") @db.Uuid
  booking         Booking         @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  // Snapshot pour traçabilité (Booking peut être annulé, on garde le bookmark
  // tant que la session client est active — mais cascade delete si booking purgé RGPD).
  contactEmail    String          @map("contact_email") @db.VarChar(255)

  // Note privée client (markdown court, max 2000 chars).
  // confidentiality='confidential' par défaut.
  privateNoteMd   String?         @map("private_note_md") @db.Text

  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  @@unique([bookingId, knowledgeEntryId])  // anti-doublon
  @@index([bookingId])
  @@index([knowledgeEntryId])
  @@map("knowledge_bookmarks")
}
```

### 7.2 Décision « notes dans bookmark » vs « table dédiée `KnowledgeClientNote` »

**Recommandation Phase A : note inline dans `KnowledgeBookmark.privateNoteMd`** :

- Pro : 1 table = 1 modèle simple, pas de FK supplémentaire.
- Pro : pas de note sans bookmark (UX : si je note, je marque, c'est logique).
- Contra : si on veut « note sans bookmark » (rare), V2+ table dédiée.

**Alternative** : table `KnowledgeClientNote` séparée avec FK `bookmarkId` nullable.

### 7.3 Sanitization markdown notes privées

- Lib whitelist stricte (cf. §0.0/38) — pas de JS, pas d'images externes, pas d'iframes.
- Limites : 2000 chars, 50 lignes, pas de liens externes (V1.5). V2+ peut autoriser liens internes KB.
- Stockage chiffré au repos = **NON V1.5** (note privée client = `confidentiality='confidential'` mais pas `secret`). Décision Will si exigence renforcée.

---

## 8. SÉCURITÉ — checklist non négociable

### 8.1 Headers / Meta

- `robots: { index: false, follow: false }` sur **toutes** routes `/fr/mes-ressources/*` (réutilise pattern `cancel/page.tsx:22-25`).
- `X-Robots-Tag: noindex, nofollow` header HTTP via middleware Next (à confirmer Agent 4).
- `Cache-Control: private, no-store` (jamais cacher côté CDN — Cloudflare bypass).
- Pas de `og:image` (pas de partage social, contenu privé).

### 8.2 robots.txt

Ajout entrée :

```
User-agent: *
Disallow: /fr/mes-ressources/
Disallow: /en/my-resources/
```

(Agent 6 doit aussi documenter, voir parity).

### 8.3 CSP renforcée

- CSP nonce-based déjà en place (mémoire `axionia_session_2026-05-09_sprint_24`).
- Pour `/mes-ressources/*`, **durcir** :
  - `connect-src 'self'` (pas d'API externe).
  - `img-src 'self' data:` (uniquement images servies localement).
  - `frame-src 'none'` (pas d'iframe).
  - `form-action 'self'`.
- Pas de Plausible script sur cette surface ? **Décision Phase A** : ne pas tracker côté Plausible les routes client (consent opt-in obligatoire RGPD, cf. §8.5).

### 8.4 Audit log `kb.client.view`

Événement ActivityLog (table existante, cf. reality check §1.1) :

```
{
  action: 'kb.client.view',
  targetType: 'KnowledgeEntry',
  targetId: <entryId>,
  changes: {
    bookingId: <bookingId>,            // PII : OUI mais nécessaire audit
    contactEmail: <hashed-sha256>,     // hash (PII minimization, ADR 0010 pattern)
    referrer: <internal-only>
  },
  ipAddress: null  // pas de stockage IP (sauf consent explicite cookie)
}
```

**Restrictions PII** :

- Hash SHA-256 de `contactEmail` (pas plain text) — pattern PII redaction Telegram étendu.
- Pas d'IP, pas d'UA (sauf consent explicite — voir §8.5).
- Rétention 90 j max (extend `retention-purge` cron).

### 8.5 Cookie consent — opt-in tracking

- **V1** : aucun tracking analytics sur `/mes-ressources/*` (zéro `kb_view` Plausible côté client). Audit log `kb.client.view` est **server-side, anonymisé** (hash email), donc OK RGPD sans consent.
- **V1.5** : si Will valide opt-in cookie consent banner spécifique « accepter les statistiques d'usage de cet espace », ajouter event Plausible `kb_client_view` (sans userId).

### 8.6 Fuite ID en URL — anti-pattern

- **Jamais** `bookingId` ou `contactEmail` en query string visible.
- Le magic-token contient déjà bookingId chiffré (HMAC) → query string `?t=...` OK.
- Cookie session contient bookingId → URL `/mes-ressources/[slug]` reste opaque.
- **PROSCRIT** : `/mes-ressources?booking=abc-123` ou `/mes-ressources/[bookingId]/...`.

### 8.7 Rate limit

- Server actions consultées sur cette surface : `getMyResources`, `getResourceDetail`, `bookmarkResource`, `unbookmarkResource`, `saveNote`.
- Rate limit Redis bucket par `bookingId` : 60 actions / 60 s. Pattern `checkRateLimit` (`src/lib/rate-limit.ts`, déjà en place).
- Cookie session falsifié → HMAC fail → 401 (pas leak d'erreur métier).

### 8.8 Logout / sortie

- Bouton « Sortir » → server action `exitClientSurfaceAction` → `cookies().delete('kb_client_session')` → redirect `/`.
- Pas de TTL court côté serveur (V1 = cookie expire naturellement à 90 j).

---

## 9. ANTI-PATTERNS — à bannir explicitement

| #   | Anti-pattern                                                          | Conséquence                                                           | Mitigation                                                                                                              |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | SSR sans `robots: noindex`                                            | Indexation Google d'URL privée                                        | Metadata `robots: { index: false, follow: false }` obligatoire sur toutes routes `/mes-ressources/*` (lint custom CI ?) |
| 2   | Filtre serveur basé sur seul `audience='client'` sans check tags      | Tous les clients voient toutes les entrées client (cross-client leak) | Test E2E `@kb-leak` (§4.4)                                                                                              |
| 3   | Filtre `audience='team'` ou `'will-only'` accidentellement servi      | Fuite interne grave                                                   | Whitelist explicite `IN ('public', 'client')` + test bloquant CI                                                        |
| 4   | Cookie session sans `Secure` ou sans `HttpOnly`                       | XSS leak session                                                      | Set-Cookie audit en E2E                                                                                                 |
| 5   | Magic-token réutilisable côté client après revocation admin           | Cookie persistant ignore revocation                                   | jti store Redis (V1.5) ou rotation forcée tous les 24h (V2+)                                                            |
| 6   | `og:image` ou `twitter:card` sur entrée client                        | Aperçu social leak contenu privé si lien partagé                      | Conditional metadata : si `audience='client'` → strip `og:*`                                                            |
| 7   | URL `/mes-ressources/[bookingId]/...`                                 | Énumération bookingId via incrément                                   | URL toujours par slug entry + bookingId en cookie, jamais en URL                                                        |
| 8   | Tracking Plausible/Clarity sans consent explicite                     | Violation RGPD                                                        | Disable scripts côté `/mes-ressources/*` V1                                                                             |
| 9   | Notes privées stockées en clair sans `confidentiality='confidential'` | Confusion équipe sur visibilité                                       | Marquage explicite + export GDPR purge                                                                                  |
| 10  | `revalidate: 3600` sur SSR client surface                             | Cache cross-client                                                    | `dynamic = 'force-dynamic'` + `revalidate = 0`                                                                          |
| 11  | Search FTS sans filtre `audience`                                     | Recherche cross-audience leak                                         | Wrapper helper `searchForClient(bookingId, query)` enforce filter                                                       |
| 12  | Mêmes server actions surface admin + surface client                   | Privilege escalation                                                  | Server actions séparées `src/server/actions/knowledge/client/*`                                                         |

---

## 10. STOP & ASK — décisions ouvertes Phase A

### Top-level (Will doit trancher avant Phase B / Sprint KB-18)

1. **Auth method client** : magic-token longue durée 90 j (recommandation forte reality check) **OU** NextAuth client avec `ClientUser` modèle + password ? Reco V1 = magic-token.
2. **Scope V1 vs V1.5 bookmarks/notes** : V1 = lecture seule (feed personnalisé + détail) ? V1.5 = bookmarks + notes ? Ou tout V1 ? Reco = lecture V1, écriture V1.5 (le client est très peu actif sur des notes/bookmarks en B2B audit ponctuel).
3. **Opt-in tracking client** : zéro analytics V1 ? Ou banner consent dédié dès V1 ? Reco = zéro V1 (RGPD safe, simple).
4. **Page `/mes-rendez-vous/`** : sprint Booking séparé ou inclus V1 KB ? Reco = sprint Booking séparé (Sprint X.21).

### Pratiques (recommandations fortes)

5. **TTL magic-token `client_kb`** : 90 j (reco) ou 30 j ou 180 j ?
6. **Cookie name** : `kb_client_session` (reco) ou autre convention ?
7. **Bandeau visuel « Espace client »** : terracotta full-width (reco, doctrine éditoriale) ou plus discret ?
8. **Lien partage social sur `/mes-ressources/[slug]`** : strip complet (reco anti-leak) ou autoriser pour entries `audience='public'` même servies via surface client ?
9. **Onboarding journey** : `type='onboarding_step'` dédié (reco) ou tag `tag:onboarding` sur entries existants ?
10. **Rate limit** : 60/60s par bookingId (reco) ou plus permissif ?
11. **Audit log retention** : 90 j (reco aligné `retention-purge`) ou autre ?
12. **Hash contactEmail audit log** : SHA-256 reco, ou pas de hash mais email plain text pour debug admin facilité ? (reco : hash, conformité ADR 0010).
13. **Notes markdown stockage** : Postgres TEXT (reco V1.5) + sanitization runtime, ou JSON Tiptap restreint ? Reco TEXT pour simplicité.
14. **Logout vs « sortir »** : libellé bouton ? Reco = « Sortir de mon espace ».

### Risques / portée

15. **Compatibilité dev local sans email** : comment Will teste `/mes-ressources/` en dev ? Reco = server action admin « impersonate booking » avec session cookie set explicite (uniquement adminPrefix, RBAC admin only).
16. **Migration legacy** : si Will avait déjà partagé manuellement des liens à clients (Notion, Drive), pas de migration auto. Reco = nouveau lien KB envoyé à la main par Will aux clients existants après cutover Sprint KB-18.
17. **Multilingue surface client** : `/en/my-resources/` parity ? Reco = OUI parity stricte (clients EN possibles).
18. **Bouton revocation admin** : `/connaissances/clients-actifs/` (V1.5) qui liste les sessions actives + bouton « révoquer ». V1 = pas de UI admin, suffit d'invalider via DB direct si besoin.

---

## 11. LIVRABLES — sprint mapping (informatif, non décisionnel Phase A)

| Sprint       | Contenu                                                                                              | Effort estimé |
| ------------ | ---------------------------------------------------------------------------------------------------- | ------------- |
| KB-1 → KB-7  | Foundations (cf. agents 1-5)                                                                         | — (prérequis) |
| **KB-17**    | Route `/fr/mes-ressources/` + auth magic-token + filtre serveur + tag derivation + audit log + tests | 4-5 j         |
| KB-18        | `KnowledgeBookmark` modèle + UI bookmarks + notes privées (V1.5)                                     | 3 j           |
| KB-19        | Onboarding journey type + UI séquence + matching algo                                                | 2-3 j         |
| KB-20 (V1.5) | Tracking opt-in consent banner                                                                       | 1 j           |
| KB-21 (V2+)  | NextAuth client si demandé                                                                           | 5-7 j         |

**Effort total V1 surface client (KB-17)** : ~5 j dev (incluant tests E2E `@kb-leak` + Vitest matching + Playwright SSR + Lighthouse).

---

## 12. CHECKLIST PRÉ-MERGE Sprint KB-17

- [ ] Route `/fr/mes-ressources/page.tsx` + `loading.tsx` + `error.tsx`.
- [ ] Route `/fr/mes-ressources/[slug]/page.tsx` + parity EN `/en/my-resources/`.
- [ ] Helper `src/lib/knowledge/derive-client-tags.ts` + tests Vitest ≥ 15 cas.
- [ ] Helper `src/lib/knowledge/client-session.ts` (set/get/clear cookie HMAC).
- [ ] Server action `enterClientSurfaceAction(token)` + `exitClientSurfaceAction()`.
- [ ] Server action `listClientResourcesAction({ filters, cursor })` + `getClientResourceAction(slug)`.
- [ ] Server action `recordClientViewAction(entryId)` (audit log hash email).
- [ ] Filtre serveur invariant testé en E2E `@kb-leak` (3 entries seed `team`/`will-only`/`client`).
- [ ] Magic-token scope `client_kb` ajouté `magic-token.ts:26` + TTL 90 j.
- [ ] Email template `booking-validated-on-calendar` étendu avec CTA `/mes-ressources?t=...`.
- [ ] CSP durcie sur ces routes (CHECK via curl headers).
- [ ] `robots.txt` mis à jour.
- [ ] Sitemap **exclut** ces routes (lint en CI).
- [ ] ActivityLog cron purge 90 j honoré pour `kb.client.*` events.
- [ ] LHCI 3 pages pivot : `/fr/mes-ressources/`, `/fr/mes-ressources/[slug-test]`, `/fr/mes-ressources/login-failed`.
- [ ] Doc mise à jour : `AGENTS.md` + `docs/adr/0021-knowledge-base.md` (mention surface client).

---

## 13. COMPATIBILITÉ DOCTRINE — récap

| Doctrine                 | Statut surface client | Mitigation                                             |
| ------------------------ | --------------------- | ------------------------------------------------------ |
| Code = SSOT              | ✅                    | Mapping interventionType→tags dans `knowledge-base.ts` |
| Zero-hardcode            | ✅                    | Tags dérivés, types KB, audience enum tous en SSOT     |
| Naming Axion-IA          | ✅                    | Bandeau « Espace client » FR-first, EN parity stricte  |
| Hetzner CPX32 + CF Free  | ✅                    | Cookie HMAC = zéro infra externe                       |
| Web Vitals (LCP/INP/CLS) | ✅                    | Pas de JS lourd, SSR pur, AVIF images                  |
| Email maison Zoho        | ✅                    | Réutilise stack email V1 + lien magic-token            |
| Cabinet IA opérationnel  | ✅                    | Aucune mention « agence/studio » dans copy             |
| Telegram PII ADR 0010    | ✅                    | Hash SHA-256 contactEmail dans audit log               |
| RGPD                     | ✅                    | Cookie consent V1 = aucun tracking, opt-in V1.5        |
| FR-first parity EN       | ✅                    | `/en/my-resources/` exigée                             |

---

## 14. RÉSUMÉ EXÉCUTIF — pour Will

**Surface client V1 = lecture seule personnalisée, auth zéro friction.**

1. Le client reçoit son lien dans **chaque email post-booking** (TTL 90 j renouvelé à chaque envoi).
2. Clic → cookie HttpOnly+Secure+SameSite=Strict (HMAC bookingId+email+exp) → `/fr/mes-ressources/`.
3. Feed filtré côté serveur : `audience IN ('public','client')` + tags dérivés de `interventionType`+`companySize`+phase booking.
4. Pas de password, pas de signup, pas de NextAuth client en V1.
5. Pas de tracking analytics V1 (RGPD safe par construction).
6. Bookmarks + notes privées = V1.5 (modèle `KnowledgeBookmark`).
7. Onboarding journey = V1.5 (séquence `type='onboarding_step'` matchée par service réservé).

**Effort V1 (Sprint KB-17)** : ~5 j dev. **Bloque sur 4 STOP & ASK top-level** (§10/1-4).

**Risque #1** : fuite entry `team`/`will-only` par bug filtre serveur. **Mitigation** : test E2E `@kb-leak` obligatoire + invariant CI sur listClientResourcesAction.

**Risque #2** : multi-device — si client supprime cookie, redemande email. Acceptable B2B V1.

---

**Fin Agent 7 — Surface client connectée.** Prêt pour synthèse Phase A agrégée (agent final) + GO Phase B Sprint KB-17 sur validation Will des 4 STOP & ASK top-level.
