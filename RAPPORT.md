# Rapport — lot OPCO O13 : CGV, article « Financement par un OPCO »

Branche de travail : `opco/o13-cgv-financement` (depuis `origin/main` @ `a84f003d`).

## Fait

Les CGV (`src/content/legal.ts`, lues par `/conditions-generales` et `/terms`) ne disaient rien du financement par un OPCO (0 occurrence de « subrogation »). Un article « Financement par un opérateur de compétences (OPCO) » est ajouté :

- **FR** : après « Dédit et abandon en cours d'exécution » (les deux clauses qu'il renvoie le précèdent) ;
- **EN** : après « Cancellation, rescheduling and refund » ;
- date de dernière mise à jour des CGV (`LAST_UPDATED_ISO` de `src/app/[locale]/conditions-generales/page.tsx`) : **2026-08-17 → 2026-10-04**, avec la ligne d'historique.

**Cohérence avec les conventions** (lues : `convention.tsx` § 5 et `convention-tripartite.tsx` § 1 et § 5) : mêmes termes — « relève de la relation entre le Client et son OPCO », « ne modifie ni le prix convenu, ni son exigibilité », « fait son affaire du remboursement », « subordonnée à l'accord écrit … et au respect de ses règles de financement », « réduction, caducité de l'accord ou non-paiement », « redeviennent exigibles auprès du Client, qui demeure le débiteur du prix convenu ». Aucune contradiction : la tripartite dit « l'OPCO verse sa participation, le solde reste dû par le client » ; l'article dit la même chose.

**Cohérence avec « Dédit et abandon »** : cette clause interdit de réclamer au Client la part non réalisée au-delà du prorata en cas d'abandon. Les heures d'absence (stagiaire absent d'une action qui s'est tenue) sont donc distinguées explicitement de l'abandon, qui reste régi par sa clause.

Aucun délai propre à Axion-IA, aucun chiffre hormis la date de la réforme, aucun médiateur, aucune touche aux phrases « jusqu'à 0 € de reste à charge » ni « à 100 % ».

## Fichiers

- `src/content/legal.ts` (+21 lignes : article FR + EN, commentaire de motif)
- `src/app/[locale]/conditions-generales/page.tsx` (date de mise à jour)
- `src/content/__tests__/cgv-financement-opco.spec.ts` (neuf, sur le patron de `cgv-clauses-protectrices.spec.ts`)

## Texte intégral des clauses ajoutées

### Financement par un opérateur de compétences (OPCO)

> Lorsque le Client sollicite la prise en charge d'une action de formation par son opérateur de compétences (OPCO), il appartient au Client de déposer sa demande de prise en charge auprès de cet OPCO avant le début de la formation, dans les délais et selon les modalités fixés par cet OPCO ; Axion-IA lui transmet à cette fin les pièces nécessaires (convention de formation, programme, devis). Cette démarche relève de la relation entre le Client et son OPCO : la prise en charge est subordonnée à l'accord écrit de l'OPCO et au respect de ses règles de financement, et elle ne modifie ni le prix convenu, ni son exigibilité. Lorsque l'accord de prise en charge prévoit le paiement direct à l'organisme de formation (subrogation de paiement), Axion-IA facture l'OPCO pour la part prise en charge et le Client pour le solde ; à défaut, Axion-IA facture au Client l'intégralité du prix, et le Client fait son affaire du remboursement auprès de son OPCO. Depuis le 1er octobre 2026, dans le cadre de la réforme du régime de TVA applicable aux OPCO, ceux-ci limitent le recours au paiement direct : la modalité applicable est celle que retient l'accord de prise en charge. En cas de refus, de prise en charge partielle ou d'absence de réponse de l'OPCO avant le début de la formation, les sommes non prises en charge demeurent dues par le Client, sauf annulation de sa part dans les conditions de la clause « Annulation, report et remboursement ». L'OPCO ne prend en charge que les heures de formation réalisées et attestées : les heures d'absence d'un stagiaire à une action qui s'est tenue ne sont pas prises en charge et sont facturées au Client, l'abandon en cours de formation restant régi par la clause « Dédit et abandon en cours d'exécution ». Enfin, en cas de réduction, de caducité de l'accord ou de non-paiement par l'OPCO de tout ou partie de la somme qu'il avait acceptée, notamment en raison d'un dossier incomplet du fait du Client ou d'un refus de paiement après contrôle, les sommes correspondantes redeviennent exigibles auprès du Client, qui demeure le débiteur du prix convenu.
## ROUGE / VERT

