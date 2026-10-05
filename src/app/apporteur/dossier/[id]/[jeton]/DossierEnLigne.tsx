"use client";
// use-client: parcours en 4 étapes (état local, recherche SIREN, cases et nom tapé avant signature).

// Le DOSSIER EN LIGNE de l'apporteur, en 4 étapes : Vous · Votre activité · Vos
// documents · Votre contrat. Mobile d'abord (320-414 px), champs à 16 px et plus,
// grosses cibles. Chaque enregistrement passe par une action serveur qui revérifie
// tout ; ce composant ne fait qu'aider (boutons actifs ou non, listes de ce qui manque).

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ACCEPTATIONS,
  AIDE_PIECE,
  DECLARATIONS,
  LIBELLE_PIECE,
  PIECES_FACULTATIVES,
  PIECES_POUR_SIGNER,
  STATUTS_JURIDIQUES,
  ibanValide,
  sirenValide,
  type TypePiece,
} from "@/features/apporteurs-reseau/regles";
import {
  casesCompletes,
  libelleMotif,
  manquesDuDossier,
  nomTapeCorrespond,
} from "@/features/apporteurs-reseau/signature-regles";

import {
  enregistrerActiviteAction,
  rechercherSirenAction,
  signerAction,
  type ResultatRecherche,
} from "./actions";
import { COCHE, icone } from "./Coquille";
import { DepotPiece, type PieceAffichee } from "./DepotPiece";
import { ADRESSE_CONTACT, ETAPES, TEXTES } from "./textes";

export interface DossierPublic {
  id: string;
  jeton: string;
  statut: "dossier_en_cours" | "a_completer";
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  siren: string | null;
  denomination: string | null;
  adresse: string | null;
  statutJuridique: string | null;
  regimeTva: "franchise_293b" | "assujetti" | null;
  numeroTva: string | null;
  ibanMasque: string | null;
  ibanSaisi: boolean;
  dernierMessage: string | null;
  pieces: Array<PieceAffichee & { type: TypePiece }>;
}

// ── Styles partagés ──────────────────────────────────────────────────────

const champ =
  "border-border-strong bg-paper focus:border-terracotta focus:outline-terracotta mt-1 block min-h-[52px] w-full rounded-xl border px-3.5 text-[17px] focus:outline-2 focus:outline-offset-1";
const etiquette = "text-fg-soft block text-[15px] font-semibold";
const boutonPrincipal =
  "bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-6 text-[18px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid disabled:bg-sand-deep disabled:text-fg-soft disabled:cursor-not-allowed";
const boutonSecondaire =
  "border-border-strong text-fg hover:bg-sand inline-flex min-h-[56px] items-center justify-center rounded-2xl border px-5 text-[17px] font-semibold";
const carte = "bg-paper shadow-card rounded-2xl p-4 sm:p-5";

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
    </div>
  );
}

// ── Le parcours ──────────────────────────────────────────────────────────

