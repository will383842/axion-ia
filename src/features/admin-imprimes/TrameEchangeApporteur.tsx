// La trame de l'échange de 15 minutes avec un candidat apporteur (2026-11-27).
//
// 🔒 DOCUMENT INTERNE : elle ne va JAMAIS dans `public/` (`public/imprimes` est
// servi sans contrôle). Elle n'existe que derrière la page admin
// `imprimes/trame-apporteur`, qui exige la session.
//
// Ce fichier FAIT FOI pour la trame (version du 27/11/2026, contrat 2.8) ;
// `docs/imprimes/trame-echange-apporteur.html` et son PDF sont plus anciens. Il est
// écrit en JSX (`dangerouslySetInnerHTML` ne sert qu'au CSS statique) : le prénom passé dans l'URL
// est un simple texte, que React échappe.
//
// Le CSS est limité à cette page : tout est préfixé par `.trame-apporteur`.
// À l'impression, le reste de la console (menu, en-tête) est masqué.

import type { ReactElement } from "react";

const CSS = `
.trame-apporteur{--o:#c2410c;--f:#1c1917;--g:#57534e;--l:#e7e5e4;--c:#fff7ed;--v:#166534;--r:#991b1b;color:var(--f);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:980px;margin:0 auto;padding:28px 22px 60px}
.trame-apporteur *{box-sizing:border-box}
.trame-apporteur .sur{color:var(--o);font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.trame-apporteur h1{font-size:30px;margin:2px 0 4px;line-height:1.15}
.trame-apporteur .sous{color:var(--g);margin:0 0 18px}
.trame-apporteur h2{font-size:17px;color:var(--o);margin:0 0 8px}
.trame-apporteur .carte{background:#fff;border:1px solid var(--l);border-radius:12px;padding:16px 18px;margin:0 0 14px}
.trame-apporteur .alerte{background:#fef2f2;border-color:#fecaca}
.trame-apporteur .alerte h2{color:var(--r)}
.trame-apporteur .but{background:var(--c);border-left:4px solid var(--o);border-radius:6px;padding:10px 14px;margin:0 0 14px}
.trame-apporteur .bloc{display:grid;grid-template-columns:92px 1fr;gap:16px}
.trame-apporteur .temps{font-size:26px;font-weight:800;color:var(--o);line-height:1}
.trame-apporteur .temps small{display:block;font-size:12px;font-weight:500;color:var(--g);margin-top:5px;line-height:1.3}
.trame-apporteur .dire{font-style:italic;border-left:3px solid var(--o);padding-left:11px;margin:0 0 9px}
.trame-apporteur ul{margin:0;padding-left:0;list-style:none}
.trame-apporteur li{margin:0 0 6px;padding-left:22px;position:relative}
.trame-apporteur ul.q li::before{content:"?";position:absolute;left:4px;color:var(--o);font-weight:800}
.trame-apporteur ul.p li::before{content:"•";position:absolute;left:6px;color:var(--o);font-weight:800}
.trame-apporteur ul.non li::before{content:"✕";position:absolute;left:3px;color:var(--r);font-weight:800}
.trame-apporteur ul.case li::before{content:"☐";position:absolute;left:2px}
.trame-apporteur .note{color:var(--g);font-size:13.5px}
.trame-apporteur .deux{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.trame-apporteur .quatre{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0}
.trame-apporteur .etape{background:#fafaf9;border:1px solid var(--l);border-radius:8px;padding:9px 10px;font-size:13.5px}
.trame-apporteur .etape b{display:block;color:var(--o);margin-bottom:2px}
.trame-apporteur table{width:100%;border-collapse:collapse;font-size:14px}
.trame-apporteur th,.trame-apporteur td{border:1px solid var(--l);padding:7px 9px;text-align:left;vertical-align:top}
.trame-apporteur th{background:#fafaf9}
.trame-apporteur .oui{color:var(--v);font-weight:700}
.trame-apporteur .pas{color:var(--r);font-weight:700}
.trame-apporteur .ligne{border-bottom:1px solid #a8a29e;height:26px}
.trame-apporteur .barre{display:flex;justify-content:flex-end;margin:0 0 14px}
@media(max-width:700px){.trame-apporteur .bloc{grid-template-columns:1fr}.trame-apporteur .deux{grid-template-columns:1fr}.trame-apporteur .quatre{grid-template-columns:1fr 1fr}}
@page{size:A4;margin:12mm}
@media print{
body *{visibility:hidden}
.trame-apporteur,.trame-apporteur *{visibility:visible}
.trame-apporteur{position:absolute;left:0;top:0;width:100%;max-width:none;padding:0;font-size:12px;background:#fff}
.trame-apporteur .carte{break-inside:avoid;padding:10px 12px;margin-bottom:8px}
.trame-apporteur h1{font-size:22px}
.trame-apporteur .barre{display:none}
}
`;

