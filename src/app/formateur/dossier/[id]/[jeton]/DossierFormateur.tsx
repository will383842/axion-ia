"use client";
// use-client: parcours en 4 étapes (état local, recherche du SIRET, cases avant l'envoi).

// Le DOSSIER EN LIGNE du formateur indépendant, en 4 étapes : Vous · Votre activité ·
// Vos documents · Votre contrat (maquette `maquette-formateur-dossier.html`). Mobile
// d'abord, champs à 16 px et plus, grosses cibles. Chaque enregistrement passe par une
// action serveur qui revérifie tout ; ce composant ne fait qu'aider (boutons actifs ou
// non, liste de ce qui manque). L'IBAN n'est jamais réaffiché.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DepotPiece, type PieceAffichee } from "@/components/dossier-en-ligne/DepotPiece";
import { ibanValide } from "@/lib/iban";
import { checkSiretFormat, normalizeSiret } from "@/lib/siret";
import {
  DECLARATIONS_FORMATEUR,
  LIBELLE_PIECE,
  PIECES_FACULTATIVES,
  adresseProValide,
  codePostalValide,
  manquesEtape3,
  ndaEnCours,
  normaliserAdressePro,
  type PieceDossier,
  type RegimeTvaDossier,
} from "@/server/qualiopi/formateurs-independants/dossier-regles";

import {
  demanderCodeContratAction,
  deposerPieceAction,
  enregistrerActiviteAction,
  enregistrerCodeUrssafAction,
  enregistrerVousAction,
  envoyerDossierAction,
  rechercherSiretAction,
  signalerSituationAction,
  signerEtEnvoyerDossierAction,
  type ResultatRecherche,
} from "./actions";
import { ADRESSE_CONTACT, ETAPES, LIEN_POLITIQUE, TEXTES } from "./textes";
import type { TextesContrat } from "./textes-contrat";

export interface DossierPublic {
  id: string;
  jeton: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  codePostalPro: string | null;
  siret: string | null;
  /** Le SIRET vient de la fiche (déjà enregistré), pas d'une suggestion. */
  siretEnregistre: boolean;
  /** V1-A-11 — l'adresse professionnelle déjà portée par la fiche. */
  adressePro: string | null;
  nda: string | null;
  regimeTva: RegimeTvaDossier | null;
  ibanSaisi: boolean;
  ibanFige: boolean;
  /** V2-S-1 — formateur actif : un nouvel IBAN devient une demande de changement. */
  ibanParDemande?: boolean;
  codeUrssafSaisi: boolean;
  pieces: ReadonlyArray<PieceAffichee & { type: PieceDossier }>;
  piecesDemandees: ReadonlyArray<PieceDossier>;
}

const champ =
  "border-border-strong bg-paper focus:border-terracotta focus:outline-terracotta mt-1 block min-h-[52px] w-full rounded-xl border px-3.5 text-[17px] focus:outline-2 focus:outline-offset-1";
const etiquette = "text-fg-soft block text-[15px] font-semibold";
const boutonPrincipal =
  "bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-6 text-[18px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid disabled:bg-sand-deep disabled:text-fg-soft disabled:cursor-not-allowed";
const boutonSecondaire =
  "border-border-strong text-fg hover:bg-sand inline-flex min-h-[48px] items-center justify-center rounded-2xl border px-5 text-[16px] font-semibold";
const carte = "bg-paper shadow-card rounded-2xl p-4 sm:p-5";
const lienTexte = "text-terracotta-deep font-semibold underline underline-offset-4";

function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="bg-terracotta-soft text-error mt-4 rounded-xl p-3 text-[16px] font-semibold"
    >
      {message}
    </p>
  );
}

function IlManque({ manques }: { manques: ReadonlyArray<string> }) {
  if (manques.length === 0) return null;
  return (
    <p className="text-fg-soft mt-3 text-[15px]">
      {TEXTES.ilManque} {manques.join(" · ")}.
    </p>
  );
}