export function DossierEnLigne({
  dossier,
  etapeInitiale,
  contrat,
  urlPdf,
}: {
  dossier: DossierPublic;
  etapeInitiale: 1 | 2 | 3 | 4;
  /** Le contrat rempli, déjà rendu en HTML par le serveur. */
  contrat: React.ReactNode;
  urlPdf: string;
}) {
  const router = useRouter();
  const uid = useId();
  const haut = useRef<HTMLDivElement>(null);
  const [etape, setEtape] = useState<number>(etapeInitiale);
  const [signe, setSigne] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  // Étape 1 (le nom n'est modifiable que s'il manque : nom d'un seul mot)
  const [nomSaisi, setNomSaisi] = useState("");
  const [telephone, setTelephone] = useState(dossier.telephone ?? "");
  // Étape 2
  const [siren, setSiren] = useState(dossier.siren ?? "");
  const [recherche, setRecherche] = useState<ResultatRecherche | null>(null);
  const [denomination, setDenomination] = useState(dossier.denomination ?? "");
  const [adresse, setAdresse] = useState(dossier.adresse ?? "");
  const [statut, setStatut] = useState(dossier.statutJuridique ?? "");
  const [tva, setTva] = useState<"" | "franchise_293b" | "assujetti">(dossier.regimeTva ?? "");
  const [numeroTva, setNumeroTva] = useState(dossier.numeroTva ?? "");
  const [iban, setIban] = useState("");
  // Étape 4
  const [declarations, setDeclarations] = useState<string[]>([]);
  const [acceptations, setAcceptations] = useState<string[]>([]);
  const [nomTape, setNomTape] = useState("");

  // Changement d'étape : on remonte en haut du parcours (pas au premier affichage).
  const premierAffichage = useRef(true);
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false;
      return;
    }
    haut.current?.scrollIntoView({ block: "start" });
    // Le focus suit l'étape (clavier, lecteur d'écran) ; l'annonce est dans la zone `status`.
    haut.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [etape, signe]);

  function aller(n: number) {
    setErreur(null);
    setEtape(n);
  }

  // ── Étape 2 : règles d'affichage ──
  const sirenNet = siren.replace(/\s+/g, "");
  const sirenDejaEnregistre = !!dossier.siren && sirenNet === dossier.siren;
  const trouve = recherche?.ok && recherche.entreprise.siren === sirenNet ? recherche : null;
  const echec = recherche && !recherche.ok ? recherche : null;
  const refus = trouve?.refus ?? null;
  const saisieManuelle =
    (trouve && trouve.entreprise.diffusionPartielle) ||
    (echec && (echec.raison === "introuvable" || echec.raison === "indisponible")) ||
    (sirenDejaEnregistre && !trouve && !echec);
  const ibanNet = iban.replace(/\s+/g, "");
  const activiteComplete =
    sirenValide(sirenNet) &&
    (!!trouve || sirenDejaEnregistre || !!saisieManuelle) &&
    !refus &&
    denomination.trim() !== "" &&
    adresse.trim() !== "" &&
    statut !== "" &&
    tva !== "" &&
    (tva !== "assujetti" || numeroTva.trim() !== "") &&
    (ibanNet ? ibanValide(ibanNet) : dossier.ibanSaisi);

  function rechercher() {
    setErreur(null);
    demarrer(async () => {
      try {
        const r = await rechercherSirenAction(dossier.id, dossier.jeton, sirenNet);
        setRecherche(r);
        if (r.ok) {
          if (r.entreprise.denomination) setDenomination(r.entreprise.denomination);
          if (r.entreprise.adresse) setAdresse(r.entreprise.adresse);
          if (r.entreprise.statutSuggere) setStatut(r.entreprise.statutSuggere);
        }
      } catch {
        // Coupure réseau : rien n'est vidé, l'apporteur réessaie sur place.
        setErreur(TEXTES.connexionPerdue);
      }
    });
  }

  function enregistrerActivite() {
    setErreur(null);
    const fd = new FormData();
    fd.set("id", dossier.id);
    fd.set("jeton", dossier.jeton);
    fd.set("telephone", telephone);
    if (nomSaisi.trim()) fd.set("nom", nomSaisi.trim());
    fd.set("siren", sirenNet);
    fd.set("denomination", denomination);
    fd.set("adresse", adresse);
    fd.set("statutJuridique", statut);
    fd.set("regimeTva", tva);
    fd.set("numeroTva", numeroTva);
    fd.set("iban", ibanNet);
    demarrer(async () => {
      try {
        const r = await enregistrerActiviteAction(fd);
        if (!r.ok) return setErreur(r.message);
        setIban("");
        router.refresh();
        setEtape(3);
      } catch {
        setErreur(TEXTES.connexionPerdue);
      }
    });
  }

  // ── Étapes 3 et 4 : ce qui manque, lu dans les données du serveur ──
  const manques = manquesDuDossier(dossier);
  const pieceDe = (t: TypePiece) => dossier.pieces.find((p) => p.type === t) ?? null;
  const aRenvoyer = dossier.pieces.filter((p) => p.statut === "a_retransmettre");
  const attendu = `${dossier.prenom} ${dossier.nom}`.trim();
  const peutSigner =
    manques.length === 0 &&
    casesCompletes(declarations, acceptations) &&
    nomTapeCorrespond(nomTape, dossier.prenom, dossier.nom);

  function signer() {
    setErreur(null);
    const fd = new FormData();
    fd.set("id", dossier.id);
    fd.set("jeton", dossier.jeton);
    fd.set("nomTape", nomTape);
    declarations.forEach((c) => fd.append("declarations", c));
    acceptations.forEach((c) => fd.append("acceptations", c));
    demarrer(async () => {
      try {
        const r = await signerAction(fd);
        if (r.ok) setSigne(true);
        else setErreur(r.message);
      } catch {
        // Cases cochées et nom tapé restent à l'écran.
        setErreur(TEXTES.connexionPerdue);
      }
    });
  }

  const basculer = (liste: string[], set: (v: string[]) => void, cle: string) =>
    set(liste.includes(cle) ? liste.filter((c) => c !== cle) : [...liste, cle]);

  if (signe) {
    return (
      <div ref={haut}>
        <section
          aria-labelledby="fin-titre"
          className="bg-paper bg-halo-warm shadow-card rounded-3xl p-6 text-center sm:p-8"
        >
          <span className="bg-sage mx-auto grid h-16 w-16 place-items-center rounded-full text-white">
            {icone(COCHE, "h-8 w-8")}
          </span>
          <h1
            id="fin-titre"
            className="mt-5 font-serif text-[32px] leading-tight font-medium tracking-tight"
          >
            {TEXTES.merciTitre}
          </h1>
          <p className="text-fg-soft mt-3 text-[18px] leading-relaxed">{TEXTES.merciLigne}</p>
          <p className="text-fg-soft mt-5 text-[16px]">{TEXTES.fermer}</p>
        </section>
      </div>
    );
  }

  return (
    <div ref={haut} className="scroll-mt-4">
      <p role="status" aria-live="polite" className="sr-only">
        {TEXTES.etapeAnnonce(etape, ETAPES[etape - 1] ?? "")}
      </p>
      {dossier.statut === "a_completer" ? (
        <section
          aria-labelledby="a-completer"
          className="border-terracotta bg-terracotta-soft mb-5 rounded-2xl border-l-4 p-4"
        >
          <h2 id="a-completer" className="text-terracotta-deep text-[18px] font-bold">
            {TEXTES.aCompleterTitre}
          </h2>
          {dossier.dernierMessage ? (
            <p className="text-fg mt-1 text-[16px] leading-relaxed whitespace-pre-line">
              {dossier.dernierMessage}
            </p>
          ) : null}
          {aRenvoyer.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-[16px]">
              {aRenvoyer.map((p) => (
                <li key={p.type}>
                  · <strong>{LIBELLE_PIECE[p.type]}</strong> : {libelleMotif(p.motif)}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-fg-soft mt-2 text-[15px]">{TEXTES.aCompleterLigne}</p>
        </section>
      ) : null}

      <Progression etape={etape} />

      {etape === 1 ? (
        <section aria-labelledby={`${uid}-t1`} className={carte}>
          <h1
            id={`${uid}-t1`}
            tabIndex={-1}
            className="font-serif text-[26px] font-medium outline-none"
          >
            {ETAPES[0]}
          </h1>
          <p className="text-fg-soft mt-1 text-[15px]">{TEXTES.duree}</p>
          <div className="mt-4 grid gap-3">
            {(
              [
                [TEXTES.prenom, dossier.prenom],
                ...(dossier.nom.trim() !== "" ? ([[TEXTES.nom, dossier.nom]] as const) : []),
                [TEXTES.email, dossier.email],
              ] as const
            ).map(([l, v]) => (
              <div key={l}>
                <span className={etiquette}>{l}</span>
                <p className="bg-sand mt-1 flex min-h-[52px] items-center rounded-xl px-3.5 text-[17px] break-all">
                  {v}
                </p>
              </div>
            ))}
            {dossier.nom.trim() === "" ? (
              <div>
                <label htmlFor={`${uid}-nom1`} className={etiquette}>
                  {TEXTES.nom}
                </label>
                <input
                  id={`${uid}-nom1`}
                  autoComplete="family-name"
                  value={nomSaisi}
                  onChange={(e) => setNomSaisi(e.target.value)}
                  className={champ}
                />
                <p className="text-fg-soft mt-1 text-[14px]">{TEXTES.nomManquant}</p>
              </div>
            ) : null}
            <p className="text-fg-soft text-[14px]">
              {TEXTES.lectureSeule}{" "}
              <a
                href={`mailto:${ADRESSE_CONTACT}`}
                className="text-terracotta-deep font-semibold underline underline-offset-2"
              >
                {ADRESSE_CONTACT}
              </a>
            </p>
            <div>
              <label htmlFor={`${uid}-tel`} className={etiquette}>
                {TEXTES.telephone}
              </label>
              <input
                id={`${uid}-tel`}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className={champ}
              />
            </div>
          </div>
          <button
            type="button"
            className={`${boutonPrincipal} mt-5`}
            disabled={dossier.nom.trim() === "" && nomSaisi.trim() === ""}
            onClick={() => aller(2)}
          >
            {TEXTES.continuer}
          </button>
        </section>
      ) : null}

      {etape === 2 ? (
        <section aria-labelledby={`${uid}-t2`} className={carte}>
          <h1
            id={`${uid}-t2`}
            tabIndex={-1}
            className="font-serif text-[26px] font-medium outline-none"
          >
            {ETAPES[1]}
          </h1>
          <div className="mt-4">
            <label htmlFor={`${uid}-siren`} className={etiquette}>
              {TEXTES.siren}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`${uid}-siren`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                value={siren}
                onChange={(e) => {
                  setSiren(e.target.value);
                  setRecherche(null);
                }}
                className={`${champ} mt-0 min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={rechercher}
                disabled={enCours || !sirenValide(sirenNet)}
                className="bg-fg disabled:bg-sand-deep disabled:text-fg-soft min-h-[52px] shrink-0 rounded-xl px-4 text-[16px] font-bold text-white"
              >
                {enCours && !trouve ? TEXTES.recherche : TEXTES.rechercher}
              </button>
            </div>
            {sirenNet.length === 9 && !sirenValide(sirenNet) ? (
              <p className="text-error mt-1 text-[15px] font-semibold">{TEXTES.sirenInvalide}</p>
            ) : null}
          </div>

          {trouve && !refus ? (
            <div className="bg-sage-soft text-fg mt-3 rounded-xl p-3 text-[16px]">
              <p className="text-sage font-bold">
                ✓ {TEXTES.trouve} : {trouve.entreprise.denomination ?? "—"}
              </p>
              {trouve.entreprise.adresse ? (
                <p className="mt-0.5">{trouve.entreprise.adresse}</p>
              ) : null}
              <p className="text-fg-soft mt-0.5 text-[15px]">
                {TEXTES.active}
                {trouve.entreprise.naf ? ` · NAF ${trouve.entreprise.naf}` : ""}
              </p>
            </div>
          ) : null}
          {refus ? (
            <p
              role="alert"
              className="bg-terracotta-soft text-error mt-3 rounded-xl p-3 text-[16px] font-semibold"
            >
              {refus}
            </p>
          ) : null}
          {echec ? <p className="text-fg-soft mt-3 text-[16px]">{echec.message}</p> : null}
          {trouve?.entreprise.diffusionPartielle ? (
            <p className="text-fg-soft mt-3 text-[16px]">{TEXTES.diffusionPartielle}</p>
          ) : null}
          {!trouve && !echec && !sirenDejaEnregistre ? (
            <p className="text-fg-soft mt-3 text-[15px]">{TEXTES.rechercherDabord}</p>
          ) : null}

          {!refus && (trouve || saisieManuelle) ? (
            <div className="mt-4 grid gap-4">
              {saisieManuelle ? (
                <>
                  <div>
                    <label htmlFor={`${uid}-denom`} className={etiquette}>
                      {TEXTES.denomination}
                    </label>
                    <input
                      id={`${uid}-denom`}
                      autoComplete="organization"
                      value={denomination}
                      readOnly={!!trouve?.entreprise.denomination}
                      onChange={(e) => setDenomination(e.target.value)}
                      className={champ}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-adr`} className={etiquette}>
                      {TEXTES.adresse}
                    </label>
                    <textarea
                      id={`${uid}-adr`}
                      rows={2}
                      autoComplete="street-address"
                      value={adresse}
                      readOnly={!!trouve?.entreprise.adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      className={`${champ} py-3`}
                    />
                  </div>
                </>
              ) : null}
              <div>
                <label htmlFor={`${uid}-statut`} className={etiquette}>
                  {TEXTES.statut}
                </label>
                <select
                  id={`${uid}-statut`}
                  value={statut}
                  onChange={(e) => setStatut(e.target.value)}
                  className={champ}
                >
                  <option value="">{TEXTES.choisir}</option>
                  {STATUTS_JURIDIQUES.map((s) => (
                    <option key={s.valeur} value={s.valeur}>
                      {s.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className={etiquette}>{TEXTES.tva}</legend>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["franchise_293b", TEXTES.tvaNon],
                      ["assujetti", TEXTES.tvaOui],
                    ] as const
                  ).map(([v, l]) => (
                    <label
                      key={v}
                      className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-[16px] font-semibold ${
                        tva === v
                          ? "border-terracotta bg-terracotta-soft text-terracotta-deep"
                          : "border-border bg-paper"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${uid}-tva`}
                        value={v}
                        checked={tva === v}
                        onChange={() => setTva(v)}
                        className="accent-terracotta h-5 w-5"
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
              {tva === "assujetti" ? (
                <div>
                  <label htmlFor={`${uid}-ntva`} className={etiquette}>
                    {TEXTES.numeroTva}
                  </label>
                  <input
                    id={`${uid}-ntva`}
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="FR…"
                    value={numeroTva}
                    onChange={(e) => setNumeroTva(e.target.value)}
                    className={champ}
                  />
                </div>
              ) : null}
              <div>
                <label htmlFor={`${uid}-iban`} className={etiquette}>
                  {TEXTES.iban}
                </label>
                {dossier.ibanMasque ? (
                  <p className="text-sage mt-1 text-[15px] font-semibold">
                    ✓ {TEXTES.ibanEnregistre(dossier.ibanMasque)}
                  </p>
                ) : null}
                <input
                  id={`${uid}-iban`}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder={dossier.ibanSaisi ? TEXTES.ibanRemplacer : "FR76 …"}
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className={champ}
                />
                {ibanNet.length >= 15 && !ibanValide(ibanNet) ? (
                  <p className="text-error mt-1 text-[15px] font-semibold">{TEXTES.ibanInvalide}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <Erreur message={erreur} />
          <div className="mt-5 flex gap-2">
            <button type="button" className={boutonSecondaire} onClick={() => aller(1)}>
              {TEXTES.retour}
            </button>
            <button
              type="button"
              className={boutonPrincipal}
              disabled={enCours || !activiteComplete}
              onClick={enregistrerActivite}
            >
              {enCours ? TEXTES.enregistrement : TEXTES.continuer}
            </button>
          </div>
        </section>
      ) : null}

      {etape === 3 ? (
        <section aria-labelledby={`${uid}-t3`}>
          <h1
            id={`${uid}-t3`}
            tabIndex={-1}
            className="mb-3 font-serif text-[26px] font-medium outline-none"
          >
            {ETAPES[2]}
          </h1>
          <ul className="grid gap-3">
            {[...PIECES_POUR_SIGNER, ...PIECES_FACULTATIVES].map((t) => {
              const p = pieceDe(t);
              return (
                <DepotPiece
                  key={t}
                  id={dossier.id}
                  jeton={dossier.jeton}
                  type={t}
                  libelle={LIBELLE_PIECE[t]}
                  aide={AIDE_PIECE[t]}
                  facultatif={(PIECES_FACULTATIVES as readonly string[]).includes(t)}
                  piece={p}
                  motifLibelle={p?.statut === "a_retransmettre" ? libelleMotif(p.motif) : null}
                />
              );
            })}
          </ul>
          {manques.length > 0 ? (
            <div className="bg-paper border-border mt-4 rounded-2xl border p-4 text-[16px]">
              <p className="font-semibold">{TEXTES.manque}</p>
              <ul className="text-fg-soft mt-1 grid gap-0.5">
                {manques.map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button type="button" className={boutonSecondaire} onClick={() => aller(2)}>
              {TEXTES.retour}
            </button>
            <button
              type="button"
              className={boutonPrincipal}
              disabled={manques.length > 0}
              onClick={() => aller(4)}
            >
              {TEXTES.continuer}
            </button>
          </div>
        </section>
      ) : null}

      {etape === 4 ? (
        <section aria-labelledby={`${uid}-t4`}>
          <h1
            id={`${uid}-t4`}
            tabIndex={-1}
            className="mb-3 font-serif text-[26px] font-medium outline-none"
          >
            {TEXTES.contratTitre}
          </h1>
          <div
            tabIndex={0}
            role="region"
            aria-label={TEXTES.contratTitre}
            className="bg-paper border-border focus-visible:outline-terracotta max-h-[55vh] overflow-y-auto rounded-2xl border p-4 focus-visible:outline-2"
          >
            {contrat}
          </div>
          <a
            href={urlPdf}
            className="text-terracotta-deep mt-3 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
          >
            ↓ {TEXTES.telecharger}
          </a>

          {(
            [
              [TEXTES.declarationsTitre, DECLARATIONS, declarations, setDeclarations],
              [TEXTES.acceptationsTitre, ACCEPTATIONS, acceptations, setAcceptations],
            ] as const
          ).map(([titre, liste, cochees, set]) => (
            <fieldset key={titre} className={`${carte} mt-4`}>
              <legend className="float-left mb-2 w-full text-[18px] font-bold">{titre}</legend>
              <div className="clear-both grid gap-2">
                {liste.map((c) => (
                  <label
                    key={c.cle}
                    className="hover:bg-sand flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl p-2 text-[16px] leading-snug"
                  >
                    <input
                      type="checkbox"
                      checked={cochees.includes(c.cle)}
                      onChange={() => basculer(cochees, set, c.cle)}
                      className="accent-terracotta mt-0.5 h-6 w-6 shrink-0"
                    />
                    <span>{c.texte}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className={`${carte} mt-4`}>
            <label htmlFor={`${uid}-nom`} className="block text-[18px] font-bold">
              {TEXTES.nomTape}
            </label>
            <p className="text-fg-soft mt-0.5 text-[15px]">{TEXTES.nomTapeAide(attendu)}</p>
            <input
              id={`${uid}-nom`}
              autoComplete="name"
              value={nomTape}
              onChange={(e) => setNomTape(e.target.value)}
              className={champ}
            />
          </div>

          {manques.length > 0 ? (
            <Erreur message={`${TEXTES.manque} ${manques.join(", ")}.`} />
          ) : null}
          <Erreur message={erreur} />
          <div className="mt-5 flex gap-2">
            <button type="button" className={boutonSecondaire} onClick={() => aller(3)}>
              {TEXTES.retour}
            </button>
            <button
              type="button"
              className={boutonPrincipal}
              disabled={enCours || !peutSigner}
              onClick={signer}
            >
              {enCours ? TEXTES.signature : TEXTES.signer}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
