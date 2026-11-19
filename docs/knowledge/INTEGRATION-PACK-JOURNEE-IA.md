# Intégration du pack SEO/GEO « Journée IA » (10/11/2026) au RAG / knowledge

Statut : décision prise le 2026-11-11, import en **brouillons** uniquement. Rien n'est publié.
Source : dépôt `axion-brand`, branche `rag-journee-ia-pack-2026-11-11`, dossier `impl/rag-journee-ia/`.
Copie de travail versionnée ici : `docs/knowledge/pack-journee-ia-2026-11-10/`.

## Décision

| Contenu du pack                                          | Lignes | Devenir                                                                                                                         |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------- |
| Questions/réponses GEO (`faq_knowledge`)                 |     63 | **Importées en brouillon** (type `faq`, statut `draft`, audience `team`, confidentialité `internal`), sauf rejet de la doctrine |
| Expressions SEO/GEO (`search_query`)                     |    623 | **Hors RAG.** Référentiel éditorial (CSV/JSONL versionnés). Ce sont des hypothèses de recherche, jamais des faits servis        |
| Intentions de page (`page_intent`)                       |     20 | Hors RAG : feuille de route éditoriale                                                                                          |
| Sources (`source`)                                       |     18 | Hors RAG : renvoyées dans la note de relecture de chaque fiche (champ `source`)                                                 |
| Décisions éditoriales (`editorial_decision`)             |     10 | Hors RAG. D02 et D03 contredisent les décisions de Williams : **écartées**                                                      |
| 1 320 anciennes lignes d'archive (onglet `Archive_2026`) |  1 320 | **Non importées** : non validées, absentes du JSONL                                                                             |

### Pourquoi

- Une fiche de la base peut être servie au chatbot et à `/connaissances` dès qu'elle est publiée. Les 63 réponses sont des
  **brouillons rédigés par IA**, marqués « À valider / ne pas publier automatiquement » : elles restent donc en `draft`,
  en audience `team` / confidentialité `internal`. Les recherches du chatbot ne lisent que `published` (et `deprecated`) :
  aucun changement de comportement du chatbot.
- Les 623 expressions n'ont ni volume, ni difficulté, ni vérification de SERP (« À mesurer »). Les injecter dans le RAG
  ferait réciter des hypothèses comme des faits. Elles servent à la rédaction, pas à la réponse.
- Les 30 fiches `GEO-034` à `GEO-063` sont des scénarios « non constatés » à gabarit identique : importées pour relecture,
  jamais à publier telles quelles (risque de contenu mince, décision D06 du pack).
- Aucune migration Prisma : le schéma existant (`KnowledgeEntry`, `KnowledgeTranslation`, `KbStatus`, `KbAudience`) suffit.
  La provenance (source, date, garde de publication, page cible) est écrite dans `briefMarkdown`.

## Contradictions et garde-fous

| Sujet                          | Pack                                              | Décision retenue                                                                                              |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Prix / remise (D02)            | « remise à 990 € contre tournage » vs prix unique | Seul prix affiché : **Journée IA 1 490 € HT**, aucune remise. D02 écartée, tout autre montant rejeté          |
| Garantie / remboursement (D03) | garantie ou remboursement sous un seuil de gains  | Gains **identifiés et estimés**, jamais garantis ; garantie/CGV/devis = brouillons, aucune promesse juridique |
| Rendez-vous gratuit (GEO-008)  | « échange gratuit facultatif »                    | Compatible avec l'unique rendez-vous gratuit de 45 min ; à reformuler à la relecture                          |
| Cas clients (GEO-033)          | « cas clients réels avec autorisation »           | Rejetée par la porte de doctrine (fausse preuve sociale) : 1 rejet                                            |
| Tour France IA                 | —                                                 | Exclu                                                                                                         |

Le script rejette en plus de la doctrine de la base (`verifierDoctrineTraduction`) : tout montant en € / euros / EUR autre que 1 490
(espace, espace insécable ou fine acceptés, `,00` toléré) ; 1 490 sans « HT » juste après ; « TTC » ; les montants en `k€` ; un nombre sans
devise suivi de « HT » ; « réduction », « rabais », « offert » ; le mot « remise » ; « Grenoble » ; « Will » (seul) ; « Aucun gain garanti » ;
toute promesse de gain ou de remboursement ; « Tour France IA ».

**Faux rejets possibles, sans danger** (la fiche reste simplement à relire) : « remise du rapport » (le mot « remise » est refusé quel que soit son sens) et
« will » anglais (verbe ou nom commun). Mieux vaut un faux rejet qu'une remise ou un « Will » publiés.

## À préciser avant toute publication

- `GEO-006` et `GEO-016` parlent d'une prestation « sur devis » : le devis ne concerne que la **mise en place ultérieure**.
  Le prix de la Journée IA est unique : **1 490 € HT**. À préciser dans la réponse avant publication.
- `GEO-034` à `GEO-063` : titres à reformuler (scénarios « non constatés » à gabarit identique, titres artificiels).
- Les fiches dont le statut contient « non constaté », « à vérifier » ou « juridique » (GEO-034 à 063, GEO-028, GEO-029 notamment) portent en tête de la note de
  relecture : « NON VÉRIFIÉ — scénario ou point juridique à confirmer ». Leur `factual_check` (« Donnée réelle ou exemple explicite »)
  n'est volontairement **pas** repris : il ne valait rien pour elles.

## Chiffres non sourcés à vérifier à la relecture

`GEO-003` (audit de 2 à 4 h), `GEO-005` (rapport sous trois jours ouvrés), `GEO-018` (attestations) viennent du document
d'offre interne `INT-03` : exacts selon le pack, à confirmer avant publication.

## Mise en œuvre

- `src/lib/knowledge/pack-journee-ia.ts` : tri, doctrine, mapping, anti-doublon (Jaccard sur trigrammes, seuil 0,8, signalement
  sans rejet — reprise de l'esprit de `Controle_Doublons.py`).
- `scripts/import-knowledge-pack-journee-ia.ts` : **dry-run par défaut** (aucun accès base). `--commit` crée seulement les fiches
  absentes (slug stable `pack-journee-ia-<id>`), ne met jamais à jour ni ne supprime. Idempotent. La logique d'écriture est
  `importerBrouillons(client, fiches)` (module pur, testée avec un faux client). Le rapport distingue « déjà présentes » et
  « conflit de slug de traduction : fiche non créée » (`conflitsSlugTraduction`, lu dans `meta.target` du P2002).
- **Garde-fou** : `--commit` est refusé si `NODE_ENV=production` ou si `DATABASE_URL` ne vise pas localhost, sauf `--confirmer-prod`.
  L'hôte de la base (sans identifiant) est affiché avant toute écriture.
- `src/lib/knowledge/pack-journee-ia.test.ts` : contrat de tri, de doctrine, de non-publication, d'idempotence et de garde-fou.

```bash
pnpm tsx scripts/import-knowledge-pack-journee-ia.ts            # rapport
pnpm tsx scripts/import-knowledge-pack-journee-ia.ts --commit   # base locale uniquement
# --confirmer-prod : réservé à un accord explicite de Williams
```

## Retour arrière

Avant tout `--commit` : rien à défaire. Après : les fiches se retrouvent par le préfixe de slug `pack-journee-ia-` ; les
archiver depuis la console (aucune suppression physique prévue par ce chantier).