function Progression({ etape }: { etape: number }) {
  return (
    <div className="mb-5">
      <ol className="flex gap-1.5" aria-label="Progression">
        {ETAPES.map((nom, i) => {
          const n = i + 1;
          const cls = n < etape ? "bg-sage" : n === etape ? "bg-terracotta" : "bg-sand-deep";
          return (
            <li
              key={nom}
              className={`h-2 flex-1 rounded-full ${cls}`}
              aria-current={n === etape ? "step" : undefined}
            >
              <span className="sr-only">
                {n}. {nom}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-fg-soft mt-2 text-[15px]">
        {TEXTES.etapeNsur4(etape)} ·{" "}
        <span className="text-fg font-semibold">{ETAPES[etape - 1]}</span>
      </p>
      {etape === 1 ? <p className="text-fg-soft mt-1 text-[14px]">{TEXTES.duree}</p> : null}
    </div>
  );
}

type Envoi = (fd: FormData) => Promise<{ ok: true } | { ok: false; message: string }>;

/** L'étape 4 : sans contrat (comportement d'avant), ou contrat à signer ici (lot B). */
export type ContratEtape4 =
  | { mode: "sans_contrat" }
  | { mode: "a_signer"; signe: boolean; pdfUrl: string | null; textes: TextesContrat };

export function DossierFormateur({
  dossier,
  etapeInitiale,
  contrat = { mode: "sans_contrat" },
}: {
  dossier: DossierPublic;
  etapeInitiale: 1 | 2 | 3 | 4;
  contrat?: ContratEtape4;
}) {
  const router = useRouter();
  const [etape, setEtape] = useState<1 | 2 | 3 | 4>(etapeInitiale);
  const [fini, setFini] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Étape 1
  const [telephone, setTelephone] = useState(dossier.telephone ?? "");
  const [codePostal, setCodePostal] = useState(dossier.codePostalPro ?? "");
  // Étape 2
  const [siret, setSiret] = useState(dossier.siret ?? "");
  const [recherche, setRecherche] = useState<ResultatRecherche | null>(null);
  const [adressePro, setAdressePro] = useState(dossier.adressePro ?? "");
  const [nda, setNda] = useState(dossier.nda && !ndaEnCours(dossier.nda) ? dossier.nda : "");
  const [sansNda, setSansNda] = useState(ndaEnCours(dossier.nda));
  const [tva, setTva] = useState<RegimeTvaDossier | null>(dossier.regimeTva);
  const [iban, setIban] = useState("");
  const [situation, setSituation] = useState<string | null>(null);
  // Étape 3
  const [code, setCode] = useState("");
  // Étape 4
  const [certifie, setCertifie] = useState(false);
  const [accepte, setAccepte] = useState(false);
  const [codeContrat, setCodeContrat] = useState("");
  const [adresseCode, setAdresseCode] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState(contrat.mode === "a_signer" ? contrat.pdfUrl : null);
  const [signe, setSigne] = useState(false);

  function envoyer(action: Envoi, fd: FormData, suite: () => void) {
    setErreur(null);
    fd.set("id", dossier.id);
    fd.set("jeton", dossier.jeton);
    demarrer(async () => {
      try {
        const r = await action(fd);
        if (!r.ok) {
          setErreur(r.message);
          return;
        }
        suite();
      } catch {
        setErreur(TEXTES.connexionPerdue);
      }
    });
  }

  if (fini) {
    return (
      <section aria-labelledby="fin-titre" className={`${carte} text-center`}>
        <span className="bg-sage mx-auto grid h-16 w-16 place-items-center rounded-full text-[30px] text-white">
          ✓
        </span>
        <h1 id="fin-titre" className="mt-4 font-serif text-[30px] leading-tight font-medium">
          {signe && contrat.mode === "a_signer"
            ? contrat.textes.merciSigneTitre
            : TEXTES.merciTitre}
        </h1>
        <p className="text-fg-soft mt-3 text-[18px]">
          {signe && contrat.mode === "a_signer"
            ? contrat.textes.merciSigneLigne
            : TEXTES.merciLigne}
        </p>
        <p className="bg-sand mt-4 inline-block rounded-full px-4 py-1.5 text-[15px] font-semibold">
          {TEXTES.merciEtat}
        </p>
        <p className="text-fg-soft mt-4 text-[15px]">{TEXTES.fermer}</p>
      </section>
    );
  }

  // ── Étape 1 · Vous ──
  if (etape === 1) {
    const manques = codePostalValide(codePostal) ? [] : ["votre code postal"];
    return (
      <section aria-labelledby="etape-titre">
        <Progression etape={1} />
        <h1 id="etape-titre" className="font-serif text-[28px] font-medium">
          {ETAPES[0]}
        </h1>
        <div className={`${carte} mt-4 grid gap-4`}>
          <div>
            <span className={etiquette}>{TEXTES.prenomNom}</span>
            <p className="mt-1 text-[17px] font-semibold">
              {dossier.prenom} {dossier.nom}
            </p>
          </div>
          <div>
            <span className={etiquette}>
              {TEXTES.email} · {TEXTES.lectureSeule}
            </span>
            <p className="mt-1 text-[17px]">{dossier.email}</p>
            <a href={`mailto:${ADRESSE_CONTACT}`} className={`${lienTexte} text-[14px]`}>
              {TEXTES.uneErreur}
            </a>
          </div>
          <label className="block">
            <span className={etiquette}>{TEXTES.telephone}</span>
            <input
              className={champ}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={etiquette}>{TEXTES.codePostal}</span>
            <input
              className={champ}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
            />
          </label>
          <p className="text-fg-soft text-[14px]">{TEXTES.prerempli}</p>
        </div>
        <p className="text-fg-soft mt-4 text-[14px]">
          {TEXTES.mentionDonnees}{" "}
          <a href={LIEN_POLITIQUE} className={lienTexte}>
            {TEXTES.mentionLien}
          </a>
        </p>
        <Erreur message={erreur} />
        <button
          type="button"
          className={`${boutonPrincipal} mt-5`}
          disabled={enCours || manques.length > 0}
          onClick={() => {
            const fd = new FormData();
            fd.set("telephone", telephone);
            fd.set("codePostal", codePostal);
            envoyer(enregistrerVousAction, fd, () => {
              setEtape(2);
              router.refresh();
            });
          }}
        >
          {enCours ? TEXTES.enregistrement : TEXTES.continuer}
        </button>
        <IlManque manques={manques} />
      </section>
    );
  }

  // ── Étape 2 · Votre activité ──
  if (etape === 2) {
    const siretNet = normalizeSiret(siret);
    const siretOk = checkSiretFormat(siretNet).ok;
    // Un SIRET déjà enregistré a passé le registre ; un nouveau doit être recherché.
    const continuer =
      recherche?.ok === true
        ? recherche.continuer
        : dossier.siretEnregistre && siretNet === dossier.siret;
    const ndaOk = sansNda || /^\d{11}$/.test(nda.replace(/[\s.-]/g, ""));
    const ibanOk = iban ? ibanValide(iban.replace(/\s+/g, "").toUpperCase()) : dossier.ibanSaisi;
    // V1-A-11 — le registre ne donne pas l'adresse (diffusion partielle) : elle est
    // demandée ici, pour le contrat. Le serveur la redemande aussi s'il le constate.
    const adresseDemandee =
      (recherche?.ok === true &&
        recherche.continuer &&
        recherche.entreprise !== null &&
        !recherche.entreprise.adresse) ||
      erreur === TEXTES.adresseProManquante;
    const adresseNette = normaliserAdressePro(adressePro);
    const adresseOk = !adresseDemandee || adresseProValide(adresseNette);
    const manques = [
      ...(continuer ? [] : ["votre numéro SIRET, recherché au registre"]),
      ...(adresseOk ? [] : ["votre adresse professionnelle"]),
      ...(ndaOk ? [] : ["votre numéro de déclaration d'activité"]),
      ...(tva ? [] : ["votre régime de TVA"]),
      ...(ibanOk ? [] : ["un IBAN valide"]),
    ];
    const ecran = recherche?.ok === true ? recherche.ecran : null;
    const messageEcran: Record<string, string> = {
      muette: TEXTES.ecranMuette,
      fermee: TEXTES.ecranFermee,
      introuvable: TEXTES.ecranIntrouvable,
      hors_france: TEXTES.ecranHorsFrance,
      statut_non_ouvert: TEXTES.ecranStatutNonOuvert,
      societe_axion: TEXTES.ecranSocieteAxion,
    };
    return (
      <section aria-labelledby="etape-titre">
        <Progression etape={2} />
        <h1 id="etape-titre" className="font-serif text-[28px] font-medium">
          {ETAPES[1]}
        </h1>
        <div className={`${carte} mt-4 grid gap-4`}>
          <div>
            <label className="block">
              <span className={etiquette}>{TEXTES.siret}</span>
              <div className="mt-1 flex gap-2">
                <input
                  className={`${champ} mt-0`}
                  inputMode="numeric"
                  value={siret}
                  onChange={(e) => {
                    setSiret(e.target.value);
                    setRecherche(null);
                  }}
                />
                <button
                  type="button"
                  className={boutonSecondaire}
                  disabled={!siretOk || enCours}
                  onClick={() => {
                    setErreur(null);
                    demarrer(async () => {
                      try {
                        setRecherche(
                          await rechercherSiretAction(dossier.id, dossier.jeton, siretNet),
                        );
                      } catch {
                        setErreur(TEXTES.connexionPerdue);
                      }
                    });
                  }}
                >
                  {enCours ? TEXTES.recherche : TEXTES.rechercher}
                </button>
              </div>
            </label>
            {recherche?.ok === false ? <Erreur message={recherche.message} /> : null}
            {recherche?.ok === true && recherche.entreprise && ecran === "trouvee" ? (
              <div className="bg-sand mt-3 rounded-xl p-3">
                <p className="font-semibold">{recherche.entreprise.denomination}</p>
                <p className="text-fg-soft text-[15px]">{recherche.entreprise.adresse}</p>
                <p className="text-sage-deep mt-1 text-[14px] font-bold">{TEXTES.trouveActive}</p>
              </div>
            ) : null}
            {ecran && ecran !== "trouvee" ? (
              <div className="bg-sand mt-3 rounded-xl p-3 text-[16px]" role="status">
                <p>{messageEcran[ecran]}</p>
                {ecran === "fermee" || ecran === "introuvable" ? (
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      className={boutonSecondaire}
                      onClick={() => {
                        setSiret("");
                        setRecherche(null);
                      }}
                    >
                      {TEXTES.autreNumero}
                    </button>
                    <a
                      href={TEXTES.creerMicroUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={boutonSecondaire}
                    >
                      {TEXTES.creerMicro}
                    </a>
                  </div>
                ) : null}
                {ecran !== "muette" ? (
                  <p className="text-fg-soft mt-2 text-[14px]">{TEXTES.dossierGarde}</p>
                ) : null}
              </div>
            ) : null}
            <details className="mt-3">
              <summary className={`${lienTexte} cursor-pointer text-[15px]`}>
                {TEXTES.sansSiret}
              </summary>
              <div className="mt-2 grid gap-2">
                {(
                  [
                    [
                      "portage_ou_cooperative",
                      TEXTES.situationPortage,
                      TEXTES.ecranStatutNonOuvert,
                    ],
                    ["hors_france", TEXTES.situationEtranger, TEXTES.ecranHorsFrance],
                    ["sans_entreprise", TEXTES.situationSansEntreprise, TEXTES.ecranIntrouvable],
                  ] as const
                ).map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    className={boutonSecondaire}
                    disabled={enCours}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("situation", cle);
                      envoyer(signalerSituationAction, fd, () => setSituation(cle));
                    }}
                  >
                    {libelle}
                  </button>
                ))}
                {situation ? (
                  <div className="bg-sand rounded-xl p-3 text-[16px]" role="status">
                    <p>
                      {situation === "portage_ou_cooperative"
                        ? TEXTES.ecranStatutNonOuvert
                        : situation === "hors_france"
                          ? TEXTES.ecranHorsFrance
                          : TEXTES.ecranSansEntreprise}
                    </p>
                    {situation === "sans_entreprise" ? (
                      <a
                        href={TEXTES.creerMicroUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${boutonSecondaire} mt-2`}
                      >
                        {TEXTES.creerMicro}
                      </a>
                    ) : null}
                    <p className="text-fg-soft mt-2 text-[14px]">{TEXTES.dossierGarde}</p>
                  </div>
                ) : null}
              </div>
            </details>
          </div>

          {adresseDemandee ? (
            <div>
              <label className="block">
                <span className={etiquette}>{TEXTES.adressePro}</span>
                <textarea
                  className={`${champ} py-3`}
                  rows={2}
                  maxLength={300}
                  autoComplete="street-address"
                  value={adressePro}
                  onChange={(e) => setAdressePro(e.target.value)}
                />
              </label>
              <p className="text-fg-soft mt-1 text-[14px]">{TEXTES.adresseProAide}</p>
            </div>
          ) : null}

          <div>
            <label className="block">
              <span className={etiquette}>{TEXTES.nda}</span>
              <input
                className={champ}
                inputMode="numeric"
                value={nda}
                disabled={sansNda}
                onChange={(e) => setNda(e.target.value)}
              />
            </label>
            <p className="text-fg-soft mt-1 text-[14px]">{TEXTES.ndaAide}</p>
            <label className="mt-2 flex min-h-[44px] items-center gap-3 text-[16px]">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={sansNda}
                onChange={(e) => setSansNda(e.target.checked)}
              />
              {TEXTES.ndaEnCours}
            </label>
            {sansNda ? <p className="text-fg-soft text-[14px]">{TEXTES.ndaEnCoursAide}</p> : null}
          </div>

          <fieldset>
            <legend className={etiquette}>{TEXTES.tva}</legend>
            <div className="mt-1 grid gap-2">
              {(
                [
                  ["franchise_293b", TEXTES.tvaFranchise],
                  ["exonere_formation", TEXTES.tvaExonere],
                  ["assujetti_20", TEXTES.tvaAssujetti],
                ] as const
              ).map(([valeur, libelle]) => (
                <label
                  key={valeur}
                  className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-3.5 text-[16px] ${
                    tva === valeur ? "border-terracotta bg-terracotta-soft" : "border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="regimeTva"
                    className="h-5 w-5"
                    checked={tva === valeur}
                    onChange={() => setTva(valeur)}
                  />
                  {libelle}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className={etiquette}>{TEXTES.iban}</span>
            {dossier.ibanFige ? (
              <p className="text-fg-soft mt-1 text-[15px]">{TEXTES.ibanFige}</p>
            ) : (
              <>
                <input
                  className={champ}
                  autoComplete="off"
                  spellCheck={false}
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                />
                {dossier.ibanSaisi ? (
                  <p className="text-fg-soft mt-1 text-[14px]">
                    {dossier.ibanParDemande ? TEXTES.ibanParDemande : TEXTES.ibanEnregistre}
                  </p>
                ) : null}
              </>
            )}
          </label>
        </div>
        <Erreur message={erreur} />
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" className={boutonSecondaire} onClick={() => setEtape(1)}>
            {TEXTES.retour}
          </button>
          <button
            type="button"
            className={boutonPrincipal}
            disabled={enCours || manques.length > 0}
            onClick={() => {
              const fd = new FormData();
              fd.set("siret", siretNet);
              fd.set("nda", nda);
              if (sansNda) fd.set("ndaEnCours", "1");
              fd.set("regimeTva", tva ?? "");
              if (adresseDemandee) fd.set("adressePro", adresseNette);
              if (!dossier.ibanFige) fd.set("iban", iban);
              envoyer(enregistrerActiviteAction, fd, () => {
                setIban("");
                setEtape(3);
                router.refresh();
              });
            }}
          >
            {enCours ? TEXTES.enregistrement : TEXTES.continuer}
          </button>
        </div>
        <IlManque manques={manques} />
      </section>
    );
  }

  // ── Étape 3 · Vos documents ──
  if (etape === 3) {
    const deposees = dossier.pieces
      .filter((p) => p.statut !== "a_retransmettre")
      .map((p) => p.type);
    const manques = manquesEtape3({
      nda: dossier.nda,
      piecesDeposees: deposees,
      codeUrssafSaisi: dossier.codeUrssafSaisi,
    });
    const attestation = dossier.pieces.find((p) => p.type === "attestation_vigilance_urssaf");
    return (
      <section aria-labelledby="etape-titre">
        <Progression etape={3} />
        <h1 id="etape-titre" className="font-serif text-[28px] font-medium">
          {ETAPES[2]}
        </h1>
        <ul className="mt-4 grid gap-3">
          {dossier.piecesDemandees.map((type) => {
            const p = dossier.pieces.find((x) => x.type === type) ?? null;
            return (
              <DepotPiece
                key={type}
                action={deposerPieceAction}
                textes={TEXTES.depot}
                id={dossier.id}
                jeton={dossier.jeton}
                type={type}
                libelle={LIBELLE_PIECE[type]}
                aide={TEXTES.aidePiece[type]}
                facultatif={PIECES_FACULTATIVES.has(type)}
                piece={p ? { statut: p.statut, motif: p.motif, nomFichier: p.nomFichier } : null}
                motifLibelle={p?.statut === "a_retransmettre" ? p.motif : null}
                avecDate={type === "attestation_vigilance_urssaf"}
              />
            );
          })}
        </ul>
        {attestation && attestation.statut !== "a_retransmettre" ? (
          <div className={`${carte} mt-3`}>
            {dossier.codeUrssafSaisi ? (
              <p className="text-sage-deep font-semibold">{TEXTES.codeEnregistre}</p>
            ) : (
              <>
                <label className="block">
                  <span className={etiquette}>{TEXTES.codeUrssaf}</span>
                  <input
                    className={champ}
                    autoComplete="off"
                    spellCheck={false}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <p className="text-fg-soft mt-1 text-[14px]">{TEXTES.codeUrssafAide}</p>
                <button
                  type="button"
                  className={`${boutonSecondaire} mt-2`}
                  disabled={enCours || code.trim().length < 6}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("code", code);
                    envoyer(enregistrerCodeUrssafAction, fd, () => router.refresh());
                  }}
                >
                  {TEXTES.enregistrerCode}
                </button>
              </>
            )}
          </div>
        ) : null}
        <Erreur message={erreur} />
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" className={boutonSecondaire} onClick={() => setEtape(2)}>
            {TEXTES.retour}
          </button>
          <button
            type="button"
            className={boutonPrincipal}
            disabled={manques.length > 0}
            onClick={() => setEtape(4)}
          >
            {TEXTES.continuer}
          </button>
        </div>
        <IlManque manques={manques} />
      </section>
    );
  }

  // ── Étape 4 · Votre contrat, signé ici (lot B : `contrat_auto` et version arrêtée) ──
  if (contrat.mode === "a_signer") {
    const dejaSigne = contrat.signe;
    const T = contrat.textes;
    const codeValide = /^\d{6}$/.test(codeContrat.replace(/\s+/g, ""));
    return (
      <section aria-labelledby="etape-titre">
        <Progression etape={4} />
        <h1 id="etape-titre" className="font-serif text-[28px] font-medium">
          {ETAPES[3]}
        </h1>
        <div className={`${carte} mt-4`}>
          <h2 className="text-[18px] font-semibold">{T.contratRempli}</h2>
          <ul className="text-fg-soft mt-2 list-disc pl-5 text-[16px]">
            {T.contratResume.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {pdfUrl ? (
            <a
              className={`${lienTexte} mt-3 inline-block`}
              href={pdfUrl}
              target="_blank"
              rel="noopener"
            >
              {T.lireContrat}
            </a>
          ) : (
            <p className="text-fg-soft mt-3 text-[15px]">{T.contratApresCode}</p>
          )}
        </div>
        {dejaSigne ? (
          <p className={`${carte} text-sage-deep mt-3 font-semibold`}>{T.contratDejaSigne}</p>
        ) : null}
        <div className={`${carte} mt-3 grid gap-3`}>
          <label className="flex items-start gap-3 text-[16px]">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={certifie}
              onChange={(e) => setCertifie(e.target.checked)}
            />
            <span>
              <span className="font-semibold">{TEXTES.jeCertifie}</span>
              <ul className="text-fg-soft mt-1 list-disc pl-5 text-[15px]">
                {DECLARATIONS_FORMATEUR.map((d) => (
                  <li key={d.cle}>{d.texte}</li>
                ))}
              </ul>
            </span>
          </label>
          <label className="flex items-start gap-3 text-[16px]">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={accepte}
              onChange={(e) => setAccepte(e.target.checked)}
            />
            <span>
              <span className="font-semibold">{T.jaiLu}</span>
              <ul className="text-fg-soft mt-1 list-disc pl-5 text-[15px]">
                {T.jaiLuPoints.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </span>
          </label>
          <p className="text-fg-soft text-[15px]">
            {T.signeEnTantQue} {dossier.prenom} {dossier.nom}.
          </p>
        </div>
        {!dejaSigne ? (
          <div className={`${carte} mt-3`}>
            {adresseCode ? (
              <p role="status" className="text-[16px]">
                {T.codeEnvoyeAvant} {adresseCode}. {T.codeEnvoyeApres}
              </p>
            ) : null}
            <button
              type="button"
              className={`${adresseCode ? boutonSecondaire : boutonPrincipal} mt-2`}
              disabled={enCours}
              onClick={() => {
                setErreur(null);
                const fd = new FormData();
                fd.set("id", dossier.id);
                fd.set("jeton", dossier.jeton);
                demarrer(async () => {
                  try {
                    const r = await demanderCodeContratAction(fd);
                    if (!r.ok) {
                      setErreur(r.message);
                      return;
                    }
                    setAdresseCode(r.adresse);
                    if (r.pdfUrl) setPdfUrl(r.pdfUrl);
                  } catch {
                    setErreur(TEXTES.connexionPerdue);
                  }
                });
              }}
            >
              {adresseCode ? T.codeNonRecu : T.recevoirCode}
            </button>
            {adresseCode ? (
              <label className="mt-3 block">
                <span className={etiquette}>{T.codeSignature}</span>
                <input
                  className={champ}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={codeContrat}
                  onChange={(e) => setCodeContrat(e.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <Erreur message={erreur} />
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" className={boutonSecondaire} onClick={() => setEtape(3)}>
            {TEXTES.retour}
          </button>
          <button
            type="button"
            className={boutonPrincipal}
            disabled={enCours || !certifie || !accepte || (!dejaSigne && !codeValide)}
            onClick={() => {
              const fd = new FormData();
              fd.set("certifie", "1");
              fd.set("accepte", "1");
              // Contrat déjà signé : le code n'est plus relu, l'envoi reprend.
              fd.set("code", dejaSigne ? "000000" : codeContrat);
              envoyer(signerEtEnvoyerDossierAction, fd, () => {
                setSigne(true);
                setFini(true);
              });
            }}
          >
            {enCours ? T.signature : dejaSigne ? TEXTES.envoyer : T.signer}
          </button>
        </div>
      </section>
    );
  }

  // ── Étape 4 · Votre contrat ──
  // Sans contrat à signer ici (interrupteur coupé ou aucune version arrêtée) : le dossier
  // part sans signature.
  return (
    <section aria-labelledby="etape-titre">
      <Progression etape={4} />
      <h1 id="etape-titre" className="font-serif text-[28px] font-medium">
        {ETAPES[3]}
      </h1>
      <p className={`${carte} mt-4 text-[17px]`}>{TEXTES.contratBientot}</p>
      <div className={`${carte} mt-3`}>
        <label className="flex items-start gap-3 text-[16px]">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={certifie}
            onChange={(e) => setCertifie(e.target.checked)}
          />
          <span>
            <span className="font-semibold">{TEXTES.jeCertifie}</span>
            <ul className="text-fg-soft mt-1 list-disc pl-5 text-[15px]">
              {DECLARATIONS_FORMATEUR.map((d) => (
                <li key={d.cle}>{d.texte}</li>
              ))}
            </ul>
          </span>
        </label>
      </div>
      <Erreur message={erreur} />
      <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
        <button type="button" className={boutonSecondaire} onClick={() => setEtape(3)}>
          {TEXTES.retour}
        </button>
        <button
          type="button"
          className={boutonPrincipal}
          disabled={enCours || !certifie}
          onClick={() => {
            const fd = new FormData();
            fd.set("certifie", "1");
            envoyer(envoyerDossierAction, fd, () => setFini(true));
          }}
        >
          {enCours ? TEXTES.envoi : TEXTES.envoyer}
        </button>
      </div>
    </section>
  );
}
