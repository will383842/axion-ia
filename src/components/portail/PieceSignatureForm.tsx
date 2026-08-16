"use client";
// use-client: pavé de signature (canvas + pointer events) + état local + Server Action.

/**
 * Canal A — signature d'une PIÈCE contractuelle par un tiers, depuis son lien.
 *
 * ## Ce que cet écran doit garantir, et pourquoi
 *
 * 🔴 Le signataire doit avoir sous les yeux CE QU'IL SIGNE. C'est tout l'objet
 * de la bascule du 2026-07-30 : le circuit précédent lui envoyait un PDF
 * détaillé par e-mail et lui faisait signer, ailleurs, un document à trois
 * champs. Le récapitulatif ci-dessous n'est donc pas décoratif — il porte les
 * lignes, les quantités, les prix unitaires et les totaux, et le lien vers le
 * PDF exact dont l'empreinte sera scellée dans la preuve.
 *
 * ⚠️ Aucune identité n'est saisie ici, et il ne faut pas en ajouter. Le nom, la
 * qualité et l'adresse du signataire ont été figés à l'émission du lien, côté
 * serveur, depuis la fiche client. Ils sont AFFICHÉS pour que le signataire
 * puisse les vérifier — pas édités. Un champ « votre nom » rendrait la signature
 * aussi fiable que ce que le porteur du lien a bien voulu déclarer.
 *
 * ## Accessibilité — le chemin sans tracé est de PLEIN DROIT
 *
 * `confirmation_accessible` n'est pas un mode dégradé : une personne qui ne peut
 * pas tracer confirme nominativement, et sa confirmation a la même valeur. Le
 * PDF le dit explicitement au lieu de laisser un cadre vide qui se lirait comme
 * « pas signé ».
 *
 * FR en dur, comme le reste du portail.
 */

import { useState, useTransition } from "react";
import { SignaturePad } from "@/components/portail/SignaturePad";

export interface LigneAffichee {
  designation: string;
  quantite: number;
  prixUnitaireHtLisible: string;
  totalHtLisible: string;
}

export interface PieceSignatureFormProps {
  token: string;
  numero: string;
  /** Date de validité — un devis en a une, une convention non. */
  dateValiditeLisible: string | null;
  organismeNom: string;
  /**
   * Destinataire de la pièce. `null` quand aucun rattachement ne le résout —
   * la phrase se tait alors, plutôt que de nommer l'organisme lui-même comme
   * elle le faisait avant le 2026-08-15.
   */
  clientRaisonSociale: string | null;
  /** Identité FIGÉE à l'émission. Affichée pour vérification, jamais éditable. */
  signataireNom: string;
  signataireQualite: string | null;
  /**
   * Détail chiffré — RENSEIGNÉ uniquement pour un devis.
   *
   * 🔴 C'est la raison d'être de la bascule pour le devis : le signataire doit
   * avoir les lignes, les quantités et les totaux SOUS LES YEUX. Une convention
   * ou un contrat n'a pas de lignes ; leur substance est dans le PDF, dont le
   * lien est affiché juste en dessous. Rendre un tableau vide sur ces pièces
   * laisserait croire qu'il manque quelque chose.
   */
  lignes?: LigneAffichee[];
  totalHtLisible?: string;
  totalTtcLisible?: string;
  mentionTva?: string | null;
  /** Libellé de la pièce, depuis le SSOT (« convention de formation »…). */
  pieceLibelle: string;
  /** Lien vers le PDF exact qui sera scellé. */
  pdfUrl: string | null;
  /**
   * Mentions affichées AU SIGNATAIRE, dans l'ordre rendu par
   * `mentionCompleteDocument` : attestation, valeur juridique, plafond du canal,
   * consentement, RGPD.
   *
   * 🔴 Lot 3quater — c'était UNE chaîne, produite par un `mentions.join(" ")`
   * chez l'appelant. Une vingtaine de lignes de droit s'écrasaient donc en un
   * seul pavé compact, glissé dans l'étiquette de la case à cocher, juste
   * au-dessus du bouton de signature. Un mur de texte avant un engagement se lit
   * comme un obstacle, pas comme une information — et la phrase qui compte
   * vraiment, celle qu'on accepte en cochant, y devenait la plus difficile à
   * trouver.
   *
   * La structure existait déjà dans la donnée : `mentionCompleteDocument` rend
   * un TABLEAU. C'est l'appelant qui l'aplatissait.
   *
   * ⚠️ AUCUN texte n'est modifié, ajouté ni retiré — seule la mise en page
   * change. C'est ce qui rend l'opération sûre : `mentionVersion` et
   * `consentementVersion` identifient le CONTENU des textes et entrent dans le
   * tuple haché ; le contenu ne bouge pas, donc aucune version à incrémenter et
   * aucune empreinte déjà scellée ne devient invérifiable.
   */
  mentions: readonly string[];
  signerAction: (input: {
    token: string;
    methode: "trace" | "confirmation_accessible";
    imageDataUrl?: string;
  }) => Promise<
    { ok: true; signatureId: string; statutSignature: string } | { ok: false; message: string }
  >;
}

