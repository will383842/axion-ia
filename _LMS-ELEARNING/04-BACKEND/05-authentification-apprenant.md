# Backend — Authentification apprenant (hybride magic-link + mot de passe)

> **Spécification d'implémentation** de l'auth apprenant du LMS : magic-link par défaut (réutilise `PortailAcces`), **mot de passe optionnel** (argon2id) pour les équipes entreprise, **2FA optionnel** (TOTP, réutilise l'infra admin), gestion de session, reset, sécurité (rate-limit, timing-safe, anti-énumération, lockout), et **cohabitation stricte avec NextAuth v5 sans régression**.
>
> Référence ADR : **ADR-LMS-0001** (auth hybride, monde séparé de NextAuth), **ADR-LMS-0007** (cloisonnement `src/server/elearning/**`), **ADR-LMS-0008** (migrations additives).
>
> Ce document est le **complément backend** du data model `03-DATA-MODEL/04-schema-comptes-acces-auth.md`. Le data model définit les **modèles/champs/enums** ; ici on définit **les services, les flux, le middleware, la sécurité et les tests**. Les noms de modèles (`Trainee` étendu, `PortailAcces`, `ElearningAuthToken`, `ElearningOrgMembership`) et de fichiers (`learner-auth-service.ts`, `learner-guard.ts`, `learner-account.actions.ts`) sont **figés par le doc 04** — on les respecte à l'identique.

---

## 0. TL;DR pour un dev senior

- **L'apprenant EST le `Trainee` existant** (`prisma/schema.prisma:5274`), étendu d'un `passwordHash` **nullable** (argon2id). On ne crée **aucun** nouveau modèle « user ».
- **Deux mondes étanches.** NextAuth v5 (`src/auth.ts`/`src/auth.config.ts`) ne gère **QUE** les `AdminUser` (cookie `authjs.session-token`, provider Credentials + TOTP). L'apprenant a son **cookie opaque dédié `portail_session`** + table `PortailAcces` + ses propres guards. **Aucune** table, aucun cookie, aucun callback partagé → **zéro risque de régression admin**.
- **Magic-link = chemin par défaut.** Deux variantes :
  1. _Session directe_ (octroi admin / portail Qualiopi existant) → `PortailAcces` via `creerAcces`/`verifierToken` **tel quel** (réutilisation pure).
  2. _Magic-login one-shot self-service_ (apprenant tape son email) → `ElearningAuthToken` (purpose `magic_login`, **haché** SHA-256, `usedAt`) → puis on crée la session `PortailAcces`.
- **Mot de passe = opt-in entreprise.** Réutilise **`src/lib/auth-password.ts`** (argon2id SSOT, `hashPassword`/`verifyPasswordSafe` avec dummy-hash anti-oracle). **Ne JAMAIS redéclarer argon2.**
- **2FA = optionnel** (TOTP), réutilise `src/lib/auth-2fa.ts` (otplib). **Hors MVP** (doc 04 §8.1) mais **conçu ici** comme capacité V1 gated `LEARNER_2FA_ENABLED`. Le magic-link étant déjà un facteur de possession fort, le 2FA n'est pertinent que pour les comptes mot de passe à privilèges (`org_admin`/`manager` V2).
- **Tout est stub-aware** (`stub.invalid`) et **`force-dynamic`** → compatible build GH Actions.
- **Code 100 % cloisonné** sous `src/server/elearning/auth/**` + extension du namespace de routes `src/app/[locale]/portail/**`.

---

## 1. Carte EXISTANT (réutilisé) vs NEUF (à construire)

### 1.1 Réutilisé tel quel — vérifié dans le code

| Brique                                                                  | Emplacement réel                                                                                                     | Rôle                                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Trainee` (identité)                                                    | `prisma/schema.prisma:5274`                                                                                          | Identité apprenant ; `email @unique @db.Citext` = identifiant de login.                                                                                    |
| `PortailAcces` (session)                                                | `prisma/schema.prisma:6236`                                                                                          | Session opaque : `token @unique @db.VarChar(64)`, `expiresAt`, `revoked`, `lastUsedAt`.                                                                    |
| `creerAcces` / `verifierToken` / `revoquerAcces` / `getEspaceStagiaire` | `src/server/qualiopi/portail/portail-service.ts`                                                                     | Génération token (`randomBytes(32)→64 hex`), **vérif timing-safe** (`timingSafeEqual`), stub-aware. **Réutilisés tels quels.**                             |
| `setPortailCookie` / `getPortailToken` / `clearPortailCookie`           | `src/server/qualiopi/portail/cookie.ts`                                                                              | Cookie `portail_session` (HttpOnly, Secure, SameSite=Lax, Path=/, maxAge 90 j). **Réutilisés tels quels.**                                                 |
| `hashPassword` / `verifyPasswordSafe`                                   | `src/lib/auth-password.ts`                                                                                           | **SSOT argon2id** (argon2id, memoryCost 19456, timeCost 2, parallelism 1) + **dummy-hash anti-oracle timing**.                                             |
| `signMagicToken` / `verifyMagicToken`                                   | `src/lib/magic-token.ts`                                                                                             | Tokens HMAC-SHA256 Edge-safe, scopés + TTL. (Voie alternative non-sensible ; cf. §6.)                                                                      |
| `generate2FASecret` / `verify2FACode` / `current2FACode`                | `src/lib/auth-2fa.ts`                                                                                                | TOTP RFC 6238 (otplib v13), tolérance ±30 s. **Réutilisé pour le 2FA apprenant optionnel.**                                                                |
| `checkRateLimit`                                                        | `src/lib/rate-limit.ts`                                                                                              | Sliding-window Redis, **fail-open** si Redis down.                                                                                                         |
| `getClientIp`                                                           | `src/lib/client-ip.ts`                                                                                               | IP client (rate-limit + audit).                                                                                                                            |
| `enqueueEmail`                                                          | `src/server/queue/queues.ts`                                                                                         | Mise en file BullMQ d'un email (consommé par `email-worker`).                                                                                              |
| `encryptPii` / `decryptPii`                                             | `src/lib/pii-crypto`                                                                                                 | Chiffrement PII (handicap) — inchangé, mentionné pour `getEspaceStagiaire`.                                                                                |
| Route handler magic-link Qualiopi                                       | `src/app/[locale]/portail/acces/[token]/route.ts`                                                                    | Existant : rate-limit IP → `verifierToken` → cookie → 302. **Étendu** (`authMethod`), pas réécrit.                                                         |
| Patterns de référence (à copier)                                        | `src/server/formateur/magic-link.ts`, `src/lib/formateur-session.ts`, `src/server/actions/formateur/auth.actions.ts` | Magic-link **usage-unique haché** (`tokenHash` + `usedAt` + `updateMany` atomique), réponse **générique anti-énumération**, rate-limit composite IP+email. |

### 1.2 Neuf à construire (cloisonné ADR-0007)

| Élément                                                                | Type                   | Emplacement cible                                           |
| ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `learner-auth-service.ts`                                              | service domaine        | `src/server/elearning/auth/learner-auth-service.ts`         |
| `learner-guard.ts` (`requireLearner`/`getLearnerSession`)              | guard                  | `src/server/elearning/auth/learner-guard.ts`                |
| `learner-token-service.ts` (tokens hachés one-shot)                    | service                | `src/server/elearning/auth/learner-token-service.ts`        |
| `learner-2fa-service.ts` (TOTP optionnel)                              | service                | `src/server/elearning/auth/learner-2fa-service.ts`          |
| `learner-account.actions.ts`                                           | server actions         | `src/server/elearning/auth/learner-account.actions.ts`      |
| Schemas Zod                                                            | validation             | `src/lib/schemas/learner-auth.ts`                           |
| Routes/pages portail (connexion, lien, reset, déconnexion, invitation) | route handlers + pages | `src/app/[locale]/portail/**` (extension)                   |
| Composants formulaires apprenant                                       | UI                     | `src/components/elearning/auth/**`                          |
| Templates email React                                                  | email                  | `src/lib/email/templates/elearning-*.tsx`                   |
| Garde middleware `/portail/*`                                          | Edge                   | `src/proxy.ts` (ajout d'un bloc, cf. §7)                    |
| Cron purge sessions/tokens                                             | worker/cron            | `src/server/queue/workers/elearning-auth-cleanup-worker.ts` |

---

## 2. Modèle mental : 3 jetons distincts (ne pas les confondre)

L'auth apprenant manipule **trois** types de jetons aux durées de vie et propriétés opposées. C'est la source de confusion #1 — on la fige ici.

| Jeton              | Table / lib                         | Durée         | Stockage                                                   | Usage                                                                              | Edge-safe ?          |
| ------------------ | ----------------------------------- | ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| **Session**        | `PortailAcces.token`                | 90 j          | **clair** en base (déjà le cas), comparé `timingSafeEqual` | porté par le cookie `portail_session` après login réussi ; révocable, multi-device | non (Node/Prisma)    |
| **One-shot email** | `ElearningAuthToken.tokenHash`      | 15 min – 24 h | **SHA-256** (jamais en clair)                              | magic-login, reset, setup mot de passe, vérif email ; consommé une fois (`usedAt`) | non (Node/Prisma)    |
| **HMAC stateless** | `signMagicToken`/`verifyMagicToken` | TTL scope     | **aucun** (signé, autonome)                                | liens **non sensibles** uniquement (réutilisable jusqu'à expiration)               | **oui** (Web Crypto) |

> **Décision (alignée doc 04 §6).** Tous les flux **email-sensibles** (magic-login, reset, setup, vérif) passent par `ElearningAuthToken` **haché + one-shot**. On **n'utilise PAS** `signMagicToken` pour ces flux (il est _replayable_ jusqu'à expiration — cf. le commentaire « Replay attack » de `magic-token.ts`). Le HMAC reste disponible si un besoin de lien autonome non-sensible apparaît (ex. lien de partage de catalogue). On **n'ajoute donc PAS** de scope `learner_login` à `MagicScope` au MVP.

---

## 3. Service de tokens one-shot — `learner-token-service.ts` (neuf)

Calque direct de `src/server/formateur/magic-link.ts` (mêmes primitives), mais générique par `purpose` et rattaché au `Trainee`.

```ts
// src/server/elearning/auth/learner-token-service.ts
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ElearningAuthTokenPurpose } from "../../../../prisma/generated/client";

/** TTL par finalité (ms). Court pour les flux sensibles. */
const TTL_MS: Record<ElearningAuthTokenPurpose, number> = {
  magic_login: 20 * 60 * 1000, // 20 min
  password_reset: 60 * 60 * 1000, // 1 h
  password_setup: 24 * 60 * 60 * 1000, // 24 h (invitation entreprise)
  email_verification: 24 * 60 * 60 * 1000, // 24 h
};

/** SHA-256 hex (64 chars) via Web Crypto — même doctrine que formateur/magic-link.ts. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Crée un token one-shot. Retourne le SECRET EN CLAIR (à mettre dans l'URL email). */
export async function creerAuthToken(
  traineeId: string,
  purpose: ElearningAuthTokenPurpose,
  createdIp?: string | null,
): Promise<string> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerAuthToken: stub DB — indisponible au build");
  }
  const secret = randomBytes(32).toString("hex"); // 64 hex, jamais stocké en clair
  const tokenHash = await sha256Hex(secret);
  // Purge opportuniste des tokens du même couple (trainee, purpose) déjà consommés/expirés.
  await prisma.elearningAuthToken.deleteMany({
    where: {
      traineeId,
      purpose,
      OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
    },
  });
  await prisma.elearningAuthToken.create({
    data: {
      traineeId,
      purpose,
      tokenHash,
      expiresAt: new Date(Date.now() + TTL_MS[purpose]),
      createdIp: createdIp ?? null,
    },
  });
  return secret;
}

