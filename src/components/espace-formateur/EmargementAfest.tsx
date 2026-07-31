"use client";
// use-client: sélection d'un rôle signataire + pavé de signature + Server Action.
/**
 * EmargementAfest — le formateur fait signer une séance AFEST, sur son poste.
 *
 * Première surface d'appel réelle de `signerSeanceAfest`. Jusqu'ici le service
 * existait sans écran : aucun bénéficiaire ne pouvait signer, alors même que le
 * faux positif qui mentait à sa place — quatre booléens posés au clic, rendus
 * « signé » sur le PDF — venait d'être retiré. Le dossier était plus honnête, et
 * plus vide.
 *
 * ## Le geste réel
 *
 * La séance a lieu dans l'entreprise du bénéficiaire, souvent sur un poste de
 * travail. Le formateur ouvre la séance sur son propre appareil, déjà
 * authentifié, fait signer le bénéficiaire puis le tuteur qui passe entre deux
 * tâches, et signe lui-même. L'écran suit donc ce grain : UNE séance, ses TROIS
 * rôles, l'un après l'autre.
 *
 * ## Trois modes, ÉGAUX en valeur probante
 *
 * · `trace` — au doigt ou à la souris ;
 * · `confirmation_accessible` — chemin clavier et lecteur d'écran, sans tracé ;
 * · `papier_scanne` — feuille signée à la main, photographiée.
 *
 * 🔴 Le comptage et la valeur ne dépendent PAS de la modalité. Un dispositif de
 * preuve qui échoue en entreprise ne produit aucune preuve ; une feuille papier
 * signée en produit une. Retirer les modes dégradés serait une régression.
 *
 * ## Ce que cet écran refuse de faire
 *
 * ⚠️ **Jamais « signé » sans dire de quoi c'est fait.** Chaque rôle signé montre
 * son signataire NOMMÉ, son horodatage en heure de Paris, la modalité employée
 * et son empreinte vérifiable.
 *
 * ⚠️ **Jamais un bouton qui refusera à coup sûr.** Une séance à venir, trop
 * ancienne, neutralisée, sans horaires déterminables ou déjà signée le dit AVANT
 * le clic. Un refus après clic se lit comme une panne.
 *
 * ⚠️ **Aucune mention réécrite ici.** Les textes viennent de
 * `mentionCompleteAfest` via `seance-queries.ts`, et sont VERSIONNÉS puis
 * scellés dans l'empreinte. Un texte recopié dans ce composant ferait diverger
 * ce qui est affiché de ce qui est prouvé.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/portail/SignaturePad";

type RoleAfest = "beneficiaire" | "formateur" | "tuteur";
type MethodeAfest = "trace" | "papier_scanne" | "confirmation_accessible";

/** Miroir de `EtatRoleSeance` (`seance-queries.ts`), sérialisé pour le client. */
export interface RoleAffiche {
  role: RoleAfest;
  libelle: string;
  signee: boolean;
  signataireNom: string | null;
  signeAtLisible: string | null;
  empreinte: string | null;
  methodeLisible: string | null;
  recueilliSurPosteFormateur: boolean;
  peutSigner: boolean;
  blocage: string | null;
  signataireAttenduNom: string | null;
  mentions: string[];
}

/** Miroir de `EtatSeanceSignature`. */
export interface SeanceAffichee {
  compteRenduSeanceId: string;
  jourLisible: string;
  horaires: string | null;
  blocageSeance: string | null;
  roles: RoleAffiche[];
}

export interface EmargementAfestProps {
  coachingSessionId: string;
  seances: SeanceAffichee[];
  /** `MENTION_RECUEIL_ATTESTE_PAR_OF`, reprise telle quelle du serveur. */
  plafondProbant: string;
  signerAction: (input: {
    coachingSessionId: string;
    compteRenduSeanceId: string;
    role: RoleAfest;
    methode: MethodeAfest;
    imageDataUrl?: string;
    nomConfirme?: string;
  }) => Promise<{ ok: true; signatureId: string } | { ok: false; raison: string; message: string }>;
}

/**
 * Libellés des modalités.
 *
 * ⚠️ Les VALEURS sont celles de l'énumération serveur, employées telles quelles
 * comme état local. Une table de correspondance « mode d'écran » → « méthode
 * hachée » est exactement l'endroit où l'on scellerait `trace` sur une
 * confirmation accessible, définitivement, sur une table append-only.
 */
const MODALITES: ReadonlyArray<readonly [MethodeAfest, string]> = [
  ["trace", "Signer à l'écran"],
  ["confirmation_accessible", "Confirmer sans tracé (accessibilité)"],
  ["papier_scanne", "Photographier une feuille signée"],
] as const;