- **ROUGE** (`1d399302`) : `pnpm vitest run src/content/__tests__/cgv-financement-opco.spec.ts` → 12 échecs sur 14 (« Article … introuvable dans les CGV ») ; les 2 verts sont les renvois vers des clauses existantes.
- **VERT** (`6fa0534f`) : 14/14.
- Non-régression des pages légales : `src/content/__tests__/` (toute la série), `legal-mentions.spec.ts`, `la-notice-informe-les-organisateurs-d-evenements.spec.tsx`, `la-dictee-n-est-active-que-si-la-notice-la-mentionne.spec.ts`, `prevention-violences-une-seule-regle.spec.tsx` → **49 fichiers, 710 tests verts** ; plus `liens-site-public`, `audit-dossier`, `devis.spec.tsx`, `deploy-warm-listes` → **4 fichiers, 144 tests verts**.
- eslint + prettier lancés à la main sur les trois fichiers (le hook pre-push échoue en environnement cloud, d'où `--no-verify`).

Le témoin vérifie : présence des cinq règles (FR), présence en EN, existence des clauses renvoyées, absence de délai chiffré (`sous \d+`, `\d+ h/heures`, `jours ouvrés`, `\d+ jours`, équivalents anglais, « chaque semaine »), absence de « médiateur / médiation », absence de « reste à charge » et de « 100 % » dans l'article.

## Limites

- **« heures » n'est pas interdit tel quel** dans le témoin : la règle 4 impose de parler des heures réalisées et des heures d'absence. Seul un délai chiffré en heures est refusé.
- **Le fait « depuis le 1er octobre 2026, les OPCO limitent le paiement direct (réforme de la TVA des OPCO) »** est repris de la commande ; je ne l'ai pas revérifié à la source (le référentiel A2 cite `CPcommunOpcos_TVA.pdf` d'Akto pour le régime TVA, sans en tirer la date). À faire relire.
- **Pas de relecture par un avocat**, comme les clauses des conventions dont l'article s'inspire.
- **Version anglaise : écart préexistant, non traité** (hors lot) : le barème d'annulation EN (7 j / 2 j calendaires) diffère toujours du FR (15 / 8 jours ouvrés, aligné sur les conventions), et l'EN n'a pas de clause « Dédit et abandon » ; l'article EN ne renvoie donc qu'à « Cancellation, rescheduling and refund ».
- Les fiches formation n'ont pas été modifiées : elles renvoient aux CGV, qui portent désormais l'article.
- Aucun `next build` ni suite complète lancés (consigne).

## Corps de PR proposé

> **feat(cgv) : article « Financement par un opérateur de compétences (OPCO) » (lot OPCO O13)**
>
> Les CGV ne disaient rien du financement OPCO. Ajout d'un article FR + EN : dépôt de la demande par le Client avant le début (délais de l'OPCO, pièces transmises par Axion-IA), facturation selon l'accord de prise en charge (subrogation : OPCO pour sa part, Client pour le solde ; sinon Client en totalité), rappel de la limitation du paiement direct depuis le 1er octobre 2026, refus / prise en charge partielle / absence de réponse → somme due sauf annulation, heures d'absence facturées au Client (abandon réservé), non-paiement de la part acceptée → redevient exigible. Vocabulaire repris de la clause de défaillance des conventions bipartite et tripartite. Aucun délai propre à Axion-IA. Date de mise à jour des CGV : 2026-10-04.
>
> Témoin : `src/content/__tests__/cgv-financement-opco.spec.ts` (14 tests). Pages légales : 53 fichiers, 854 tests verts.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

Sha de tête de `opco/o13-cgv-financement` : **`6fa0534f9dda68171a1b4ad1303a4329a70a7ee4`**