/**
 * Consomme un token one-shot de façon ATOMIQUE (anti double-usage / race).
 * Retourne { traineeId } si valide, sinon null. Ne révèle jamais la raison.
 */
export async function consommerAuthToken(
  secret: string,
  purpose: ElearningAuthTokenPurpose,
): Promise<{ traineeId: string } | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  if (typeof secret !== "string" || secret.length !== 64) return null;
  const tokenHash = await sha256Hex(secret);
  // updateMany conditionnel = consommation atomique : 0 ligne ⇒ inconnu/déjà utilisé/expiré.
  const updated = await prisma.elearningAuthToken.updateMany({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (updated.count === 0) return null;
  const row = await prisma.elearningAuthToken.findUnique({
    where: { tokenHash },
    select: { traineeId: true },
  });
  return row ? { traineeId: row.traineeId } : null;
}
```

**Points clés**

- **Atomicité** : `updateMany({ where: usedAt:null, expiresAt:>now }, { usedAt:now })` → la base garantit qu'un token n'est consommé qu'une fois, même sous concurrence (double-clic, préchargement de lien email par un antivirus).
- **Hachage** : on stocke `SHA-256(secret)`. Une fuite de la table ne donne aucun lien utilisable.
- **Lookup par hash** : on cherche par `tokenHash` (index unique), pas par `traineeId` → pas d'oracle d'énumération.

---

## 4. Service de session — extension de `portail-service.ts` (réutilisation + ajout)

La session reste **`PortailAcces`** (doc 04 §4 : « pas de nouvelle table de session »). On **réutilise** `verifierToken`/`revoquerAcces`/`getEspaceStagiaire` **tels quels**, et on ajoute deux helpers (dans `learner-auth-service.ts`, qui orchestre) :

```ts
// Variante enrichie de creerAcces() — pose les métadonnées d'audit (doc 04 §4).
// On NE modifie PAS creerAcces() (utilisé par le Qualiopi portail) : on ajoute creerSession().
export async function creerSession(input: {
  traineeId: string;
  authMethod: "magic" | "password" | "import" | "admin";
  ip?: string | null;
  userAgent?: string | null;
  joursValidite?: number; // défaut 90
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerSession: stub DB");
  }
  const token = randomBytes(32).toString("hex"); // 64 hex (même primitive que creerAcces)
  const jours = input.joursValidite ?? 90;
  const acces = await prisma.portailAcces.create({
    data: {
      traineeId: input.traineeId,
      token,
      expiresAt: new Date(Date.now() + jours * 86_400_000),
      authMethod: input.authMethod,
      createdIp: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
    select: { id: true, token: true, expiresAt: true },
  });
  return acces;
}

/** Révoque TOUTES les sessions actives d'un apprenant (après reset / suspension). */
export async function revoquerToutesSessions(traineeId: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) throw new Error("stub DB");
  await prisma.portailAcces.updateMany({
    where: { traineeId, revoked: false },
    data: { revoked: true },
  });
}
```

> **Important** : la pose du cookie reste faite par `setPortailCookie(token)` (`cookie.ts`), appelée **uniquement** depuis une Server Action ou un Route Handler (contrainte Next 16). `creerSession` ne touche pas au cookie — elle renvoie le token, l'appelant pose le cookie.

---

## 5. Service d'orchestration — `learner-auth-service.ts` (neuf)

Cœur métier. **Aucune** logique d'I/O HTTP ici (pas de `cookies()` direct sauf via helpers) ; testable unitairement.

```ts
// src/server/elearning/auth/learner-auth-service.ts (extrait des signatures)
export async function getLearnerByEmail(email: string): Promise<Trainee | null>;

export async function loginAvecMotDePasse(input: {
  email: string;
  password: string;
  ip: string;
  userAgent?: string;
}): Promise<
  | { ok: true; token: string; expiresAt: Date; require2fa: false }
  | { ok: true; require2fa: true; challengeId: string } // 2FA activé : étape suivante
  | { ok: false } // toujours générique (anti-énumération)
>;

export async function demanderMagicLogin(email: string, ip: string): Promise<void>; // jamais throw "user not found"
export async function consommerMagicLogin(
  secret: string,
  ip: string,
  userAgent?: string,
): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false }>;

