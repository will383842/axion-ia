# ADR 0044 — Portail entreprise : le périmètre avant la première ligne de code

- **Statut** : **PROPOSÉ — attend l'arbitrage de Will**
- **Date** : 2026-08-17
- **Auteur** : Claude, en ouvrant la porte d'audit du Lot 11
- **Référence** : `_PLANS/2026-08-15_PLAN-CONSOLE-PARCOURS-GUIDE.md` §11, `prisma/schema.prisma` (`PortailAcces`, `TrainingSession.interEntreprises`), `src/server/qualiopi/portail/portail-service.ts`

## L'état vérifié

Le plan a raison sur le fond : **il n'existe aucun espace client**. Vérifié ligne
à ligne —

- `PortailAcces.traineeId` est une FK **non nullable** vers `Trainee`. Aucun
  champ client, aucun modèle jumeau ;
- `portail-service.ts` ne connaît que `traineeId` (`creerAcces`, `verifierToken`,
  `getEspaceStagiaire`) ;
- la garde de session ne protège qu'un chemin : `/(fr|en)/portail/mon-espace`.

Un client qui veut ses attestations, ses émargements ou son avancement **doit
nous écrire**. C'est le défaut que le Lot 11 existe pour fermer.

## 🔴 LA MINE — à connaître avant d'écrire la première ligne

L'implémentation naturelle est :

```ts
where: {
  session: {
    clientId: moiLeClient;
  }
}
```

Sur une session `interEntreprises = true`, **cette clause remonte TOUS les
inscrits de la session** — y compris les salariés d'autres sociétés. Le schéma le
dit noir sur blanc : _« participants de sociétés différentes »_.

Le portail livrerait alors à une DRH la **liste nominative, les émargements et
l'avancement des salariés d'une entreprise concurrente**.

Ce n'est pas un cas limite : l'inter-entreprises est un mode de commercialisation
courant, et le champ existe précisément parce qu'il est utilisé.

⚠️ Le bon périmètre n'est pas la SESSION, c'est l'**INSCRIPTION** :
`Enrollment.clientId` — le client qui paie **pour ce stagiaire-là**. Il existe
déjà (posé pour le financement par participant).

## Les deux décisions qui vous appartiennent

### 1. Qui est responsable de traitement ?

Le plan pose (l. 627-628) : _« le client responsable de traitement, l'organisme
sous-traitant sur cette partie »_.

🔴 **La convention signée imprime EXACTEMENT L'INVERSE** : chaque partie est
responsable de traitement pour ce qu'elle collecte, et l'organisme traite
identité, émargement et évaluation _« aux seules fins d'exécuter la présente
convention »_.

Ouvrir un espace où le client lit les données de ses salariés **change la nature
du traitement** — et la clause en production ne le prévoit pas.

| Option                                   | Conséquence                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Aligner le plan sur la convention** | l'organisme reste responsable ; le portail ne montre que ce que la convention prévoit déjà (attestations, factures, avancement agrégé) |
| **B. Aligner la convention sur le plan** | il faut **modifier la clause**, donc **avenanter les conventions en cours**. Décision juridique, pas technique.                        |

**Recommandation : A.** Elle ne demande aucun avenant et couvre le besoin réel du
client — récupérer ses pièces sans nous écrire.

### 2. Le seuil d'agrégation de la satisfaction

Le plan interdit à juste titre le nominatif (l. 624-626). Mais **« agrégé » ne
protège rien à cette volumétrie** : sur une session à un ou deux inscrits, une
moyenne agrégée **EST** la réponse individuelle.

Et la conséquence n'est pas seulement un défaut de confidentialité : le stagiaire
qui le comprend **cesse de répondre franchement**, et l'indicateur 30 perd sa
sincérité — c'est-à-dire tout ce qui en fait un indicateur.

| Option                             | Effet                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **A. Seuil à 5 répondants**        | en dessous : « effectif insuffisant pour restituer sans identifier ». Usage courant des enquêtes internes. |
| **B. Seuil à 3**                   | plus permissif, protège mal à 3                                                                            |
| **C. Ne rien restituer au client** | le plus sûr, mais prive le client d'une information légitime                                               |

**Recommandation : A**, avec la phrase de masquage rendue à l'écran — un chiffre
absent sans explication se lit comme un défaut de l'outil.

## ⛔ Décision attendue

Les deux points ci-dessus sont **des décisions juridiques et de politique de
données**, pas des choix d'implémentation.

**Tant qu'ils ne sont pas tranchés, le Lot 11 ne doit pas être commencé.** Le
périmètre `Enrollment.clientId` (et non `session.clientId`) est en revanche un
fait technique établi : il vaudra quelle que soit la décision.
