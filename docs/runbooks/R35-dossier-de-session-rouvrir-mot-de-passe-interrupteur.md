# R35 — Dossier de session : rouvrir, mot de passe, interrupteur

- **Code** : R35
- **Version** : 1.0
- **Date dernière maj** : 2026-09-30
- **Sévérité** : 🟢 **P2 — routine** (rouvrir, changer le mot de passe) · 🟡 **P1** si un dossier
  clos bloque un geste légitime en production (interrupteur).
- **Impact si non traité** : un dossier clos qu'on ne peut plus corriger (mot de passe perdu,
  compte bloqué), ou une écriture légitime refusée en production.
- **ADR** : [0060 — Verrou du dossier de session et réouverture motivée](../adr/0060-verrou-du-dossier-de-session-et-reouverture-motivee.md)
  (D2 journal append-only, D5 habilitation, mot de passe et interrupteur).

> ⚠️ **Le dépôt est PUBLIC.** Le mot de passe n'est écrit nulle part : ni ici, ni dans un
> commit, ni dans un ticket. Seule son **empreinte** vit dans Coolify.

---

## Trigger

- Une pièce ou une donnée d'un dossier **clos** doit être corrigée (relevé tardif, erreur de
  saisie, attestation à rectifier) → §1.
- Première mise en service, mot de passe oublié, départ d'une personne qui le connaissait, ou
  soupçon de fuite → §2.
- La direction lit « Trop de tentatives de réouverture en une heure » → §3.
- Un geste légitime est refusé en production parce que le dossier est clos, et le correctif
  ne peut pas attendre → §4.

## Prérequis

- Compte console **direction** (`super_admin` ou `admin`) : seule l'habilitation
  `rouvrir_dossier` voit « Rouvrir le dossier » et « Clore à nouveau ».
- Pour §2 à §4 : accès Coolify (applications **web** et **worker**) ; pour §3, accès SSH au
  VPS.
- Pour §2 : le dépôt cloné et `pnpm install` fait (le script tourne en local, pas sur le VPS).

---

## §1 — Rouvrir, puis clore à nouveau

**Qui** : la direction seulement. Les autres rôles lisent « Adressez-vous à la direction ».

1. Ouvrir la fiche de la session. Le bandeau dit « Dossier clôturé le … — lecture seule »,
   « Encore possible » (ce qui reste faisable sans rouvrir) et, s'il y en a, « Manques figés au
   moment de la clôture » (ce qui manque et que seule une réouverture permet de corriger).
2. **Vérifier d'abord « Encore possible »** : questionnaire à froid, contreseings restants,
   facturation, remise des exemplaires se font SANS rouvrir. Ne rouvrir que pour une vraie
   correction.
3. « Rouvrir le dossier » → saisir le **motif** (10 caractères au moins, écrit pour le
   certificateur : il le lira mot pour mot) et le **mot de passe de sécurité**.
4. Faire la correction.
5. « Clore à nouveau ». Si le dossier ne remplit plus les conditions (attestation manquante,
   émargement encore ouvert), le refus liste ce qui manque : le compléter, puis recommencer.

⚠️ **Chaque réouverture est inscrite pour toujours** (table append-only, triggers en base) et
apparaît dans le dossier d'audit : date, heure, auteur, motif, actions faites pendant
l'ouverture. **Aucune réouverture « pour essayer »** : pour tester en production, se limiter à
un **mauvais** mot de passe (décision du dirigeant, 2026-09-30) — le refus est tracé au
journal d'activité, rien n'est écrit au dossier.

Un dossier rouvert ne se referme pas seul : « À traiter » le signale au-delà de 7 jours.

## §2 — Générer ou changer le mot de passe

1. Choisir le mot de passe (12 caractères au moins). Le transmettre à la direction de vive
   voix ou par un gestionnaire de mots de passe — jamais par e-mail ni messagerie.
