# Vague 1 — Lot 10, rôles et habilitations : ce qui a été livré

**Date** : 15/08/2026 · **Branche** : `feat/lot10-roles-habilitations` (depuis `main` post-#607)
**Méthode** : reconnaissance par flotte (10 agents, dont 5 adversariaux) puis implémentation.

---

## 0. Une correction à mon propre constat, d'abord

Ma troisième passe affirmait : *« la frontière engage-l'organisme n'existe qu'à UN endroit du
serveur »*. **La flotte adversariale a réfuté cette formulation.** Elle est vraie de la constante
nommée `ROLES_ADMIN_HABILITES` ; elle est fausse du code.

Six autres actes portaient déjà, **à la main**, exactement le même durcissement :

| Acte | Fichier:ligne | Forme |
|---|---|---|
| `contresignerPieceAction` | `actions/qualiopi/piece-signature.ts:435` | `requireAdminWrite()` puis `if (role !== "super_admin" && role !== "admin")` |
| `contresignerLettreMissionAction` | `actions/qualiopi/lettre-mission-signature.ts:231` | idem |
| `viserReleveResponsablePedagogiqueAction` | `actions/qualiopi/releve-signature.ts:194` | idem |
| `emettreLienSignatureAction` | `actions/qualiopi/piece-lien-signature.ts:254` | idem |
| `revoquerLiensSignatureAction` | `actions/qualiopi/piece-lien-signature.ts:387` | idem |
| `revoquerSignatureAction` | `actions/qualiopi/signature-revocation.ts:61` | idem |

**Le constat juste** n'est donc pas « la frontière n'existe qu'une fois », c'est : *la frontière
existe sept fois, recopiée à la main, et uniquement sur la famille SIGNATURE.* Elle n'avait jamais
franchi la frontière de son module : attester, facturer, conclure et habiliter restaient ouverts.

C'est une différence de nature. Un défaut d'absence se corrige en écrivant la règle ; un défaut de
duplication se corrige en la **factorisant** — sinon la huitième copie divergera.

---

## 1. Le socle

### `src/server/auth/habilitations.ts` — module PUR, la matrice

Sept actes engageants, et qui peut les poser :

| Acte | super_admin | admin | responsable_qualite | secretaire | editor | reader |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `contresigner` | ✅ | ✅ | — | — | — | — |
| `attester` | ✅ | ✅ | ✅ | — | — | — |
| `valider_evaluation` | ✅ | ✅ | ✅ | — | — | — |
| `conclure_devis` | ✅ | ✅ | — | — | — | — |
| `facturer` | ✅ | ✅ | — | — | — | — |
| `habiliter_formateur` | ✅ | ✅ | ✅ | — | — | — |
| `deposer_demande_financeur` | ✅ | ✅ | — | — | — | — |

🔴 **Le responsable qualité porte la qualité, jamais le contrat.** Attester, valider une évaluation
et habiliter un formateur sont les décisions que le RNQ lui confie (ind. 11, 21, 22). Conclure,
facturer, contresigner et déposer au nom du client engagent l'organisme sur le plan contractuel ou
financier : direction seule.

⚠️ **`secretaire` n'est pas un rôle diminué.** Il conserve `requireAdminWrite` pour tout ce qui
n'engage pas : créer une session, inscrire, générer les brouillons, convoquer, relancer, classer,
consulter. C'est le sens même de l'objectif « n'importe quelle secrétaire gère le système » — elle
mène le dossier de bout en bout, elle ne conclut pas à la place de l'organisme.

`peutEngager()` prend un `string`, pas un `RoleAdmin` : un rôle inconnu — jeton ancien, base non
migrée, faute de frappe — doit être **refusé**, pas provoquer une erreur de type qui masquerait le
cas. Refus par défaut.

### `src/server/actions/qualiopi/_guards.ts` — la garde

`requireHabilitation(acte)` : lit la session, interroge la matrice, lève `forbidden: <motif>`.
Le message porte **le motif**, pas un code — il remonte à l'écran, parce qu'un bouton absent sans
explication produit un appel téléphonique.

### `prisma/schema.prisma` + migration — les deux rôles qui rendaient la matrice inexprimable

```prisma
enum AdminRole { super_admin  admin  editor  reader  responsable_qualite  secretaire }
```

🔴 **Ajoutés EN FIN d'énumération, jamais intercalés.** Un `ALTER TYPE … ADD VALUE … BEFORE`
réordonne le type Postgres et change en silence le sens de tout tri par rang. La migration
(`20260815200000_admin_role_qualite_secretaire`) porte `IF NOT EXISTS` pour rester rejouable.

---

## 2. Les actes durcis

**21 Server Actions** passent de `requireAdminWrite` (qui autorise `editor`) à `requireHabilitation` :

| Acte | Server Actions |
|---|---|
| `attester` | `genererAttestationAction` · `genererCertificatRealisationAction` |
| `conclure_devis` | `acceptDevisAction` · `transformDevisToConventionAction` |
| `facturer` | `genererFactureLibreAction` · `genererFactureFormationAction` · `genererFactureDepuisDevisAction` · `genererAvoirAction` · `emettreFactureBrouillonAction` |
| `habiliter_formateur` | `setTrainerHabilitationsAction` · `verifierSousTraitantAction` · `verifyTrainerSousTraitantAction` · `verserFicheFormateurAction` · `validateTrainerDocumentAction` · `verifierSousTraitantOfAction` |
| `deposer_demande_financeur` | `genererKitOpcoAction` · `genererKitCpfAction` · `genererKitFranceTravailAction` · `creerDossierFinancementAction` · `transitionnerDossierAction` · `validerAccordOpcoAction` |
| `contresigner` | `envoyerLienSignatureParEmailAction` (voir §3) |

### Ce qui n'a délibérément PAS été durci

Générer une **convention**, une **convention tripartite**, un **contrat de formation**, une **lettre
de mission**, un **contrat de sous-traitance** reste sous `requireAdminWrite`.

Ce n'est pas un oubli : c'est la frontière elle-même. Ces actions produisent un **brouillon**, et un
brouillon n'engage rien tant qu'il n'est ni signé ni envoyé — c'est exactement la formulation du
Lot 1ter. L'engagement est la **signature**, et elle était déjà gardée. Durcir la génération
priverait la secrétaire de la préparation du dossier, c'est-à-dire de son métier, sans rien fermer.

---

## 3. Un défaut d'ordre trouvé au passage — la garde qui s'exécutait après l'effet

`envoyerLienSignatureParEmailAction` (`actions/qualiopi/piece-lien-signature.ts`) posait sa garde
**après** :

1. `prisma.documentGenere.findUnique` — raison sociale du client, titre de session ;
2. `resoudreIdentite(partie, piece)` — identité et e-mail du signataire ;
3. `emettreLienSignatureAction(...)` — qui **réémet** le lien, donc **révoque le précédent**.

Un appel non habilité obtenait donc ces données, et faisait tomber le lien déjà envoyé au client,
avant d'être refusé. **Une garde qui s'exécute après l'effet ne garde rien.** Elle est désormais la
première instruction.

---

## 4. Les gardes ont été vues ROUGES

Exigence : « chaque test négatif est vu échouer au moins une fois avant d'être déclaré vert ».

| Garde | Neutralisation appliquée | Résultat |
|---|---|---|
| Matrice (`habilitations.ts`) | `editor` ajouté à `attester` | 🔴 1 test échoue : « editor ne doit pas pouvoir « attester » » |
| Garde serveur (`requireHabilitation`) | condition court-circuitée par `false &&` | 🔴 **6 tests sur 9** échouent |

Les deux ont été restaurés et repassent au vert. **19 tests**, dont l'exhaustivité de la matrice :
ajouter un acte sans l'inscrire au test fait rougir la suite.

---

## 5. Le risque de verrouillage, et pourquoi il n'existe pas

Durcir une autorisation peut enfermer dehors la personne qui en a besoin — et la session
**AXI-SESS-2026-005 a lieu demain matin**.

- Les deux rôles ajoutés sont **neufs** : aucun compte ne les porte, donc aucun compte ne change de
  périmètre par leur seule existence.
- Le seul rôle qui **perd** des droits est `editor`, sur sept actes.
- `requireAdminWrite` est **inchangé** : tout ce qui n'engage pas continue de fonctionner à
  l'identique pour tout le monde.

⚠️ **La vérification qui reste** : confirmer qu'aucun compte actif nécessaire au 16/08 ne porte le
rôle `editor`. Je n'ai pas pu la faire — l'accès SSH à la production m'a été refusé par le
classificateur. C'est une requête d'une ligne (`SELECT email, role FROM admin_users WHERE status =
'active'`). **Tant qu'elle n'est pas faite, cette PR ne doit pas être mergée avant la session du
16/08 au matin.** Ce n'est pas une réserve de principe : c'est le seul scénario où ce lot pourrait
nuire.

---

## 6. Ce que ce lot débloque

- **Lot 14 (routage des alertes)** : « chaque alerte a un destinataire dérivé » supposait un rôle
  `responsable_qualite` qui n'existait pas. Il existe.
- **Lot 15 (onboarding par rôle)** : « on n'apprend pas ce qu'on n'a pas le droit de faire »
  supposait une matrice. Elle est écrite, en un seul endroit, et testée.
- **Lot 8 (OPCO)** : `deposer_demande_financeur` est en place **avant** que le dépôt sous mandat ne
  soit automatisé — l'ordre correct, puisque déposer engage l'organisme au nom du client.
