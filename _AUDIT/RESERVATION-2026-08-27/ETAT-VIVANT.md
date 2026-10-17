# État vivant — chantier réservation d'appel (2026-08-27)

> Fichier de reprise. Mis à jour à chaque étape. Si la session se ferme, **tout
> ce qu'il faut pour reprendre est ici**.
>
> ⚠️ Écrire ce fichier avec l'outil d'édition, **jamais par le shell** : les
> backticks y sont mangés par la substitution de commande. Piège payé deux fois
> le 2026-08-27.

## Où est le travail

| | |
|---|---|
| **Dépôt principal** | `axionia/` — ⚠️ **une AUTRE session y travaille**, ne pas y écrire |
| **L1** | worktree `../wt-portes`, branche `fix/appel-portes-ouvertes` → **PR #879** |
| **L2** | worktree `../wt-fraicheur`, branche `fix/appel-fraicheur` — en cours |
| **Base** | `origin/main` @ `0b693c9c` |
| **Rapport lisible** | https://claude.ai/code/artifact/3d4894a5-5ddd-4dc6-9798-45e7c23a1b61 |

Si un worktree a disparu :
`git worktree add -b <branche> ../<dossier> origin/main`, puis les jonctions
Windows vers `node_modules` et `prisma/generated` du dépôt principal
(`cmd /c mklink /J`) — sans elles, ni `tsc` ni `vitest` ne tournent.

## Décisions de Will

1. **L'appel dure 45 minutes.** Le site s'aligne sur Calendly, pas l'inverse.
2. **La lecture de `contacts/appels` s'aligne sur l'écriture** :
   `super_admin | admin | editor`. Donc `reader`, `secretaire` et
   `responsable_qualite` sont refusés.
3. **Autopilote** jusqu'au bout : implémenter, fusionner, déployer, nettoyer,
   puis tests navigateur de bout en bout avec réservations réelles.
4. **L7 par défaut = option (a)** (rappel H-1 seul, pas de confirmation en
   doublon) — hypothèse posée faute d'arbitrage explicite, à confirmer.

## Le plan (8 lots)

```
L0  durée réelle                      OK — tranchée : 45 min
L1  fermer les deux portes            OK — PR #879
L2  fraîcheur des créneaux            <-- EN COURS
L3  textes légaux faux                (indépendant)
L4  chaîne RGPD indivisible
L5  instrumentation du sondage
L6  durée dérivée + 22 surfaces
L7  e-mails                           (option a par défaut)
```

Transcriptions des agents : `.claude/projects/…/subagents/workflows/`
— `wf_a0a8cff8-0c9` (escouade technique, 20 agents)
— `wf_ee746090-211` (escouade périmètre, 8 agents)
— `wf_126dd6b8-0be` (vérification adversariale de L1, 7 agents)
Dossiers rendus : `…/tasks/*.output` (+ `.output.md` extraits à côté).

---

## L1 — CLOS, PR #879

**Défauts fermés.** N-1 : aucune garde de rôle sur les appels ; la fiche
interrogeait Prisma **avant** `auth()`, la liste n'appelait pas `auth()` du tout.
Tout compte lisait nom, e-mail, téléphone, réponses libres — et
`cancelUrl`/`rescheduleUrl`, qui sont des **URL-capacités** (les copier suffit
pour annuler le rendez-vous d'un prospect, sans authentification). N-2 : la route
publique écrivait sans contrôle d'origine ni bornes.

**Escouade adversariale de 7 agents.** Verdict « part après 4 corrections », les
4 sont faites :

| # | Correction | Origine |
|---|---|---|
| C1 | `.catch(undefined)` — une chaîne **vide** faisait perdre la réservation | régression que j'avais introduite |
| C2 | Plafond de corps mesuré **deux fois** — le contrôle d'en-tête seul ne borne rien | régression que j'avais introduite |
| C3 | **4 surfaces** couvertes au lieu de 2 — le jumeau oublié | défaut préexistant, vu par 4 agents |
| C4 | Dire ce que la garde d'origine fait **vraiment** | fausse revendication de sécurité |

**Écarté sur contre-preuve** : `X-Forwarded-Host` empoisonnable (le `Caddyfile`
l'écrase) · clé de déduplication classée « importante » (TTL réel de 300 s, pas
la journée).

**Régimes retenus — 4 surfaces, toutes couvertes :**

```
REFUS   contacts/appels/page.tsx
REFUS   contacts/appels/[id]/page.tsx
FILTRE  agenda/page.tsx        (mixte : porte aussi les RDV personnels)
FILTRE  contacts/page.tsx      (mixte : 4 canaux)
```

**Mesures** : `tsc` 0 erreur · `eslint` 0 · **102 tests verts** (7 fichiers).
Cas neufs rejoués sur `origin/main` non modifié : **rouges**.

⚠️ **NON FERMÉ, assumé et écrit dans le code** : `requireSameOrigin` compare un
en-tête que `curl` pose librement. Le CSRF navigateur et le balayage nu sont
fermés ; **l'appel scripté informé ne l'est pas**. Un test-témoin le documente et
rougira le jour où l'on durcit. Fermer vraiment = jeton court-vécu émis par
`/appel`, lot séparé.

---

## L2 — fraîcheur des créneaux, EN COURS

**Le vrai défaut, trouvé par l'escouade — ce n'était PAS ce que j'avais dit.**
`invaliderCreneaux` enchaîne un `revalidatePath` **sans profil**, qui expire en
dur et purge aussi l'entrée `fetch` (elle porte l'étiquette implicite du chemin).
Cette fonction marchait. Le défaut : **le seul appelant vivant n'envoyait que la
moitié qui n'expire pas** — le worker passait `tags` sans `paths`. Le webhook
appelait correctement, mais il est éteint (plan Calendly gratuit).