2. En local, à la racine du dépôt :

   ```bash
   pnpm tsx scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts
   ```

   Saisir le mot de passe à « Mot de passe », puis à nouveau à « Confirmez » (rien ne
   s'affiche). Si les deux saisies diffèrent, ou s'il fait moins de 12 caractères, le script
   refuse (code 1) et ne produit rien. Sinon, il imprime une seule ligne
   `scrypt:<sel>:<empreinte>`.

   ⚠️ Le mot de passe est haché **tel quel** : un espace en tête ou en fin en fait partie.
   Ne jamais le passer en argument (il resterait dans l'historique du shell).

3. Coolify → application **web** → Environment Variables → `QUALIOPI_REOUVERTURE_MDP` =
   la ligne `scrypt:…` (scope RUN). Pas le worker : seule l'application web vérifie le mot de
   passe. La variable n'est pas dans la liste fermée du workflow `coolify-poser-variable.yml` :
   elle se pose à la main.
4. **Redémarrer** l'application web (Coolify → Restart) : une variable RUN n'est lue qu'au
   démarrage.
5. Vérifier (§ Vérification).

Sans variable, ou avec une valeur mal formée, **aucune réouverture n'est possible** : la
console dit « le mot de passe de sécurité n'est pas configuré sur le serveur ». C'est voulu
(fermé par défaut). Changer le mot de passe invalide l'ancien au redémarrage.

## §3 — Compte bloqué après 5 essais en une heure

Chaque tentative de réouverture compte, **réussie ou non** : 5 par heure et par compte, fenêtre
glissante. Au-delà : « Trop de tentatives de réouverture en une heure. Réessayez plus tard ; le
dossier reste clos. »

- **Solution par défaut : attendre.** Le compteur se vide seul, une heure après la plus
  ancienne tentative de la fenêtre.
- **Si c'est urgent**, et seulement après avoir vérifié au journal d'activité
  (`qualiopi.session.dossier.reouverture_refusee`, raison `incorrect` / `trop_d_essais`) que les
  essais viennent bien de la personne qui le demande — sinon, c'est peut-être un compte
  compromis : changer le mot de passe (§2) et ne rien débloquer. Supprimer la clé Redis du
  compte :

  ```bash
  ssh root@<vps> 'docker ps --format "{{.Names}}\t{{.Image}}" | grep -i redis'
  ssh root@<vps> 'docker exec <redis> redis-cli -a "$REDIS_PASSWORD" DEL qualiopi:reouverture:<userId>'
  ```

  `<userId>` est l'identifiant du compte console (`admin_users.id`). `DEL` rend `1` si la clé
  existait.

Redis indisponible : le compteur laisse passer (signalé à Sentry), le mot de passe reste
exigé.

## §4 — Interrupteur de secours : `QUALIOPI_VERROU_DOSSIER=off`

**Quand** : un blocage LÉGITIME en production, le temps qu'un correctif soit livré. Jamais
pour éviter une réouverture motivée.

1. Coolify → application **web** ET application **worker** → `QUALIOPI_VERROU_DOSSIER` = `off`
   (casse et espaces indifférents).
2. **Redémarrer les deux.** Un seul des deux coupé laisserait les workers (ou la console)
   bloquer encore.
3. Effet : plus aucune écriture refusée pour cause de dossier clos. L'**état** reste « clos »
   partout — fiche, liste, dossier d'audit — et le bandeau le dit : « Verrou coupé par
   l'interrupteur de secours : les modifications sont possibles et ne sont pas inscrites au
   dossier. »
4. **Chaque écriture laissée passer sur un dossier clos remonte à Sentry** (niveau warning,
   tag `etape: verrou_dossier_coupe`, avec l'identifiant de la session). C'est la seule trace :
   elle n'apparaît PAS au dossier d'audit. Relever les sessions touchées.
5. **Retrait** dès le correctif en ligne : supprimer la variable (ou toute valeur autre que
   `off`) sur web ET worker, redémarrer les deux. Pour chaque session relevée au point 4,
   décider s'il faut une réouverture motivée (§1) qui explique la modification au
   certificateur.

## Vérification

- Mot de passe (§2) : sur un dossier clos, « Rouvrir le dossier » avec un motif et un
  **mauvais** mot de passe → « Mot de passe de sécurité incorrect. Le dossier reste clos. »
  (et non « n'est pas configuré »). Ne pas tester le bon mot de passe en production : ce
  serait une réouverture inscrite pour toujours.
- Interrupteur posé (§4) : le bandeau d'un dossier clos affiche la mention « Verrou coupé… »
  et ne dit plus « lecture seule ». Retiré : « lecture seule » revient, la mention disparaît.

## Rollback

- Mot de passe : remettre l'ancienne empreinte (si elle est connue) et redémarrer le web.
- Interrupteur : le retirer (§4 point 5). Il ne modifie aucune donnée par lui-même.
- Une réouverture ne s'annule pas : on **clôt à nouveau** (§1 point 5), et les deux
  événements restent au dossier.

## Escalation

- Mot de passe perdu et personne pour en poser un nouveau : sans accès Coolify, aucune
  réouverture n'est possible — c'est le comportement voulu, pas une panne.
- Alerte Sentry `verrou_dossier_coupe` alors que personne n'a posé l'interrupteur : vérifier
  les variables des deux applications Coolify et le retirer.

## Liens

- ADR 0060 — `docs/adr/0060-verrou-du-dossier-de-session-et-reouverture-motivee.md`
- Script : `scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts`
- Vérification du mot de passe : `src/server/qualiopi/sessions/mot-de-passe-reouverture.ts`
- Action : `src/server/actions/qualiopi/dossier-verrou.ts`
- Interrupteur : `verrouDossierActif()` dans `src/server/qualiopi/sessions/verrou-dossier-pur.ts`,
  signalement dans `verrou-dossier-garde.ts`
