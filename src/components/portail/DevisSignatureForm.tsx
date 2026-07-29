"use client";
// use-client: pavé de signature (canvas + pointer events) + état local + Server Action.

/**
 * Canal A — « Bon pour accord » du client sur son devis.
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

export interface DevisSignatureFormProps {
  token: string;
  numero: string;
  dateValiditeLisible: string;
  organismeNom: string;
  clientRaisonSociale: string;
  /** Identité FIGÉE à l'émission. Affichée pour vérification, jamais éditable. */
  signataireNom: string;
  signataireQualite: string | null;
  lignes: LigneAffichee[];
  totalHtLisible: string;
  totalTtcLisible: string;
  mentionTva: string | null;
  /** Lien vers le PDF exact qui sera scellé. */
  pdfUrl: string | null;
  /** Mention affichée AU SIGNATAIRE, et dont la version est scellée. */
  mention: string;
  signerAction: (input: {
    token: string;
    methode: "trace" | "confirmation_accessible";
    imageDataUrl?: string;
  }) => Promise<
    { ok: true; signatureId: string; statutSignature: string } | { ok: false; message: string }
  >;
}

export function DevisSignatureForm({
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
  pdfUrl,
  mention,
  signerAction,
}: DevisSignatureFormProps): React.ReactElement {
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
        <h1 className="text-xl font-semibold text-gray-900">Votre accord est enregistré</h1>
        <p className="mt-3 text-sm text-gray-700">
          {`Merci. Votre « bon pour accord » sur le devis ${numero} a bien été enregistré, horodaté et
          rattaché au document que vous venez de lire.`}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          {`${organismeNom} vous adressera l'exemplaire contresigné. Vous pouvez fermer cette page.`}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-gray-900">{`Devis ${numero}`}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {`Émis par ${organismeNom} à l'attention de ${clientRaisonSociale}. Valable jusqu'au ${dateValiditeLisible}.`}
      </p>

      {/* ── Ce qui est signé, sous les yeux du signataire ── */}
      <section className="mt-8" aria-labelledby="recap-titre">
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
                  <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{l.quantite}</td>
                  <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">
                    {l.prixUnitaireHtLisible}
                  </td>
                  <td className="py-2 text-right text-gray-900 tabular-nums">{l.totalHtLisible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Total HT</dt>
            <dd className="font-medium text-gray-900 tabular-nums">{totalHtLisible}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-gray-900">Total TTC</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{totalTtcLisible}</dd>
          </div>
        </dl>
        {mentionTva !== null && <p className="mt-2 text-xs text-gray-600">{mentionTva}</p>}

        {pdfUrl !== null && (
          <p className="mt-4 text-sm">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Ouvrir le devis complet au format PDF
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

        <label className="mt-5 flex items-start gap-3 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={enCours}
            className="mt-1"
          />
          <span>{mention}</span>
        </label>

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
          {enCours ? "Enregistrement…" : "Signer le devis"}
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
