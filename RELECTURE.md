# Relecture juridique A07 — tour 2 — CGV, article « Financement par un opérateur de compétences (OPCO) »

- Branche relue : `opco/o13-cgv-financement` (tête `f83fb1bc`, diff `origin/main...origin/opco/o13-cgv-financement`)
- Fichiers lus : `src/content/legal.ts` (FR et EN), `src/server/qualiopi/documents/templates/convention.tsx` (§ 5), `convention-tripartite.tsx` (§ 5)
- Date : 2026-10-04 — relecteur : A07 (aucun fichier de la PR modifié)

## 1. Les trois motifs du tour 1 — dans les CGV françaises

| Motif | État | Constat |
| --- | --- | --- |
| (1) Réduction OPCO réclamée au-delà du prorata d'abandon | **Levé (FR)** | « Enfin, sous réserve de la clause « Dédit et abandon en cours d'exécution », … » : la dernière phrase cède devant le plafond du prorata. |
| (2) Ambiguïté de « réalisées » (absence / abandon, art. 1190 C. civ.) | **Levé** | « heures effectivement suivies par chaque stagiaire, attestées par l'émargement » ; séance « tenue par Axion-IA » ; abandon défini comme « l'arrêt définitif de la participation du stagiaire à l'action » et renvoyé à la clause de dédit. Les deux régimes ne se recouvrent plus. |
| (3) Non-paiement de l'OPCO dû à un manquement d'Axion-IA (L.6354-1 C. trav., L.442-1 C. com.) | **Levé (FR)** | « sauf lorsque la réduction, la caducité ou le non-paiement résulte d'un manquement d'Axion-IA à ses propres obligations (…) ». |

Points non bloquants du tour 1 : tous repris — exigibilité « sous réserve de la subrogation de paiement prévue ci-après » ; la phrase datée sur la réforme TVA est remplacée par un renvoi aux règles propres à chaque OPCO ; le renvoi à la clause d'annulation dit désormais que « les sommes dues [sont] alors celles prévues par » cette clause.

Cohérence interne des CGV FR : aucune contradiction nouvelle avec « Prix », « Conditions de paiement » (le paiement à la commande cède devant la subrogation par la réserve d'exigibilité), « Annulation, report et remboursement » ni « Dédit et abandon en cours d'exécution ».

Contraintes du dirigeant (FR et EN) : tenues. Aucun délai chiffré propre à Axion-IA (les seuls délais visés sont « ceux fixés par cet OPCO »), aucun médiateur, aucune occurrence de « reste à charge », « 100 % » ou équivalent anglais.

## 2. Défaut bloquant A — les conventions signées neutralisent les motifs (1) et (3)

Les deux conventions, qui listent les CGV **en annexe** (bipartite l. 536, tripartite l. 507), portent toujours :

- `convention.tsx` § 5 (l. 456-459) : « En cas de refus, de réduction, de caducité de l'accord ou de non-paiement par le financeur, **pour quelque cause que ce soit**, les sommes correspondantes demeurent dues par le client. »
- `convention-tripartite.tsx` § 5 (l. 417-420) : « … ou de non-paiement par l'OPCO **pour quelque cause que ce soit**, les sommes correspondantes redeviennent exigibles auprès du client, qui demeure le débiteur du prix convenu à l'article 3. »

« Pour quelque cause que ce soit » inclut le manquement d'Axion-IA et ignore le plafond du prorata d'abandon. Or, en cas de discordance, **les conditions particulières l'emportent sur les conditions générales** (art. 1119 al. 3 C. civ.) : la convention signée pour l'action prévaut sur les CGV annexées. Les corrections du tour 1 sont donc exactes dans les CGV, mais privées d'effet dans le seul document que signent le client et, en tripartite, l'OPCO. Le commentaire de l'article (« mêmes mots ») n'est plus vrai : la PR crée précisément la discordance qu'elle voulait éviter.

**Reformulation exacte exigée** (même PR, puisque c'est elle qui crée l'écart) :

- `convention.tsx` § 5, dernière phrase, remplacer par :
  > En cas de refus, de réduction, de caducité de l'accord ou de non-paiement par le financeur, les sommes correspondantes demeurent dues par le client, sous réserve des conditions de dédit et d'abandon en cours d'exécution prévues aux conditions générales de vente, et sauf lorsque la réduction, la caducité ou le non-paiement résulte d'un manquement de l'organisme à ses propres obligations (inexécution de tout ou partie de l'action, défaut des justificatifs de réalisation qui lui incombent).

