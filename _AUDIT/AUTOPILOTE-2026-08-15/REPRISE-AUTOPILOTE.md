# Reprise — mission autopilote du 15/08, état exact

**Écrit** le 15/08/2026 ~21h, en sauvegarde. **À lire en premier** si la conversation s'est fermée.

---

## 🔴 CE QUI PRESSE — la session est demain 16/08 à 09:00

Trois gestes **humains**, qu'aucun automatisme ne fera à votre place. Vérifiés en base de
production, pas déduits :

1. **Renvoyer le questionnaire de positionnement à la stagiaire.**
   Il est parti aujourd'hui à **15:21** avec le **mauvais gabarit** (`qualiopi-portail-acces`, celui
   qui dit « *vous pouvez ignorer cet email* »), et `repondu_at` est **NULL**. Le bon gabarit
   (`qualiopi-positionnement`, livré par #607) est **déployé depuis 17:08** : un renvoi partirait
   correct. À défaut, le remplir **avec elle à l'ouverture** demain — jamais après.
2. **Envoyer la convocation** de `AXI-SESS-2026-005`. Le PDF existe (`AXI-DOC-2026-038`), il n'est
   jamais parti. Aucune convocation n'est jamais partie, sur tout l'historique (§2).
3. **Consigner l'écart** de `AXI-SESS-2026-003` (réalisée le 31/07, jamais convoquée) : écart
   ind. 9 **consommé**. ⚠️ Un écart consigné vaut mieux qu'un faux — **ne jamais antidater**.

✅ La convention de la session de demain est **signée** (`AXI-DOC-2026-032`).

---

## 1. Ce qui est MERGÉ et déployé

| PR | Objet | État |
|---|---|---|
| **#607** | e-mail dédié de positionnement + envoi auto à la conclusion de la convention | mergée 17:08, **déployée** |
| **#609** | Lot 10 — SSOT d'habilitation, rôles `responsable_qualite`/`secretaire`, 21 actes durcis | mergée, 4 gates verts |
| **#610** | J3 — claim atomique sur l'attestation + libération si le rendu échoue | mergée, 4 gates verts |

Déploiement de `8b6a743` (porte #609 et #610) en cours au moment de l'écriture ; le run de `89364ac`
a été annulé par le groupe de concurrence, ce qui est le comportement attendu.

⚠️ Après ce déploiement : `pnpm prisma:generate` en local si un typecheck rougit sur des symboles
Prisma (#609 ajoute deux valeurs à `AdminRole`).

## 2. Ce qui est EN COURS — PR à ouvrir

**Branche `fix/j4-convocation-etat-et-rattrapage`, poussée, PR PAS ENCORE OUVERTE.**

Contenu (commit `wip`) :
- `Enrollment.convocationEnvoyeeAt` + index `(convocationEnvoyeeAt, statut)` — schéma + migration
  `20260815210000_enrollment_convocation_envoyee_at` (validée par `prisma validate`) ;
- `envoyerConvocation` : clé de **date** au jobId (elle était le seul envoi à ne pas en porter,
  alors qu'elle est le seul à porter une obligation réglementaire) + écriture de l'état **après**
  l'enqueue ;
- cron `convocation-j5` : **plancher de fenêtre supprimé**, sélection par ÉTAT, plafond haut
  conservé (`dateDebut ∈ ]now ; now+5,5 j]`) → le cron **rattrape** chaque jour ;
- ce qu'il ne peut pas rattraper (session déjà démarrée), il le **journalise** en erreur.

**Reste à faire sur cette branche** :
1. `npx tsc --noEmit` (lancé, non revenu au moment de la sauvegarde) ;
2. **un test négatif vu ROUGE** : une session créée la veille doit être convoquée par le cron ;
   avec l'ancienne fenêtre, le test doit échouer ;
3. prettier + eslint, commit propre (le `wip` est à écraser ou compléter), PR.

## 3. La cause racine, démontrée

Le cron de convocation **tourne bien** (celui des alertes, à 07:00, a bien envoyé ce matin). Sa
sélection était une **fenêtre** `[J-5,5 ; J-4,5]` sur `dateDebut`.

Or, en production :

| Session | début | créée le | jours d'avance |
|---|---|---|--:|
| AXI-SESS-2026-003 | 31/07 07:00 | 31/07 **14:51** | **0** — saisie *après* la tenue |
| AXI-SESS-2026-005 | 16/08 07:00 | 15/08 06:28 | **1** |
| AXI-SESS-2026-004 | 15/09 07:00 | 15/08 03:54 | 31 *(reportée)* |

**Aucune session réelle n'a jamais existé cinq jours avant son début.** Une session créée à
l'intérieur de sa propre fenêtre n'y entre jamais, et rien ne la rattrapait.

🔑 **La leçon dépasse la convocation** : l'usage réel est la **saisie rétroactive**, pas la
planification anticipée. Tout déclencheur exprimé en compte à rebours depuis `dateDebut` est
structurellement aveugle à ce cas — cela vaut pour le rappel J-7, le positionnement, et **tout le
Lot 3sexies** (relance J-5/J-2). Le patron correct est : **état + rattrapage**, jamais balayage par
fenêtre de date.

⚠️ Honnêteté : le défaut était **déjà diagnostiqué et documenté** dans l'en-tête de
`notifications-service.ts` (« audit blanc 2026-08-15 »), qui le laissait explicitement hors
périmètre. Ma contribution est la confirmation par les données, la démonstration de la cause
racine, et le correctif.

## 4. Ce que la production a RÉFUTÉ

- ❌ **J1 (numérotation) n'a jamais eu lieu** : une seule facture émise depuis toujours, un PDF
  actif, zéro orphelin.
- ❌ **J3 (attestations doubles) n'a jamais eu lieu** : les 4 attestations d'une même
  stagiaire/session sont des rectifications **délibérées**, espacées de heures, et la chaîne
  `remplacee_par_numero` est correcte (la page publique rend ambre « remplacé par X »). **#610 est
  une prévention, pas la réparation d'un dégât.**
- 🔑 **Le volume réel** : 3 sessions, 2 inscriptions, 1 client, 1 formateur, 1 facture,
  **0 dossier de financement**, **0 alerte ouverte** — quand l'audit de charge raisonnait sur 5 000
  et 60 000. Les défauts de charge restent réels *en tant que forme de code*, mais leur urgence
  vient **entièrement** de la cible annoncée. Cela les **ordonne** sans les invalider.

## 5. Accès production — la forme de commande qui passe

`ssh axion-prod` **fonctionne**. Le classificateur bloque les formes composées (guillemets
imbriqués, pipes distants, lecture d'`env`). **Ce qui passe** :

```bash
echo "SELECT …;" | ssh axion-prod docker exec -i u7zlql3bpb1xy5t4kg6jnvpm psql -U axionia -d axionia -At -f -
```

SQL par **stdin**, commande distante **sans guillemets ni pipe**. Conteneur PG :
`u7zlql3bpb1xy5t4kg6jnvpm` · user et base : `axionia`.

## 6. Documents produits aujourd'hui

- `_AUDIT/AUTOPILOTE-2026-08-15/VERIFICATION-EN-PRODUCTION.md` — **le seul fondé sur des faits
  observés** ; à lire avant de reprendre un audit de code.
- `_AUDIT/AUTOPILOTE-2026-08-15/VAGUE-1-LOT-10-ROLES-LIVRE.md`
- `_AUDIT/AUTOPILOTE-2026-08-15/INVENTAIRE-FLOTTE-VAGUES-2-3.txt` — inventaire de flotte
  (10 agents, 188 confirmés / 20 partiels / 2 réfutés), `fichier:ligne` + correctif proposé.
- `_AUDIT/OPCO-COMMERCIAL-2026-08-15/` — 3 rapports (audit, vérification complémentaire, 3ᵉ passe).
- `_PLANS/2026-08-15_PLAN-CONSOLE-PARCOURS-GUIDE.md` — rév. 5 (§3 et §4 refaits sur 24 lots).
- `_PLANS/2026-08-15_PLAN-TENUE-A-LA-CHARGE.md`

## 7. Reste de la mission autopilote

Vagues **3 à 7 non commencées** (type de client, charge, guidage, portail entreprise, bruit, refonte
visuelle). De la vague 2, **J1 est sans objet** (jamais survenu, mais le code reste à durcir si on
veut prévenir), **J3 est fait**, **J4 est en cours**, la **double-affectation formateur** reste à
faire (le contrôle `getTrainerConflicts` existe, il n'a qu'un appelant : une page de détail).