/** Le prénom, tel qu'il se lit dans le texte. Vide : « [prénom] » reste à compléter à la main. */
export function prenomPourLaTrame(brut: string | null | undefined): string {
  const t = (brut ?? "").trim().slice(0, 40);
  return t && /^[\p{L}][\p{L}' -]*$/u.test(t) ? t : "[prénom]";
}

export function TrameEchangeApporteur({
  prenom,
  barre,
}: {
  prenom: string;
  /** Le bouton « Imprimer » (client) : masqué à l'impression. */
  barre?: ReactElement;
}) {
  return (
    <div className="trame-apporteur">
      {/* CSS statique de ce fichier (aucune valeur d'URL) : le texte d'un <style> serait échappé par React. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {barre ? <div className="barre">{barre}</div> : null}
      <div className="sur">Axion-IA · Apporteurs d&apos;affaires · document interne</div>
      <h1>Trame d&apos;appel : apporteur d&apos;affaires, Journée IA</h1>
      <p className="sous">
        15 minutes en visio · il parle plus que vous · réponse par e-mail sous 48 h · mise à jour du
        27/11/2026 (contrat 2.8)
      </p>
      <div className="carte alerte">
        <h2>À savoir avant de décrocher (3 points)</h2>
        <ul className="p">
          <li>
            <b>Ne jamais parler d&apos;OPCO, de Qualiopi ni de prise en charge.</b>
          </li>
          <li>
            <b>Commission Journée IA : 500 € HT par Journée vendue et payée.</b> Réduite dans la
            même proportion si le client paie moins que 1 490 €. Gardée en entier si la Journée est
            ensuite déduite d&apos;une commande de mise en place.
          </li>
          <li>
            <b>Garantie : la règle est celle de l&apos;article 47.10 des conditions de vente.</b> Si
            les gains identifiés n&apos;atteignent pas 3 fois le prix HT de la journée, nous
            remboursons le client sous 30 jours. Seule condition : la présence du décideur et des
            personnes prévues pendant l&apos;audit. Le total écrit des gains lui est remis à la fin
            de la journée, le rapport complet sous 10 jours ouvrés. Ce texte est pour vous : en
            appel, ne présentez pas et ne commentez pas la garantie (votre contrat le prévoit).
            Dites seulement : « la garantie est écrite sur la page de la Journée IA, et Williams la
            détaille au rendez-vous ».
          </li>
        </ul>
      </div>
      <div className="but">
        <b>Le but :</b> savoir s&apos;il croise vraiment des dirigeants, lui faire comprendre la
        Journée IA en une phrase, et qu&apos;il reparte en sachant à qui en parler. On note les{" "}
        <b>faits</b> qu&apos;il cite, pas ses intentions.
      </div>
      <div className="carte bloc">
        <div className="temps">
          1&apos;<small>Accueil</small>
        </div>
        <div>
          <p className="dire">
            « Bonjour {prenom}, merci pour ce créneau. Je vous pose quelques questions, je vous
            explique ce qu&apos;on fait et comment ça marche, puis je réponds aux vôtres. C&apos;est
            sans engagement, de part et d&apos;autre. »
          </p>
        </div>
      </div>
      <div className="carte bloc">
        <div className="temps">
          5&apos;<small>L&apos;écouter</small>
        </div>
        <div>
          <ul className="q">
            <li>
              <b>Motivation :</b> « Que faites-vous aujourd&apos;hui, et qu&apos;est-ce qui vous a
              donné envie d&apos;échanger avec nous ? Qu&apos;attendez-vous de cette activité ? »
            </li>
            <li>
              <b>Parcours commercial :</b> « Depuis combien de temps êtes-vous dans le commercial ?
              Dans quels secteurs, pour quels produits ou services ? »
            </li>
            <li>
              <b>Vente aux entreprises :</b> « Avez-vous déjà vendu ou rendu service à des
              entreprises plutôt qu&apos;à des particuliers ? À qui parliez-vous : dirigeants,
              responsables ? De quelle taille ? »
            </li>
            <li>
              <b>Réseau :</b> « Quels chefs d&apos;entreprise pourriez-vous appeler demain ? Quels
              secteurs, quelle taille, quelle région ? » Sinon : « Où en croisez-vous ? Clubs,
              associations, anciens collègues, commerçants… »
            </li>
            <li>
              <b>Vécu :</b> « Racontez-moi une fois où vous avez mis quelqu&apos;un en relation avec
              une personne qui pouvait l&apos;aider. »
            </li>
            <li>
              <b>Autres activités :</b> « Êtes-vous déjà apporteur pour d&apos;autres sociétés ?
              Lesquelles, pour quels produits ? »
            </li>
            <li>
              <b>Ce qu&apos;il entend :</b> « Quand les dirigeants que vous connaissez parlent
              d&apos;IA, que disent-ils ? »
            </li>
            <li>
              <b>Statut :</b> « Avez-vous déjà un numéro SIREN (micro-entreprise ou société) ? »
            </li>
          </ul>
          <p className="note">
            Relances : « Concrètement ? » · « Par exemple ? » · « Combien, à peu près ? »
          </p>
        </div>
      </div>
      <div className="carte bloc">
        <div className="temps">
          4&apos;<small>Ce qu&apos;on fait · la Journée IA</small>
        </div>
        <div>
          <p className="dire">
            « Les dirigeants entendent parler d&apos;IA partout et ne savent plus par où commencer.
            Nous, si. On les aide à passer à l&apos;IA avec un vrai plan, au lieu d&apos;acheter des
            outils un par un qui ne rapportent rien. »
          </p>
          <p className="dire">
            « La porte d&apos;entrée, c&apos;est la Journée IA : une journée dans l&apos;entreprise.
            Le matin, on regarde où l&apos;entreprise perd du temps et de l&apos;argent.
            L&apos;après-midi, on forme l&apos;équipe. Sous 10 jours ouvrés, le dirigeant reçoit un
            rapport qui dit quoi lancer, quoi tester, quoi écarter, avec les gains chiffrés. »
          </p>
          <table>
            <tbody>
              <tr>
                <th style={{ width: "32%" }}>Point</th>
                <th>Ce qu&apos;on peut dire</th>
              </tr>
              <tr>
                <td>
                  <b>Prix</b>
                </td>
                <td>1 490 € HT, prix public, le même pour tous.</td>
              </tr>
              <tr>
                <td>
                  <b>Pour qui</b>
                </td>
                <td>
                  Toute entreprise de 2 à 250 salariés, tout secteur, partout en France (outre-mer
                  compris). La formation de l&apos;après-midi : 15 personnes au plus.
                </td>
              </tr>
              <tr>
                <td>
                  <b>Le matin</b>
                </td>
                <td>
                  Audit de 2 à 4 heures selon l&apos;entreprise. Un questionnaire est envoyé avant.
                </td>
              </tr>
              <tr>
                <td>
                  <b>L&apos;après-midi</b>
                </td>
                <td>
                  Formation de l&apos;équipe sur ses vrais cas. Attestations remises aux
                  participants.
                </td>
              </tr>
              <tr>
                <td>
                  <b>Après</b>
                </td>
                <td>
                  Total écrit des gains remis à la fin de la journée ; rapport complet sous 10 jours
                  ouvrés : priorités et gains chiffrés sur un an.
                </td>
              </tr>
              <tr>
                <td>
                  <b>Garantie</b>
                </td>
                <td>
                  Si les gains identifiés n&apos;atteignent pas 3 fois le prix HT de la journée,
                  remboursement sous 30 jours. Seule condition : la présence du décideur et des
                  personnes prévues pendant l&apos;audit. (Pour vous seulement : au client, renvoyez
                  vers la page et le rendez-vous.)
                </td>
              </tr>
              <tr>
                <td>
                  <b>Si le client continue</b>
                </td>
                <td>
                  Les 1 490 € sont déduits s&apos;il commande, dans les 60 jours, au moins 5 000 €
                  HT de mise en place payée en une fois (hors abonnements).
                </td>
              </tr>
              <tr>
                <td>
                  <b>Argument simple</b>
                </td>
                <td>Rien à installer, aucun accès à donner.</td>
              </tr>
              <tr>
                <td>
                  <b>Le reste</b>
                </td>
                <td>
                  On fait aussi : formations adaptées au métier, audits, automatisations,
                  intégrations. La Journée IA n&apos;est pas un passage obligé.
                </td>
              </tr>
            </tbody>
          </table>
          <p className="note" style={{ marginTop: "8px" }}>
            <b>Les phrases de dirigeant qui doivent lui faire penser à nous :</b> « On me parle
            d&apos;IA partout, je ne sais pas par où commencer » · « Mes équipes utilisent ChatGPT
            chacune dans leur coin » · « On perd un temps fou sur les devis, les e-mails, la saisie
            » · « Je n&apos;ai pas le temps de m&apos;y mettre ».
          </p>
        </div>
      </div>
      <div className="carte bloc">
        <div className="temps">
          3&apos;<small>Comment ça se passe</small>
        </div>
        <div>
          <p className="dire">« Vous ne vendez rien : vous recommandez. On fait tout le reste. »</p>
          <div className="quatre">
            <div className="etape">
              <b>1 · Vous en parlez</b>à un dirigeant que vous avez réellement rencontré ou appelé,
              et qui est d&apos;accord pour être contacté.
            </div>
            <div className="etape">
              <b>2 · Vous l&apos;indiquez</b>dans votre espace en ligne : son SIRET et la personne à
              qui vous avez vraiment parlé. Elle vous est gardée 60 jours.
            </div>
            <div className="etape">
              <b>3 · Elle prend rendez-vous</b>Dès son 1er rendez-vous avec Axion IA (pris dans les
              60 jours) ou sa 1re commande, elle est à vous pour 6 mois.
            </div>
            <div className="etape">
              <b>4 · Vous êtes payé</b>quand le client a payé 100 % de la facture. On prépare votre
              facture à votre place. Virement sous 30 jours au plus tard.
            </div>
          </div>
          <ul className="p">
            <li>
              <b>Commissions (HT) :</b> Journée IA 500 € · formation 4 h 250 € · formation 1 jour
              500 € · 2 jours et plus 1 000 € (plafond) · audit vendu seul 30 % · automatisation,
              intégration : 15 % de la mise en service et des ventes payées en une fois.
            </li>
            <li>
              <b>Ne donnent rien :</b> coaching individuel, abonnements, maintenance, hébergement,
              licences, formation financée par le CPF.
            </li>
            <li>
              <b>Réduction accordée au client :</b> la commission baisse dans la même proportion.
            </li>
            <li>
              <b>Cadre :</b> indépendant avec un numéro SIREN (micro-entreprise ou société), en
              France. Aucun frais, aucune exclusivité, aucun objectif, aucun compte rendu.
            </li>
            <li>
              <b>Challenge de décembre :</b> ses règles sont écrites dans le guide de démarrage
              remis avec le contrat. Libre, sans obligation.
            </li>
          </ul>
          <p className="note">
            Toujours dire « libre, sans obligation » : un challenge imposé ressemble à un objectif
            de salarié. Pour les montants du challenge, renvoyer au guide.
          </p>
          <ul className="q" style={{ marginTop: "8px" }}>
            <li>
              « Ce fonctionnement, payé uniquement à la commission quand le client a payé, vous
              convient ? Qu&apos;est-ce qui est le moins clair ? »
            </li>
            <li>
              « Vous croisez un dirigeant demain : comment lui parlez-vous de la Journée IA en
              trente secondes ? »
            </li>
            <li>
              « À quelles 2 ou 3 entreprises penseriez-vous d&apos;abord ? »{" "}
              <span className="note">(noter les secteurs, pas les noms)</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="carte bloc">
        <div className="temps">
          2&apos;<small>Ses questions · la suite</small>
        </div>
        <div>
          <ul className="q">
            <li>
              « Quelles questions avez-vous ? Qu&apos;est-ce qui pourrait vous faire hésiter ? »
            </li>
          </ul>
          <p className="dire" style={{ marginTop: "8px" }}>
            « Merci {prenom}. Je vous fais un retour par e-mail sous 48 heures. Si on continue, vous
            recevrez le lien de votre dossier : contrat à signer en ligne, pièce d&apos;identité et
            RIB. »
          </p>
          <p className="note">
            Ne jamais dire oui pendant l&apos;appel. Ne jamais promettre de revenu.
          </p>
        </div>
      </div>
      <div className="carte">
        <h2>Réponses rapides</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ width: "34%" }}>« Je n&apos;y connais rien en IA. »</td>
              <td>
                Pas besoin : il suffit de connaître des dirigeants et d&apos;en parler. On
                s&apos;occupe du reste.
              </td>
            </tr>
            <tr>
              <td>« Combien je peux gagner ? »</td>
              <td>
                Uniquement ce qui est signé et payé. Exemple : une Journée IA payée = 500 €. Aucune
                projection.
              </td>
            </tr>
            <tr>
              <td>« Le challenge, c&apos;est combien ? »</td>
              <td>
                « C&apos;est écrit dans le guide de démarrage que vous recevez avec le contrat. Ce
                qui compte d&apos;abord, ce sont les commissions du contrat. »
              </td>
            </tr>
            <tr>
              <td>« Est-ce que c&apos;est financé ? »</td>
              <td>
                « Toute question de prix ou de financement, vous nous la renvoyez. » Ne rien
                ajouter.
              </td>
            </tr>
            <tr>
              <td>« Et si le client signe tard ? »</td>
              <td>
                Une fois validée (1er rendez-vous ou commande), l&apos;entreprise reste à son nom 6
                mois : ses commandes signées dans ce délai sont commissionnées. Prolongeable une
                fois de 3 mois (contrat, art. 3.4).
              </td>
            </tr>
            <tr>
              <td>« Je n&apos;ai pas de SIREN. »</td>
              <td>
                On ne le refuse pas : créer une micro-entreprise se fait en ligne
                (autoentrepreneur.urssaf.fr). Son dossier attend. Aucun contrat ni commission sans
                SIREN.
              </td>
            </tr>
            <tr>
              <td>« Vous suivez le client après ? »</td>
              <td>
                Il n&apos;a pas à suivre le client : c&apos;est nous. Ne pas promettre de suivi
                après la prestation.
              </td>
            </tr>
            <tr>
              <td>« Je peux donner le prix ? »</td>
              <td>
                Le prix public de la Journée IA, oui (1 490 € HT). Jamais de remise, de devis ni de
                délai.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="deux">
        <div className="carte">
          <h2>Les mots</h2>
          <p>
            <span className="oui">On dit :</span> échange · recommander · mettre en relation ·
            commission · indépendant
          </p>
          <p>
            <span className="pas">On évite :</span> entretien · poste · recrutement · salarié ·
            vendre · prospecter · objectif · horaires · OPCO · Qualiopi · financé
          </p>
          <p className="note">
            On ne demande jamais : âge, famille, origine, religion, santé, opinions.
          </p>
        </div>
        <div className="carte">
          <h2>Ce que l&apos;apporteur ne fait jamais</h2>
          <ul className="non">
            <li>Donner une remise, un devis, un délai ou une promesse de financement</li>
            <li>Se présenter comme salarié ou représentant d&apos;Axion-IA</li>
            <li>Présenter une entreprise qu&apos;il n&apos;a pas contactée</li>
            <li>Utiliser le nom ou le logo Axion-IA sur ses supports</li>
          </ul>
        </div>
      </div>
      <div className="deux">
        <div className="carte">
          <h2>Sans suite si…</h2>
          <ul className="case">
            <li>Veut un fixe ou des horaires</li>
            <li>Refuse d&apos;être indépendant</li>
            <li>Aucun moyen de croiser des dirigeants</li>
            <li>Apporte déjà pour un concurrent en IA</li>
          </ul>
          <p className="note">
            Débutant ou sans expérience des entreprises : ce n&apos;est pas un frein.
          </p>
        </div>
        <div className="carte">
          <h2>Notes, juste après l&apos;appel</h2>
          <p className="note">Nom · date</p>
          <div className="ligne"></div>
          <p className="note">
            Motivation · années dans le commercial · secteurs · déjà vendu à des entreprises ?
          </p>
          <div className="ligne"></div>
          <p className="note">Réseau (secteurs, lieux)</p>
          <div className="ligne"></div>
          <p className="note">Réseau /5 · Aisance /5 · Compréhension /5 · Autonomie /5 = /20</p>
          <div className="ligne"></div>
          <p className="note">
            ☐ 16 et plus : on continue {" "} ☐ 11 à 15 : à revoir {" "} ☐ 10 et moins : sans suite
          </p>
        </div>
      </div>
      <p className="note">
        Sources : trame du 25/11, fiche des commissions et livret du 27/11 (contrat 2.8).
      </p>{" "}
    </div>
  );
}