⚠️ **L'architecte s'est trompé sur un point** : il proposait de remplacer le
chemin EN par `/en/appel`. `routing.ts:304` dit
`{ fr: "/appel", en: "/book-a-call" }` — correction **non appliquée**, elle
aurait introduit une route inexistante.

### Fait

- [x] `server/cache/expiration-immediate.ts` — `EXPIRATION_IMMEDIATE = { expire: 0 }`,
      avec la mesure : `default.expire` vaut 4 294 967 294 s (~136 ans)
- [x] worker : `paths` **et** `purgeEdge: false` — sans le second, ce cron de
      2 min émettrait **720 purges Cloudflare par jour** sur une page en `BYPASS`
- [x] worker : invalide aussi quand `discover` rend `created > 0` (~60 s au lieu de 2 min)
- [x] route interne : plus de `catch {}` vide ; `tagsEnEchec` remonté et journalisé
- [x] `revalidateContent` : lit le corps, dégrade sur preuve **positive** seulement
      (un corps illisible ou une demande sans étiquette restent `ok`)
- [x] `revalidateAndPurge` : 4e paramètre `purgerLEdge`, défaut `true`
- [x] les **4 actions d'agenda** invalident `/appel` — la console promettait
      « dans la minute » et ne rafraîchissait qu'elle-même
- [x] les **3 promesses** d'interface alignées sur la mesure : « moins de deux minutes »
- [x] le test qui **verrouillait** le défaut réécrit — il résout le profil dans la
      configuration de Next et exige `expire === 0`. **Vu rouge** :
      `expected 4294967294 to be +0`
- [x] test neuf sur le worker : 4 cas, dont un **témoin négatif**
      (`created: 0` → aucune invalidation)
- [x] commentaire mensonger sur `export const revalidate = 900` rectifié
- [x] trois fichiers affirmaient que `revalidateTag` est un « no-op silencieux »
      en worker — la source **lève** (E263). Rectifié.

### Reste

- [ ] typecheck + lint + suite complète sur `wt-fraicheur`
- [ ] escouade adversariale sur L2
- [ ] PR, puis fusion sérialisée après #879

---

## Pièges déjà payés — ne pas les réapprendre

- **Le shell mange les backticks** dans `node -e` et les heredocs. Écrire les
  fichiers avec l'outil d'édition. Payé deux fois.
- `AccesRefuse` n'est **pas** dans le baril `@/components/admin/ui` : importer
  `@/components/admin/ui/AccesRefuse`.
- `gardePage` du SSOT a deux niveaux et **aucun ne convient** au domaine appels :
  `consultation` ouvre à tous, `ecriture` = tous sauf `reader`.
- `import.meta.url` n'est **pas** une URL `file:` sous Vitest — `fileURLToPath`
  lève. Dériver les chemins de `process.cwd()`, avec un `throw` explicite si la
  cible est introuvable.
- `InboxItem.detailHref` n'est pas nullable.
- En worktree : aucun hook husky ne tourne ; `node_modules` et `prisma/generated`
  doivent être jonctionnés à la main.
- `main` exige une branche à jour avant fusion · déploiement ~1 h ·
  l'autre session produit — **sérialiser les fusions**.
- Le worktree témoin `../wt-avant` est déréférencé de git mais son dossier reste
  sur le disque, verrouillé. À supprimer plus tard :
  `Remove-Item -Recurse -Force ..\wt-avant`.

---

## Ce qui attend Will (hors code)

| Geste | Débloque | Urgence |
|---|---|---|
| Accepter le DPA Calendly sur `calendly.com/dpa` | cohérence de L4 avec le registre | immédiate |
| Trancher la base légale du transfert Telegram (le registre invoque la minimisation, la page publique dit le contraire) | L3 | immédiate |
| Basculer l'agenda sur Google Workspace | le DPA art. 28 manquant | semaines |
| Décider la rétention de `calendly_events` | la moitié « rétention » de L4 | — |
| Confirmer L7 = option (a) | L7 | — |

## Vérifications d'une minute (Calendly / console)

- La fenêtre de réservation de l'event-type (60 j ou moins).
- L'existence de la ligne `QrLink{slug:"appel"}` en base : le QR **imprimé** sur
  `/fr/formations` encode `axion-ia.com/qr/appel` ; sans la ligne, un scan rend
  « QR code introuvable » en texte brut. Aucune garde ne vérifie qu'un slug
  imprimé sur du papier existe.