export async function definirMotDePasse(input: {
  traineeId: string;
  password: string;
}): Promise<void>;
export async function demanderReset(email: string, ip: string): Promise<void>;
export async function consommerReset(
  secret: string,
  nouveauPassword: string,
): Promise<{ ok: true } | { ok: false }>;

export async function verifierEmail(secret: string): Promise<{ ok: boolean }>;
export async function logout(): Promise<void>; // révoque la session courante + clear cookie
```

### 5.1 `loginAvecMotDePasse` — logique de référence (anti-bruteforce 2 couches)

```ts
export async function loginAvecMotDePasse(input) {
  // Couche 1 : rate-limit Redis par IP (volatile, fail-open).
  const rl = await checkRateLimit(`learner:login:ip:${input.ip}`, { limit: 5, windowSec: 900 });
  if (!rl.allowed) return { ok: false } as const; // pas d'oracle "rate-limited"

  const email = input.email.toLowerCase().trim();
  const trainee = await prisma.trainee.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      learnerStatut: true,
      deletedAt: true,
      lockedUntil: true,
      failedLoginCount: true,
      twoFactorEnabled: true, // cf. §8 (capacité optionnelle)
    },
  });

  // Couche 2 : verrou COMPTE persistant (en plus du rate-limit IP).
  const now = new Date();
  if (trainee?.lockedUntil && trainee.lockedUntil > now) return { ok: false } as const;
  if (trainee?.deletedAt) return { ok: false } as const;
  if (trainee && trainee.learnerStatut === "suspendu") return { ok: false } as const;

  // Vérif timing-safe AVEC dummy-hash (égalise le timing même si compte inexistant).
  const ok = await verifyPasswordSafe(trainee?.passwordHash ?? null, input.password);

  if (!ok || !trainee) {
    if (trainee) {
      const fails = trainee.failedLoginCount + 1;
      const lockedUntil = fails >= 10 ? new Date(now.getTime() + 15 * 60_000) : null; // 15 min après 10 échecs
      await prisma.trainee.update({
        where: { id: trainee.id },
        data: { failedLoginCount: fails, ...(lockedUntil ? { lockedUntil } : {}) },
      });
    }
    return { ok: false } as const; // message générique côté action
  }

  // Succès mot de passe. Reset compteurs.
  await prisma.trainee.update({
    where: { id: trainee.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastLoginIp: input.ip,
      lastLoginMethod: "password",
      learnerStatut: trainee.learnerStatut === "invite" ? "actif" : trainee.learnerStatut,
    },
  });

  // Si 2FA activé (capacité optionnelle), on ne pose PAS la session tout de suite.
  if (trainee.twoFactorEnabled) {
    const challengeId = await ouvrir2faChallenge(trainee.id, input.ip); // §8
    return { ok: true, require2fa: true, challengeId } as const;
  }

  const session = await creerSession({
    traineeId: trainee.id,
    authMethod: "password",
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return {
    ok: true,
    require2fa: false,
    token: session.token,
    expiresAt: session.expiresAt,
  } as const;
}
```

### 5.2 `demanderMagicLogin` / `consommerMagicLogin`

```ts
export async function demanderMagicLogin(email, ip) {
  // Toujours générique : on ne révèle jamais si l'email existe.
  const e = email.toLowerCase().trim();
  const rlIp = await checkRateLimit(`learner:magic:ip:${ip}`, { limit: 10, windowSec: 900 });
  const rlEmail = await checkRateLimit(`learner:magic:email:${e}`, { limit: 5, windowSec: 900 });
  if (!rlIp.allowed || !rlEmail.allowed) return; // silencieux

  const trainee = await prisma.trainee.findUnique({
    where: { email: e },
    select: { id: true, prenom: true, deletedAt: true, learnerStatut: true },
  });
  if (!trainee || trainee.deletedAt || trainee.learnerStatut === "suspendu") return; // silencieux

  const secret = await creerAuthToken(trainee.id, "magic_login", ip);
  await enqueueEmail("elearning-magic-login", e, "fr", {
    magicLink: buildLearnerMagicUrl(secret), // /fr/portail/connexion/lien?token=...
    prenom: trainee.prenom || undefined,
    expiresInMin: 20,
  });
}

export async function consommerMagicLogin(secret, ip, userAgent) {
  const res = await consommerAuthToken(secret, "magic_login");
  if (!res) return { ok: false } as const;
  // Magic-link = preuve de possession de la boîte → vérifie l'email + active le compte.
  await prisma.trainee.update({
    where: { id: res.traineeId },
    data: {
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      lastLoginMethod: "magic",
      learnerStatut: "actif",
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  const session = await creerSession({
    traineeId: res.traineeId,
    authMethod: "magic",
    ip,
    userAgent,
  });
  return { ok: true, token: session.token, expiresAt: session.expiresAt } as const;
}
```

### 5.3 `definirMotDePasse` / reset

```ts
export async function definirMotDePasse({ traineeId, password }) {
  const hash = await hashPassword(password); // SSOT auth-password.ts (jette si < 8 chars)
  await prisma.trainee.update({
    where: { id: traineeId },
    data: { passwordHash: hash, passwordSetAt: new Date() },
  });
  await revoquerToutesSessions(traineeId); // invalide les sessions ouvertes ailleurs
}

export async function consommerReset(secret, nouveauPassword) {
  const res = await consommerAuthToken(secret, "password_reset");
  if (!res) return { ok: false } as const;
  await definirMotDePasse({ traineeId: res.traineeId, password: nouveauPassword });
  return { ok: true } as const; // l'utilisateur se reconnecte ensuite
}
```

> `demanderReset(email)` est **strictement symétrique** à `demanderMagicLogin` (réponse générique, rate-limit IP+email, token `password_reset`). `verifierEmail(secret)` consomme un token `email_verification` et pose `emailVerifiedAt`.

---

## 6. Guard apprenant — `learner-guard.ts` (neuf, réutilise `portail-service.ts`)

```ts
// src/server/elearning/auth/learner-guard.ts
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service"; // timing-safe + stub-aware

/** Session apprenant ou null. À utiliser dans les pages/Server Components e-learning. */
export async function getLearnerSession(): Promise<{ traineeId: string } | null> {
  const token = await getPortailToken();
  if (!token) return null;
  return verifierToken(token); // { traineeId } | null
}

/** Throw "unauthorized" si non connecté (à mapper en redirect /portail/connexion). */
export async function requireLearner(): Promise<{ traineeId: string }> {
  const s = await getLearnerSession();
  if (!s) throw new Error("unauthorized");
  return s;
}
```

> **Règle d'or de cohabitation** : un code e-learning **ne doit jamais** appeler `auth()` (NextAuth) pour authentifier un apprenant. Inversement, l'admin de l'outil auteur / octroi appelle `requireAdminWrite()` (`src/server/actions/knowledge/_guards.ts`) comme le reste de la console. Les deux ne se croisent jamais.

---

## 7. Middleware — garde `/portail/*` dans `proxy.ts` (Edge, sans Prisma)

`src/proxy.ts` (Next 16) fusionne déjà NextAuth + next-intl + CSP, et porte des gardes Edge pour `/espace-formateur/*` et `/espace-ressources/*` (lignes ~114-157). On **ajoute un bloc analogue** pour le portail apprenant, **sans appel DB** (Edge runtime interdit Prisma).

**Subtilité importante** : la session apprenant (`PortailAcces.token`) est un **token opaque non vérifiable côté Edge** (sa validité dépend d'un lookup DB `verifierToken`, Node-only). Deux options :

- **Option A (retenue, simple) — garde « présence de cookie » côté Edge + vérif réelle côté Node.** Le middleware vérifie seulement que le cookie `portail_session` **existe** ; s'il est absent → redirect vers `/portail/connexion`. La **vraie** vérification (token valide/non révoqué/non expiré) est faite par `requireLearner()` dans la page/layout (Node). Un cookie présent mais invalide ⇒ `requireLearner()` throw ⇒ la page redirige. C'est le compromis standard pour une session opaque DB.
- _Option B (V1, si on veut un check Edge fort)_ : émettre **en plus** un jeton de session signé HMAC (calque `formateur-session.ts`, audience `learner`) vérifiable Edge, en miroir du `PortailAcces`. Surcoût non justifié au MVP.

```ts
// Dans proxy.ts, après le bloc 0quinquies (espace-ressources), AVANT la génération du nonce.
// 0sexies. Portail apprenant e-learning — garde de présence de session (Edge).
//   Protège /portail/* SAUF les routes d'authentification publiques :
//   /connexion, /acces/<token>, /connexion/lien, /mot-de-passe/*, /invitation/*, /deconnexion.
//   La vérification RÉELLE du token (DB) est faite côté Node par requireLearner().
{
  const m = req.nextUrl.pathname.match(/^\/(fr|en)\/portail(\/.*)?$/);
  if (m) {
    const sub = m[2] ?? "";
    const isPublic =
      sub === "/connexion" ||
      sub.startsWith("/connexion/") ||
      sub.startsWith("/acces/") ||
      sub.startsWith("/mot-de-passe/") ||
      sub.startsWith("/invitation/") ||
      sub === "/deconnexion";
    if (!isPublic) {
      const hasCookie = Boolean(req.cookies.get("portail_session")?.value);
      if (!hasCookie) {
        return NextResponse.redirect(new URL(`/${m[1]}/portail/connexion`, req.url));
      }
    }
  }
}
```

**Cache CDN** : `/portail/*` est déjà couvert par la doctrine de strip de cookies — il faut l'**exclure du strip** (les apprenants connectés doivent garder leur cookie). Ajouter `portail` au regex `STRIP_AUTH_SPACE` de `proxy.ts:241` :

```ts
// AVANT : /^\/(fr|en)\/(espace-formateur|espace-ressources|mes-donnees)(\/|$)/
const STRIP_AUTH_SPACE =
  /^\/(fr|en)\/(espace-formateur|espace-ressources|mes-donnees|portail)(\/|$)/;
```

> Sans ça, le `delete set-cookie` de `proxy.ts` retirerait le cookie `portail_session` des réponses GET du portail (il ne préserve que `*session-token*` = cookie NextAuth admin). **C'est un piège connu** : le strip ne reconnaît pas `portail_session`. Soit on étend `STRIP_AUTH_SPACE` (retenu), soit on ajoute `portail_session` à la regex de préservation.

---

## 8. 2FA optionnel (TOTP) — capacité V1 gated

Doc 04 §8.1 classe le 2FA **hors MVP**. On le **conçoit ici** comme une capacité **optionnelle, opt-in, gated** par un flag, réutilisant **`src/lib/auth-2fa.ts`** (otplib, déjà utilisé par l'admin) — **zéro nouvelle dépendance**.

### 8.1 Quand l'activer

- **Inutile pour le magic-link** : le lien email **est déjà** un facteur de possession. Imposer un TOTP par-dessus dégrade l'UX sans gain réel.
- **Pertinent pour les comptes mot de passe à privilèges** : `manager` / `org_admin` d'entreprise (V2), ou tout compte mot de passe qui le souhaite. Donc : **opt-in par apprenant**, jamais imposé au MVP.

### 8.2 Champs additifs `Trainee` (à ajouter au data model doc 04 §3 — additif, nullable)

```prisma
  // ── 2FA optionnel apprenant (capacité V1, gated LEARNER_2FA_ENABLED) ──
  twoFactorEnabled  Boolean  @default(false) @map("two_factor_enabled")
  /// Secret TOTP base32 chiffré (encryptPii) — JAMAIS en clair, JAMAIS exposé client.
  twoFactorSecret   String?  @map("two_factor_secret") @db.Text
  twoFactorSetAt    DateTime? @map("two_factor_set_at")
```

> Le secret TOTP est **chiffré au repos** via `encryptPii` (même doctrine que `handicapDetailsChiffre`), déchiffré seulement au moment du `verify2FACode`.

### 8.3 Flux

1. **Activation** (`activer2faAction`, requiert session apprenant) : `generate2FASecret(email)` → afficher le QR (otpauth URL) → l'apprenant saisit un code → `verify2FACode` OK → stocker `encryptPii(secret)`, `twoFactorEnabled=true`. Générer des **codes de secours** (10 codes, hachés argon2id via `hashPassword`, table `ElearningRecoveryCode` _(neuf, V1)_ ou JSON chiffré) — **recommandé**.
2. **Login mot de passe** : si `twoFactorEnabled`, `loginAvecMotDePasse` renvoie `require2fa:true` + un **challenge** court (`ElearningAuthToken` purpose dédié _(V1)_ ou état Redis TTL 5 min). On **ne pose pas** la session avant validation TOTP.
3. **Validation** (`valider2faAction`) : `verify2FACode(code, decryptPii(secret))` → si OK, `creerSession` + cookie. Rate-limit `learner:2fa:${traineeId}` (5/300 s) + lockout après N échecs.

> **MVP** : on **n'implémente pas** le 2FA, mais on **réserve** `twoFactorEnabled` et le branchement `require2fa` dans `loginAvecMotDePasse` (no-op tant que le flag est off). Activation = `LEARNER_2FA_ENABLED=true` + UI. Aucune refonte ultérieure.

---

## 9. Cohabitation NextAuth v5 — garanties anti-régression (détail)

C'est la contrainte la plus sensible. On documente chaque point d'étanchéité, vérifiable.

| Dimension  | **Admin (NextAuth v5 — existant)**                                                    | **Apprenant (maison — neuf)**                                          | Étanchéité                                                                         |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Identité   | `AdminUser`                                                                           | `Trainee`                                                              | Tables disjointes. NextAuth (`src/auth.ts`) lit **uniquement** `prisma.adminUser`. |
| Lib        | NextAuth (`src/auth.ts`, `src/auth.config.ts`)                                        | `learner-auth-service.ts` (maison)                                     | Aucune dépendance croisée.                                                         |
| Cookie     | `authjs.session-token` (+ `__Host-authjs.csrf-token`, `__Secure-authjs.callback-url`) | `portail_session`                                                      | **Noms disjoints** → jamais de collision.                                          |
| Session    | JWT NextAuth (stateless, pas d'adapter Prisma)                                        | `PortailAcces` (opaque, en base)                                       | Modèles indépendants ; pas de table `Account`/`Session` NextAuth.                  |
| Hash mdp   | `src/lib/auth-password.ts`                                                            | **le même** `src/lib/auth-password.ts`                                 | Réutilisation SSOT (pas de duplication argon2).                                    |
| 2FA        | TOTP `auth-2fa.ts` (obligatoire super_admin/admin)                                    | TOTP `auth-2fa.ts` (optionnel, opt-in)                                 | Même lib, secrets/flags séparés (`AdminUser` vs `Trainee`).                        |
| Guard      | `auth()` + `requireAdmin*`                                                            | `requireLearner()` / `getLearnerSession()`                             | Fonctions distinctes ; jamais d'appel croisé.                                      |
| Middleware | `callbacks.authorized` (auth.config) redirige `/admin/*`                              | bloc `/portail/*` (présence cookie) dans `proxy.ts`                    | Branches indépendantes du même `proxy.ts`.                                         |
| Typings    | `declare module "next-auth"` → `Session.user.role: AdminRole` (`src/auth.ts:48`)      | **n'y touche pas** ; l'apprenant n'apparaît jamais dans `session.user` | Aucune extension de type NextAuth.                                                 |

**Checklist d'étanchéité à vérifier en revue (et en test, §11) :**

- [ ] `learner-auth-service.ts` / `learner-guard.ts` n'importent **jamais** `@/auth` ni `next-auth`.
- [ ] NextAuth (`src/auth.ts`) n'interroge **jamais** `prisma.trainee` / `prisma.portailAcces`.
- [ ] Aucun nouveau champ dans `declare module "next-auth"`.
- [ ] Le cookie posé par l'apprenant est **exactement** `portail_session` (jamais un nom `authjs.*`).
- [ ] Le bloc `/portail/*` du middleware **n'altère pas** la branche `callbacks.authorized` admin.
- [ ] `STRIP_AUTH_SPACE` étendu à `portail` (sinon perte de session apprenant sur GET — §7).

---

## 10. Flux de bout en bout (séquences)

### 10.1 Magic-link self-service (chemin par défaut)

```
Apprenant            /portail/connexion (action)        Service / DB                Email
  | saisit email ────────────►|
  |                           | demanderMagicLogin(email, ip)
  |                           |   rate-limit IP+email (silencieux si dépassé)
  |                           |   findUnique(email) ── si absent ⇒ return (silencieux)
  |                           |   creerAuthToken(traineeId, magic_login) → secret(64hex)
  |                           |   enqueueEmail("elearning-magic-login", lien=?token=secret) ─────►| (BullMQ → email-worker)
  | ◄──── "Si un compte existe, un lien a été envoyé." (message TOUJOURS générique)
  |
  | clique le lien email
  | GET /portail/connexion/lien?token=secret  (route handler, force-dynamic)
  |                           | rate-limit IP
  |                           | consommerMagicLogin(secret, ip, ua)
  |                           |   consommerAuthToken(secret, magic_login)  ── atomique (usedAt)
  |                           |   update Trainee: emailVerifiedAt, learnerStatut=actif, lastLogin*
  |                           |   creerSession(authMethod="magic") → token PortailAcces
  |                           | setPortailCookie(token)  (HttpOnly/Secure/SameSite=Lax/90j)
  | ◄──── 302 → /portail/mon-espace
```

### 10.2 Login email + mot de passe (entreprise)

```
/portail/connexion (onglet mot de passe) → loginMotDePasseAction(email,password)
  → checkRateLimit(learner:login:ip)            [couche 1]
  → findUnique(email) (+ dummy si absent)
  → lockedUntil > now ? ⇒ échec générique       [couche 2]
  → verifyPasswordSafe(passwordHash, password)  (timing-safe + dummy-hash)
  → échec ⇒ failedLoginCount++ (lock 15min après 10) ⇒ "Identifiants invalides."
  → succès & 2FA off ⇒ creerSession("password") + setPortailCookie → 302 /portail/mon-espace
  → succès & 2FA on  ⇒ require2fa ⇒ /portail/connexion/2fa (challenge) → valider2faAction → session
```

### 10.3 Invitation entreprise + 1re définition de mot de passe

```
Admin (octroi/import) → ElearningInvitation(tokenHash, requireMotDePasse=true) → email "elearning-invitation"
Apprenant clique → /portail/invitation/[token] (page)
  → consomme invitation (one-shot) → upsert Trainee (email citext) + ElearningOrgMembership(clientId)
  → si requireMotDePasse ⇒ creerAuthToken(password_setup) ⇒ /portail/mot-de-passe/definir/[token]
  → definirMotDePasseAction → definirMotDePasse() (hashPassword + revoquerToutesSessions)
  → creerSession("import"/"admin") → cookie → /portail/mon-espace
  → sinon (magic only) ⇒ creerSession + cookie directement
```

### 10.4 Reset mot de passe

```
/portail/mot-de-passe/reset (demande) → demanderResetAction(email)
  → rate-limit IP+email → creerAuthToken(password_reset) → email "elearning-password-reset"
  → réponse générique
clique lien → /portail/mot-de-passe/reset?token=secret (page form nouveau mdp)
  → consommerResetAction(secret, nouveau) → consommerReset → definirMotDePasse (révoque toutes sessions)
  → redirige vers /portail/connexion ("Mot de passe mis à jour, reconnectez-vous.")
```

---

## 11. Server actions & routes (récap)

### 11.1 Server actions — `src/server/elearning/auth/learner-account.actions.ts` (`"use server"`)

| Action                                       | Entrée (Zod)                   | Effet                                                                | Anti-énumération                     |
| -------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- | ------------------------------------ |
| `demanderMagicLinkAction`                    | `{ email }`                    | `demanderMagicLogin`                                                 | **oui** (message générique)          |
| `loginMotDePasseAction`                      | `{ email, password }`          | `loginAvecMotDePasse` + `setPortailCookie`                           | **oui** (« Identifiants invalides ») |
| `definirMotDePasseAction`                    | `{ token, password, confirm }` | `consommerAuthToken(password_setup)` + `definirMotDePasse` + session | n/a (token)                          |
| `demanderResetAction`                        | `{ email }`                    | `demanderReset`                                                      | **oui**                              |
| `consommerResetAction`                       | `{ token, password, confirm }` | `consommerReset`                                                     | n/a (token)                          |
| `logoutAction`                               | —                              | `logout()` (`revoquerAcces` session courante + `clearPortailCookie`) | —                                    |
| `activer2faAction` / `valider2faAction` (V1) | `{ code }`                     | TOTP (§8)                                                            | rate-limit `learner:2fa`             |

Chaque action : `getClientIp()` → `checkRateLimit` → validation Zod (`src/lib/schemas/learner-auth.ts`) → service → **jamais** de retour de `passwordHash`/`twoFactorSecret`.

### 11.2 Routes (extension `src/app/[locale]/portail/**`, toutes `force-dynamic`)

| Route                                            | Type                       | Rôle                                                                       |
| ------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------- |
| `/[locale]/portail/connexion`                    | page                       | Onglets « lien magique » / « email + mot de passe »                        |
| `/[locale]/portail/acces/[token]`                | route handler **existant** | Magic-link Qualiopi (octroi admin) → cookie (enrichi `authMethod="magic"`) |
| `/[locale]/portail/connexion/lien`               | route handler              | `consommerMagicLogin(?token=)` → cookie → `mon-espace`                     |
| `/[locale]/portail/connexion/2fa`                | page + action              | Challenge TOTP (V1, si `require2fa`)                                       |
| `/[locale]/portail/mot-de-passe/definir/[token]` | page + action              | 1re définition (invitation/setup)                                          |
| `/[locale]/portail/mot-de-passe/reset`           | page + action              | Demande + consommation reset                                               |
| `/[locale]/portail/invitation/[token]`           | page + action              | Acceptation invitation → Trainee + membership                              |
| `/[locale]/portail/deconnexion`                  | route handler              | `logoutAction`                                                             |
| `/[locale]/portail/mon-espace`                   | page **existant**          | Espace apprenant (protégé `requireLearner`)                                |

> **Helper d'URL** : créer `src/server/elearning/auth/routes.ts` (calque `src/server/formateur/routes.ts`) avec `buildLearnerMagicUrl(secret)`, `buildLearnerResetUrl(secret)`, `buildLearnerSetupUrl(secret)`, `buildLearnerInvitationUrl(secret)` — toutes en `LOCALE="fr"` (EN désactivé) et basées sur `NEXT_PUBLIC_SITE_URL`.

---

## 12. Sécurité — synthèse des contrôles

| Risque                             | Contrôle                                                         | Implémentation                                                                              |
| ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Bruteforce mot de passe**        | Double couche : rate-limit IP (Redis) + verrou compte persistant | `checkRateLimit` + `failedLoginCount`/`lockedUntil` (15 min après 10 échecs)                |
| **Énumération d'emails**           | Réponses constantes + dummy-hash timing                          | `verifyPasswordSafe` (dummy-hash), messages génériques (calque `formateur/auth.actions.ts`) |
| **Timing attack token session**    | `timingSafeEqual`                                                | `verifierToken` (`portail-service.ts`) — réutilisé                                          |
| **Replay magic/reset**             | One-shot atomique haché                                          | `ElearningAuthToken.tokenHash` + `usedAt` + `updateMany` conditionnel                       |
| **Fuite base → liens utilisables** | Tokens **hachés** SHA-256                                        | `creerAuthToken` ne stocke jamais le secret en clair                                        |
| **Vol de session**                 | Cookie HttpOnly + Secure + SameSite=Lax + révocation             | `cookie.ts` + `revoquerAcces`/`revoquerToutesSessions`                                      |
| **Session orpheline après reset**  | Révocation globale                                               | `definirMotDePasse` → `revoquerToutesSessions`                                              |
| **2FA secret au repos**            | Chiffrement                                                      | `encryptPii(twoFactorSecret)`                                                               |
| **CSRF**                           | Server Actions Next (origin check natif) + SameSite=Lax          | natif framework                                                                             |
| **Build SSG (stub)**               | Garde `stub.invalid` partout                                     | tous les services : lecture→`null`, mutation→throw (calque `portail-service.ts`)            |

**RGPD / conservation** (détail `08-CONFORMITE/05-rgpd-conservation-preuves.md`) :

- Logs techniques (`PortailAcces.createdIp/lastIp/userAgent`, `ElearningAuthToken.createdIp`) → **6–12 mois** (CNIL 2021-122) → purge par `elearning-auth-cleanup-worker`.
- Soft-delete via `Trainee.deletedAt` (existant) + cascade `ElearningAuthToken`/`PortailAcces`/`ElearningOrgMembership`.
- Preuves d'octroi conservées (`ElearningOrgMembership.statut=revoked` plutôt que delete) pour audit OPCO/Qualiopi.

---

## 13. Workers, crons & emails

| Élément                            | Fichier                     | Rôle                                                                                                             |
| ---------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `elearning-auth-cleanup-worker.ts` | `src/server/queue/workers/` | Cron : purge `PortailAcces` expirés/révoqués > rétention, `ElearningAuthToken` consommés/expirés, logs > 12 mois |
| Réutilisation `email-worker`       | `src/lib/email/**`          | Envoi des emails auth (templates neufs)                                                                          |
| `elearning-magic-login.tsx`        | `src/lib/email/templates/`  | Email lien magique (TTL 20 min)                                                                                  |
| `elearning-password-reset.tsx`     | `src/lib/email/templates/`  | Email reset (TTL 1 h)                                                                                            |
| `elearning-invitation.tsx`         | `src/lib/email/templates/`  | Email invitation entreprise (TTL 24 h) — cf. doc 06 import                                                       |
| `elearning-email-verification.tsx` | `src/lib/email/templates/`  | Email vérif (chemin mot de passe pur B2C, V1)                                                                    |

> Les emails sont enfilés via `enqueueEmail(type, to, locale, payload)` (`src/server/queue/queues.ts`) — **infra Nodemailer maison réutilisée**, pas de service tiers.

---

## 14. Conformité au contrat de build `stub.invalid`

- Tous les services (`learner-auth-service`, `learner-token-service`, `creerSession`, `revoquerToutesSessions`) répliquent le garde `if (process.env["DATABASE_URL"]?.includes("stub.invalid"))` : **lecture → `null`/valeur sûre**, **mutation → throw**. Calque exact de `portail-service.ts`.
- Toutes les pages/route handlers `/portail/**` sont **derrière auth ou one-shot token** et **`export const dynamic = "force-dynamic"`** → aucun rendu DB au SSG ; `verifierToken`/`getEspaceStagiaire` retournent déjà des valeurs sûres sous stub.
- Le middleware `proxy.ts` est **Edge-safe** : le bloc `/portail/*` ne fait **aucun** appel DB (vérif « présence de cookie » uniquement, §7).
- Les schemas Zod et helpers de routes sont des modules purs (pas d'I/O au top-level) → import safe au build.

---

## 15. Plan de tests (Vitest)

| Test                         | Cible                                | Assertion                                                                                          |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Timing-safe session          | `verifierToken`                      | token erroné même longueur ⇒ rejet ; `timingSafeEqual` utilisé                                     |
| One-shot atomique            | `consommerAuthToken`                 | 2e consommation du même secret ⇒ `null` ; expiré ⇒ `null`                                          |
| Anti-énumération login       | `loginMotDePasseAction`              | email inexistant et mauvais mdp ⇒ **même** réponse/temps (dummy-hash)                              |
| Anti-énumération magic/reset | `demanderMagicLogin`/`demanderReset` | email absent ⇒ réponse générique, **aucun** email enfilé                                           |
| Lockout                      | `loginAvecMotDePasse`                | 10 échecs ⇒ `lockedUntil` ; login bloqué pendant 15 min                                            |
| Reset révoque sessions       | `consommerReset`                     | toutes les `PortailAcces` du trainee `revoked=true`                                                |
| Hash SSOT                    | `definirMotDePasse`                  | utilise `hashPassword` (argon2id) ; `passwordHash` jamais retourné                                 |
| **Cohabitation NextAuth**    | grep/AST                             | `learner-*` n'importe pas `@/auth`/`next-auth` ; `src/auth.ts` ne lit pas `trainee`/`portailAcces` |
| Cookies disjoints            | actions                              | apprenant pose `portail_session` ; jamais `authjs.*`                                               |
| Middleware strip             | `proxy.ts`                           | GET `/portail/*` **préserve** `portail_session` (STRIP_AUTH_SPACE étendu)                          |
| Stub build                   | services                             | `DATABASE_URL=stub.invalid` ⇒ lecture `null`, mutation throw                                       |
| 2FA (V1)                     | `valider2faAction`                   | code invalide ⇒ pas de session ; rate-limit ; secret déchiffré jamais loggé                        |

---

## 16. Checklist d'implémentation (MVP)

- [ ] Migration additive doc 04 appliquée (`Trainee` étendu, `PortailAcces` métadonnées, `ElearningAuthToken`, enums) — **prérequis**.
- [ ] `src/server/elearning/auth/learner-token-service.ts` (creer/consommer, hachés, atomiques).
- [ ] `learner-auth-service.ts` (`creerSession`, `revoquerToutesSessions`, login/magic/reset/setup) — réutilise `auth-password.ts`, `portail-service.ts`, `cookie.ts`, `rate-limit.ts`.
- [ ] `learner-guard.ts` (`requireLearner`/`getLearnerSession`) — réutilise `portail-service.ts`.
- [ ] `learner-account.actions.ts` + `src/lib/schemas/learner-auth.ts` (Zod).
- [ ] `src/server/elearning/auth/routes.ts` (`buildLearner*Url`).
- [ ] Bloc `/portail/*` + extension `STRIP_AUTH_SPACE` dans `proxy.ts`.
- [ ] Routes/pages portail (§11.2) — `force-dynamic`.
- [ ] Templates email (`elearning-magic-login`, `-password-reset`, `-invitation`).
- [ ] Composants UI `src/components/elearning/auth/**`.
- [ ] `elearning-auth-cleanup-worker.ts` (purge sessions/tokens/logs).
- [ ] Tests Vitest §15 (incl. **cohabitation NextAuth** = bloquant).
- [ ] _(V1, gated `LEARNER_2FA_ENABLED`)_ champs `twoFactor*` + `learner-2fa-service.ts` + routes 2FA.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth hybride), ADR-0007 (cloisonnement), ADR-0008 (migrations additives).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — **modèles/enums** (`Trainee` étendu, `PortailAcces`, `ElearningAuthToken`, `ElearningOrgMembership`, `ElearningInvitation`, import) ; ce doc en est l'implémentation backend.
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (octroi à l'acceptation d'invitation).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (matérialisation de l'accès après login).
- `03-DATA-MODEL/06-strategie-migrations.md` — SQL additif détaillé.
- `04-BACKEND/06-import-masse-provisioning.md` — provisioning CSV, workers `elearning-import-worker`/`elearning-invite-worker`, invitations.
- `04-BACKEND/10-emails-notifications.md` — templates React Email auth.
- `05-FRONTEND-APPRENANT/01-espace-apprenant-dashboard.md` — `mon-espace` derrière `requireLearner`.
- `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md` — octroi/invitation/import côté admin (`requireAdminWrite`).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — conservation logs/sessions/preuves d'octroi.
- `09-QUALITE/02-securite.md` — checklist sécurité transverse.
- Code de référence existant : `src/server/qualiopi/portail/portail-service.ts`, `cookie.ts` ; `src/lib/auth-password.ts`, `auth-2fa.ts`, `magic-token.ts`, `rate-limit.ts` ; `src/server/formateur/magic-link.ts`, `src/lib/formateur-session.ts`, `src/server/actions/formateur/auth.actions.ts` ; `src/proxy.ts` ; `src/auth.ts`, `src/auth.config.ts`.
  </content>
  </invoke>
