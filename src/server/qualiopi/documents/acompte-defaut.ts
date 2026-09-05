/**
 * Qualiopi — L&apos;ACOMPTE par défaut d&apos;une convention, en UN seul endroit.
 *
 * Module PUR (aucun I/O, aucun `server-only`) : il est lu par les gabarits PDF,
 * par les producteurs, par l&apos;action de génération ET par le bouton de la
 * console. Une valeur qui s&apos;imprime sur une pièce signée ne peut pas être
 * répétée dans quatre fichiers.
 *
 * ## Le défaut fermé ici (recette du 2026-09-04, N5 + F7)
 *
 * La valeur par défaut était **30 %**, affirmée à quatre endroits — dont celui
 * qui s&apos;imprime (`templates/convention.tsx`) — et le champ qui permet de la
 * changer se trouvait **SOUS le bouton qui le consomme**, en petit, après
 * l&apos;action. Autrement dit : toute convention générée sans avoir remarqué ce
 * champ réclamait au client **30 % à la signature**, clause qu&apos;aucune des
 * deux parties n&apos;avait négociée.
 *
 * ## Pourquoi 0, et pas 30
 *
 * Les deux valeurs sont fausses quand personne n&apos;a choisi. Elles ne le sont
 * pas également :
 *
 * - à 30 %, la pièce que le client SIGNE affirme un terme de paiement qui
 *   n&apos;existe pas. C&apos;est une fausse mention dans un document contractuel,
 *   et elle ne se voit pas : rien à l&apos;écran ne la signale ;
 * - à 0 %, la pièce dit « payable en totalité à réception de facture ». Elle ne
 *   réclame rien qui n&apos;ait été convenu. Si un acompte AVAIT été convenu, il
 *   manque — désagrément de trésorerie, réparable en réémettant.
 *
 * On ne réclame donc jamais par défaut de l&apos;argent que personne n&apos;a
 * promis. La contrepartie — un acompte réel qu&apos;on oublierait de saisir — est
 * traitée par l&apos;écran, pas par la valeur : le champ est désormais AU-DESSUS
 * du bouton, avec la conséquence écrite en toutes lettres.
 *
 * ⚠️ Cette constante REMPLACE un défaut que `contractuels-contenu.spec.tsx`
 * épinglait à 30 avec la mention « ne doit JAMAIS bouger silencieusement ». Il
 * n&apos;a pas bougé silencieusement : le témoin a été réécrit sur la nouvelle
 * valeur, dans le même commit, et il continue d&apos;interdire toute dérive
 * ultérieure. Le changer à nouveau exige de rougir d&apos;abord.
 */

/**
 * Acompte à la signature appliqué quand AUCUN pourcentage n&apos;est transmis.
 *
 * `0` signifie « payable en totalité à réception de facture » — le gabarit
 * n&apos;imprime alors aucune ligne « Acompte à la signature (0 %) : 0,00 € »,
 * qui se lirait comme une erreur de génération sur la pièce signée.
 */
export const ACOMPTE_DEFAUT_PERCENT = 0;

/**
 * ⚠️ Le PLAFOND B2C ne vit PAS ici. Il existe déjà sous le nom
 * `PLAFOND_ACOMPTE_PARTICULIER_PCT`
 * (`src/server/qualiopi/financements/acompte.ts`), avec sa base légale. Le
 * recopier ici en ferait deux vérités pour une seule règle de droit : celle
 * qu&apos;on corrigerait, et celle qu&apos;on oublierait.
 */