export function PieceSignatureForm({
  token,
  numero,
  dateValiditeLisible,
  organismeNom,
  clientRaisonSociale,
  signataireNom,
  signataireQualite,
  lignes,
  totalHtLisible,
  totalTtcLisible,
  mentionTva,
  pieceLibelle,
  pdfUrl,
  mentions,
  signerAction,
}: PieceSignatureFormProps): React.ReactElement {
  // La PREMIÈRE mention est l'attestation : c'est ce que la partie déclare
  // accepter, et donc ce qu'on coche. Les suivantes l'encadrent (valeur
  // juridique, consentement, RGPD) — elles s'appliquent, mais ce n'est pas
  // elles qu'on « accepte ». Les mettre toutes dans l'étiquette rendait
  // l'engagement lui-même illisible.
  const [attestation, ...mentionsEncadrantes] = mentions;
  const [trace, setTrace] = useState<string | null>(null);
  const [modeAccessible, setModeAccessible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [signe, setSigne] = useState(false);
  const [enCours, startTransition] = useTransition();

  // 🔴 Le bouton reste inactif tant que le consentement n'est pas donné ET que
  // la modalité choisie n'a pas produit ce qu'elle doit produire. Sans le second
  // test, un clic sur un pavé vide enverrait `trace` sans image — et le service
  // refuserait en `image_requise`, message que personne ne saurait interpréter.
  const pretASigner = consent && (modeAccessible || trace !== null);

  function soumettre() {
    setErreur(null);
    startTransition(async () => {
      const res = await signerAction({
        token,
        methode: modeAccessible ? "confirmation_accessible" : "trace",
        // ⚠️ Jamais d'image en mode accessible : le service la REFUSE
        // (`image_interdite`), parce que transmettre un tracé présenterait comme
        // manuscrite une signature qui ne l'est pas.
        ...(modeAccessible || trace === null ? {} : { imageDataUrl: trace }),
      });
      if (res.ok) setSigne(true);
      else setErreur(res.message);
    });
  }

  if (signe) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold text-gray-900">Votre signature est enregistrée</h1>
        <p className="mt-3 text-sm text-gray-700">
          {`Merci. Votre signature sur ${pieceLibelle} ${numero} a bien été enregistrée, horodatée et
          rattachée au document que vous venez de lire.`}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          {`${organismeNom} vous adressera l'exemplaire contresigné. Vous pouvez fermer cette page.`}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-gray-900">
        {`${pieceLibelle.charAt(0).toUpperCase()}${pieceLibelle.slice(1)} ${numero}`}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {clientRaisonSociale !== null && clientRaisonSociale !== ""
          ? `Établie par ${organismeNom} à l'attention de ${clientRaisonSociale}.`
          : `Établie par ${organismeNom}.`}
        {dateValiditeLisible !== null ? ` Valable jusqu'au ${dateValiditeLisible}.` : ""}
      </p>

      {/* ── Ce qui est signé, sous les yeux du signataire ── */}
      {/* 🔴 Le détail chiffré n'existe QUE pour un devis. Sur une convention ou
          un contrat, la substance est dans le PDF — rendre un tableau vide
          laisserait croire qu'il manque quelque chose. */}
      <section className="mt-8" aria-labelledby="recap-titre">
        {lignes !== undefined && lignes.length > 0 ? (
          <>
            <h2 id="recap-titre" className="text-sm font-semibold text-gray-900">
              Détail de la prestation
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left text-xs text-gray-600 uppercase">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Désignation
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Qté
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      PU HT
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Total HT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-b border-gray-200 align-top">
                      <td className="py-2 pr-3 text-gray-900">{l.designation}</td>
                      <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">
                        {l.quantite}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">
                        {l.prixUnitaireHtLisible}
                      </td>
                      <td className="py-2 text-right text-gray-900 tabular-nums">
                        {l.totalHtLisible}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total HT</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{totalHtLisible ?? ""}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-gray-900">Total TTC</dt>
                <dd className="font-semibold text-gray-900 tabular-nums">
                  {totalTtcLisible ?? ""}
                </dd>
              </div>
            </dl>
            {mentionTva != null && <p className="mt-2 text-xs text-gray-600">{mentionTva}</p>}
          </>
        ) : null}

        {pdfUrl !== null && (
          <p className="mt-4 text-sm">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {/* 🔴 Disait « le devis » sur TOUTES les pièces — donc sur une
                  convention, un contrat, une tripartite. Le libellé DÉRIVE du
                  SSOT des circuits, il ne se réécrit pas ici. */}
              {`Ouvrir ${pieceLibelle} au format PDF`}
            </a>
            <span className="block text-xs text-gray-600">
              C&apos;est ce document exact, et son empreinte, que votre signature scelle.
            </span>
          </p>
        )}
      </section>

      {/* ── Le signataire, tel qu'il a été identifié ── */}
      <section className="mt-8 rounded border border-gray-300 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-900">Signataire</h2>
        <p className="mt-1 text-sm text-gray-900">{signataireNom}</p>
        {signataireQualite !== null && <p className="text-sm text-gray-700">{signataireQualite}</p>}
        <p className="mt-2 text-xs text-gray-600">
          Cette identité a été enregistrée par {organismeNom} lors de l&apos;envoi de ce lien. Si
          elle est inexacte, ne signez pas et prévenez votre interlocuteur : un lien corrigé vous
          sera adressé.
        </p>
      </section>

      {/* ── Signature ── */}
      <section className="mt-8" aria-labelledby="signature-titre">
        <h2 id="signature-titre" className="text-sm font-semibold text-gray-900">
          Bon pour accord
        </h2>

        {!modeAccessible ? (
          <div className="mt-3">
            <SignaturePad
              onChange={setTrace}
              disabled={enCours}
              label="Zone de signature — tracez votre signature"
              onBasculerAccessible={() => {
                setModeAccessible(true);
                setTrace(null);
              }}
            />
          </div>
        ) : (
          <div className="mt-3 rounded border border-gray-300 p-4">
            <p className="text-sm text-gray-900">
              Vous avez choisi de confirmer votre accord sans tracé manuscrit.
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Cette modalité a exactement la même valeur qu&apos;une signature tracée. Elle sera
              mentionnée comme telle sur le document.
            </p>
            <button
              type="button"
              onClick={() => setModeAccessible(false)}
              disabled={enCours}
              className="mt-3 text-sm underline underline-offset-4 disabled:opacity-50"
            >
              Revenir au tracé manuscrit
            </button>
          </div>
        )}

        {/* L'ENGAGEMENT — court, isolé, et c'est lui qu'on coche. */}
        <label className="mt-5 flex items-start gap-3 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={enCours}
            className="mt-1"
          />
          <span>{attestation}</span>
        </label>

        {/* CE QUI ENCADRE L'ENGAGEMENT — valeur juridique, consentement, RGPD.
            Replié, sur DÉCISION DE WILL du 16/08.

            J'avais d'abord laissé ce bloc déployé, au motif qu'on ne masque pas
            une information légalement due sur l'écran même où l'on recueille un
            consentement. Will a tranché : on replie. C'est sa décision, et elle
            se défend — un pavé que personne ne lit n'informe personne mieux
            qu'un dépli qu'on peut ouvrir.

            🔴 CE QUI REND LE DÉPLI DÉFENDABLE, et qu'il ne faut pas défaire :

            1. `<details>` est un élément NATIF : le texte reste dans le DOM, il
               est atteignable au clavier, annoncé par les lecteurs d'écran, et
               imprimé par certains navigateurs. Un `display:none` piloté en
               JavaScript n'aurait aucune de ces propriétés — ne pas « moderniser »
               ce bloc en composant maison ;
            2. l'ATTESTATION — la phrase qu'on accepte en cochant — reste
               DEHORS, au-dessus. Ce qui est replié encadre l'engagement, ce
               n'est pas l'engagement ;
            3. le résumé ANNONCE ce qu'il contient et combien : « 4 mentions ».
               Un dépli muet se referme sur son contenu ; un dépli qui compte
               dit qu'il y a quelque chose à lire.

            ⚠️ Toujours à faire relire par l'avocat avec les clauses OPCO. Le
            repli est un choix d'affichage, pas un avis juridique. */}
        {mentionsEncadrantes.length > 0 && (
          <details className="group mt-4 rounded border border-gray-200 bg-gray-50">
            <summary className="cursor-pointer list-none p-3 text-xs font-semibold tracking-wide text-gray-700 uppercase hover:bg-gray-100">
              <span aria-hidden="true" className="mr-1 inline-block group-open:hidden">
                +
              </span>
              <span aria-hidden="true" className="mr-1 hidden group-open:inline-block">
                −
              </span>
              Valeur de cette signature et vos droits ({mentionsEncadrantes.length} mentions)
            </summary>
            <div className="space-y-2 px-3 pt-1 pb-3">
              {mentionsEncadrantes.map((texte) => (
                <p key={texte} className="text-xs leading-relaxed text-gray-700">
                  {texte}
                </p>
              ))}
            </div>
          </details>
        )}

        {erreur !== null && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={soumettre}
          disabled={!pretASigner || enCours}
          className="mt-6 rounded bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {enCours ? "Enregistrement…" : `Signer ${pieceLibelle}`}
        </button>
        {!pretASigner && (
          <p className="mt-2 text-xs text-gray-600">
            {modeAccessible
              ? "Cochez la case ci-dessus pour confirmer votre accord."
              : "Tracez votre signature et cochez la case ci-dessus."}
          </p>
        )}
      </section>
    </div>
  );
}