- `convention-tripartite.tsx` § 5, dernière phrase, remplacer par :
  > En cas de refus, de réduction, de caducité de l'accord ou de non-paiement par l'OPCO, les sommes correspondantes redeviennent exigibles auprès du client, qui demeure le débiteur du prix convenu à l'article 3, sous réserve des conditions de dédit et d'abandon en cours d'exécution prévues aux conditions générales de vente, et sauf lorsque la réduction, la caducité ou le non-paiement résulte d'un manquement de l'organisme à ses propres obligations (inexécution de tout ou partie de l'action, défaut des justificatifs de réalisation qui lui incombent).

(« L'organisme » est le terme de ces conventions ; ne pas y écrire « Axion-IA ». Le témoin `cgv-financement-opco.spec.ts`, famille 2 « cohérence avec la convention », gagnerait à vérifier l'absence de « pour quelque cause que ce soit » dans les deux gabarits.)

## 3. Défaut bloquant B — la version anglaise réintroduit le motif (1)

Les CGV anglaises n'ont **pas** de clause « Dédit et abandon en cours d'exécution ». La traduction a donc retiré les deux renvois :

- FR : « L'abandon … reste régi par la clause « Dédit et abandon en cours d'exécution ». » → EN : « Abandonment … is not covered by this rule. » (l'abandon n'est plus régi par rien) ;
- FR : « Enfin, sous réserve de la clause « Dédit et abandon … », en cas de réduction … » → EN : « Finally, in the event of reduction … » (aucune réserve).

Résultat : pour un lecteur de la version anglaise, la réduction OPCO consécutive à un abandon redevient exigible du Client sans plafond — exactement le motif (1). Ce n'est pas une traduction fidèle, et aucune clause ne fait prévaloir le français.

**Reformulation exacte exigée** (EN, article « Funding by a skills operator (OPCO) ») :

- remplacer « Abandonment, meaning the permanent cessation of the trainee's participation in the action, is not covered by this rule. » par :
  > Abandonment, meaning the permanent cessation of the trainee's participation in the action, is not covered by this rule: in that event, the services actually delivered up to the date of abandonment remain payable pro rata, and the undelivered share is neither invoiced to the OPCO nor claimable from the Client beyond that pro rata amount.
- remplacer « Finally, in the event of reduction, » par :
  > Finally, subject to the rule on abandonment set out above, in the event of reduction,

## 4. Remarques non bloquantes

1. **Refus initial imputable à Axion-IA.** L'exception pour manquement d'Axion-IA ne couvre que « réduction, caducité, non-paiement », pas le « refus » de la phrase précédente (ex. pièces transmises incomplètes ou défaut de certification exigée par l'OPCO). On peut écrire, dans la phrase « En cas de refus, … » : « …demeurent dues par le Client, sauf lorsque le refus résulte d'un manquement d'Axion-IA à ses propres obligations, et sauf annulation de sa part… ». Non bloquant : le droit commun (art. 1231-1 C. civ.) y pourvoit.
2. **Divergence préexistante FR/EN de la clause d'annulation** (FR : 15 / 8 jours ouvrés ; EN : 7 / 2 jours). L'article EN y renvoie désormais nommément ; l'écart, hors périmètre de cette PR, mérite un lot dédié.

## Verdict

**refuse** — les trois motifs du tour 1 sont levés dans les CGV françaises, mais (A) la clause « pour quelque cause que ce soit » des deux conventions, qui prévaut sur les CGV (art. 1119 al. 3 C. civ.), annule en pratique les corrections (1) et (3), et (B) la version anglaise supprime le plafond du prorata d'abandon. Les reformulations exactes figurent aux sections 2 et 3.

---
_Generated by [Claude Code](https://claude.ai/code)_