/** Ce qui est en cours de signature : une séance ET un rôle, jamais l'un sans l'autre. */
interface Cible {
  seance: SeanceAffichee;
  role: RoleAffiche;
}

export function EmargementAfest({
  coachingSessionId,
  seances,
  plafondProbant,
  signerAction,
}: EmargementAfestProps): React.ReactElement {
  const router = useRouter();
  const [cible, setCible] = useState<Cible | null>(null);
  const [methode, setMethode] = useState<MethodeAfest>("trace");
  const [image, setImage] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  // ⚠️ Le signataire doit AVOIR LU avant de signer. Une case pré-cochée ne
  // prouverait rien : ce qu'on scelle, c'est qu'un texte VERSIONNÉ lui a été
  // présenté et qu'il l'a accepté.
  const [atteste, setAtteste] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function fermer(): void {
    setCible(null);
    setMethode("trace");
    setImage(null);
    setNom("");
    setAtteste(false);
    setErreur(null);
  }

  function ouvrir(seance: SeanceAffichee, role: RoleAffiche): void {
    fermer();
    setCible({ seance, role });
  }

  // L'attestation est exigée dans TOUTES les modalités : c'est elle qui donne
  // son sens à la signature, pas le tracé.
  const pret =
    atteste &&
    !enCours &&
    (methode === "confirmation_accessible" ? nom.trim() !== "" : image !== null);

  /**
   * Convertit la photo en data-URL.
   *
   * Le plafond côté serveur est de 2 Mio DÉCODÉS ; on refuse ici au-delà pour
   * éviter d'envoyer plusieurs mégaoctets depuis un réseau d'entreprise
   * contraint, et pour dire pourquoi plutôt que de laisser échouer l'envoi.
   */
  function chargerPhoto(fichier: File | undefined): void {
    setErreur(null);
    setImage(null);
    if (fichier === undefined) return;
    if (fichier.size > 2 * 1024 * 1024) {
      setErreur("Photo trop lourde (2 Mo maximum). Réduisez la définition de l'appareil photo.");
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => setImage(typeof lecteur.result === "string" ? lecteur.result : null);
    // Un fichier illisible ne doit pas laisser l'écran dans un état où le bouton
    // paraît actif : on efface, et le message dit quoi faire.
    lecteur.onerror = () => {
      setImage(null);
      setErreur("Cette image n'a pas pu être lue. Reprenez la photo.");
    };
    lecteur.readAsDataURL(fichier);
  }

  function envoyer(): void {
    if (cible === null) return;
    setErreur(null);
    const { seance, role } = cible;
    demarrer(async () => {
      const res = await signerAction({
        coachingSessionId,
        compteRenduSeanceId: seance.compteRenduSeanceId,
        role: role.role,
        methode,
        ...(methode === "confirmation_accessible"
          ? { nomConfirme: nom }
          : { imageDataUrl: image ?? "" }),
      });
      if (!res.ok) {
        setErreur(res.message);
        return;
      }
      fermer();
      // L'état signé est relu côté serveur : c'est la LIGNE qui fait foi, pas un
      // état local qu'on aurait mis à jour de son côté.
      router.refresh();
    });
  }

  if (seances.length === 0) {
    return (
      <p className="text-fg-muted text-sm">
        Aucune séance à émarger. Les séances de ce parcours doivent d&apos;abord être déclarées dans
        les comptes-rendus, avec leur durée réelle.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fg-muted text-xs italic">{plafondProbant}</p>

      {seances.map((seance) => (
        <section
          key={seance.compteRenduSeanceId}
          className="border-border rounded-lg border bg-white"
        >
          <div className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
            <span className="text-mocha font-medium">
              {seance.jourLisible}
              {seance.horaires !== null ? (
                <span className="text-fg-muted ml-2 text-sm">{seance.horaires}</span>
              ) : null}
            </span>
            <span className="text-fg-muted text-sm">
              {seance.roles.filter((r) => r.signee).length}/{seance.roles.length} signature
              {seance.roles.filter((r) => r.signee).length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Le blocage au grain SÉANCE est dit une fois, en tête : le répéter sur
              chacun des trois rôles noierait l'information utile. */}
          {seance.blocageSeance !== null ? (
            <p className="text-fg-muted border-border border-b px-4 py-2 text-xs">
              {seance.blocageSeance}
            </p>
          ) : null}

          <ul className="divide-border divide-y">
            {seance.roles.map((role) => {
              const ouvert =
                cible !== null &&
                cible.seance.compteRenduSeanceId === seance.compteRenduSeanceId &&
                cible.role.role === role.role;

              return (
                <li key={role.role} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-mocha font-medium">{role.libelle}</span>
                    {!role.signee && role.peutSigner ? (
                      <button
                        type="button"
                        onClick={() => (ouvert ? fermer() : ouvrir(seance, role))}
                        aria-expanded={ouvert}
                        className="bg-mocha rounded px-3 py-1.5 text-xs text-white"
                      >
                        {ouvert ? "Annuler" : "Faire signer"}
                      </button>
                    ) : null}
                  </div>

                  {role.signee ? (
                    /* On NOMME le signataire, on l'horodate, on dit la modalité et
                       on donne l'empreinte. « Signé » tout court n'est pas une
                       preuve, c'est une affirmation — et c'est précisément ce que
                       ce chantier vient de retirer côté AFEST. */
                    <p className="text-fg-muted mt-1 text-xs">
                      Signé par {role.signataireNom} le {role.signeAtLisible}
                      {role.methodeLisible !== null ? ` · ${role.methodeLisible}` : ""}
                      {role.recueilliSurPosteFormateur
                        ? " · recueillie sur l'appareil de l'organisme"
                        : ""}
                      <span className="mt-0.5 block font-mono text-[10px] break-all">
                        Empreinte : {role.empreinte}
                      </span>
                    </p>
                  ) : role.blocage !== null ? (
                    <p className="text-fg-muted mt-1 text-xs">{role.blocage}</p>
                  ) : (
                    <p className="text-fg-muted mt-1 text-xs">
                      En attente de signature
                      {role.signataireAttenduNom !== null ? ` — ${role.signataireAttenduNom}` : ""}.
                    </p>
                  )}

                  {ouvert ? (
                    <div className="border-border mt-3 space-y-3 rounded border p-3">
                      {/* 🔴 Texte VERSIONNÉ construit côté serveur par
                          `mentionCompleteAfest`. Il porte déjà le plafond probant
                          du canal « poste du formateur ». */}
                      <div className="text-fg-muted space-y-1 text-xs">
                        {role.mentions.map((m, i) => (
                          <p key={i}>{m}</p>
                        ))}
                      </div>

                      <fieldset className="flex flex-wrap gap-3 text-xs">
                        <legend className="sr-only">Modalité de signature</legend>
                        {MODALITES.map(([valeur, libelle]) => (
                          <label key={valeur} className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`modalite-${seance.compteRenduSeanceId}-${role.role}`}
                              checked={methode === valeur}
                              onChange={() => {
                                setMethode(valeur);
                                setImage(null);
                                setErreur(null);
                              }}
                            />
                            {libelle}
                          </label>
                        ))}
                      </fieldset>

                      {methode === "trace" ? (
                        <SignaturePad
                          onChange={setImage}
                          onBasculerAccessible={() => {
                            setMethode("confirmation_accessible");
                            setImage(null);
                          }}
                          disabled={enCours}
                          label={`Signature — ${role.libelle}`}
                        />
                      ) : null}

                      {methode === "papier_scanne" ? (
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="text-xs"
                          disabled={enCours}
                          onChange={(e) => chargerPhoto(e.target.files?.[0])}
                        />
                      ) : null}

                      {methode === "confirmation_accessible" ? (
                        <div className="space-y-1 text-xs">
                          <label
                            className="block"
                            htmlFor={`nom-${seance.compteRenduSeanceId}-${role.role}`}
                          >
                            Saisissez votre nom pour confirmer
                            {role.signataireAttenduNom !== null
                              ? ` (${role.signataireAttenduNom})`
                              : ""}
                          </label>
                          <input
                            id={`nom-${seance.compteRenduSeanceId}-${role.role}`}
                            type="text"
                            value={nom}
                            disabled={enCours}
                            onChange={(e) => setNom(e.target.value)}
                            className="border-border w-full rounded border px-2 py-1"
                          />
                          <p className="text-fg-muted">
                            Aucun tracé ne sera enregistré. Votre confirmation nominative a la même
                            valeur qu&apos;une signature manuscrite.
                          </p>
                        </div>
                      ) : null}

                      <label className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={atteste}
                          onChange={(e) => setAtteste(e.target.checked)}
                        />
                        <span>J&apos;ai lu les mentions ci-dessus et je les accepte.</span>
                      </label>

                      {erreur !== null ? (
                        <p role="alert" className="text-terracotta text-xs">
                          {erreur}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        disabled={!pret}
                        onClick={envoyer}
                        className="bg-mocha rounded px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {enCours ? "Enregistrement…" : "Enregistrer la signature"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
