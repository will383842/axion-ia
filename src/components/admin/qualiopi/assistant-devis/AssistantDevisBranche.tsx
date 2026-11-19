"use client";
// use-client: état de l'assistant, sauvegarde automatique et appels aux actions serveur.

/**
 * Assistant de devis — branchement écran ↔ serveur (fiche E17a).
 *
 * Relie `AssistantDevis` (E06) aux actions du lot serveur SANS rien y changer :
 *  - sauvegarde : `creerBrouillonAssistantAction` tant qu'il n'y a pas d'identifiant, puis
 *    `sauverBrouillonAssistantAction` (`sauvegardeId` neuf à chaque envoi). La RÉVISION du serveur
 *    transite par le champ `majLe` du hook en jeton opaque `String(revision)` ; un conflit s'arrête
 *    (`conflit: true`), rien n'est écrasé ni réessayé ;
 *  - étape 4 : sauver → numéroter → aperçu, puis envoyer avec la révision rendue par la
 *    numérotation. Un envoi rejoué ou « à renuméroter » est AFFICHÉ, jamais relancé tout seul ;
 *  - étape 1 : l'action `client` est envoyée dès le montage (le type du client préchoisi n'est pas
 *    dans l'état), et la `note` de « Pour qui ? » est affichée.
 * Les étapes 1 à 3 sont assemblées par la page (E17b) et injectées par `rendreEtape`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { apercuAssistantAction } from "@/server/actions/qualiopi/devis-assistant-apercu";
import {
  creerBrouillonAssistantAction,
  reprendreBrouillonAssistantAction,
  sauverBrouillonAssistantAction,
} from "@/server/actions/qualiopi/devis-assistant-brouillon";
import {
  envoyerDepuisAssistantAction,
  numeroterDevisAssistantAction,
} from "@/server/actions/qualiopi/devis-assistant-finaliser";
import { listerSourcesPourQuiAction } from "@/server/actions/qualiopi/devis-assistant-sources";
import type { PayloadAssistantV1 } from "@/server/qualiopi/devis/assistant/payload";
import type { SourcePourQui } from "@/server/qualiopi/devis/assistant/sources";

import type { TexteCopie } from "../devis-formules/saisie";
import {
  AssistantDevis,
  brouillonEstIllisible,
  type ContexteEtape,
  type ResultatSauvegarde,
} from "./AssistantDevis";
import { serialiser } from "./etat";
import { EtapeEnvoi, type ApercuPrepare, type ResultatAction } from "./etapes/envoi/EtapeEnvoi";
import type { ClientOption } from "./etapes/un/BlocClient";
import { StatutSauvegarde } from "./StatutSauvegarde";
import type { EtatSerialise } from "./types";
import {
  useBrouillonAuto,
  type EntreeSauvegarde,
  type ReponseSauvegarde,
} from "./useBrouillonAuto";
import { etatVersPayload, payloadVersEtat } from "./vers-payload";
import { versApercuPrepare } from "./vers-vue-apercu";

export interface PropsAssistantDevisBranche {
  payloadInitial: PayloadAssistantV1;
  /** Brouillon d'assistant déjà enregistré (chargeur S12) ; absent = naît à la première sauvegarde. */
  brouillon: { id: string; revision: number } | null;
  clients: readonly ClientOption[];
  textesParDefaut: readonly TexteCopie[];
  tauxStandard: number;
  formulesActives: boolean;
  validiteParDefaut: string;
  /** Version des CGV en vigueur (lue en configuration par la page, jamais écrite en dur). */
  versionCgv: string;
  urlAssistant: string;
  defaultClientId?: string | undefined;
  /** Devis brouillon rouvert : lié au brouillon d'assistant à sa création. */
  devisId?: string | undefined;
  /** Étapes 1, 1b, 2 et 3 (assemblées par la page). */
  rendreEtape: (ctx: ContexteEtape) => ReactNode;
  onEnvoye?: ((r: { devisId: string }) => void) | undefined;
}

interface Dernier {
  id: string;
  revision: number;
}

const MSG_INDISPONIBLE = "L'enregistrement du brouillon a échoué. Réessayez.";
const MSG_CONFLIT =
  "Ce brouillon a été modifié ailleurs (un autre onglet ?). Rien n'a été écrasé : rechargez la page avant de continuer.";
const MSG_INATTENDU =
  "Une erreur inattendue est survenue. Vérifiez l'état du devis dans la liste avant de réessayer.";

// ───────────────────────── « Pour qui ? » : demandes récentes ─────────────────────────

function SourcesPourQuiPanneau({
  clients,
  onChoisir,
}: {
  clients: readonly ClientOption[];
  onChoisir: (c: ClientOption) => void;
}) {
  const [etat, setEtat] = useState<
    | { s: "attente" }
    | { s: "erreur"; message: string }
    | { s: "pret"; sources: SourcePourQui[]; note: string | null }
  >({ s: "attente" });

  useEffect(() => {
    let actif = true;
    listerSourcesPourQuiAction({ recherche: "" }).then(
      (r) => {
        if (!actif) return;
        setEtat(
          "error" in r
            ? { s: "erreur", message: r.error }
            : { s: "pret", sources: r.data, note: r.note ?? null },
        );
      },
      () => {
        if (actif)
          setEtat({ s: "erreur", message: "Les demandes récentes n'ont pas pu être lues." });
      },
    );
    return () => {
      actif = false;
    };
  }, []);

  if (etat.s === "attente") return null;
  if (etat.s === "erreur") return <p role="note">{etat.message}</p>;
  return (
    <section aria-label="Demandes récentes" className="mb-4">
      <h3>Demandes récentes</h3>
      {etat.note ? <p role="note">{etat.note}</p> : null}
      <ul className="list-none p-0">
        {etat.sources.map((s, i) => {
          const client = s.clientId ? clients.find((c) => c.id === s.clientId) : undefined;
          return (
            <li key={`${s.lien}-${i}`} className="flex flex-wrap items-center gap-2">
              <span>
                {s.libelle}
                {s.detail !== "" ? ` · ${s.detail}` : ""}
              </span>
              {client ? (
                <button
                  type="button"
                  className="min-h-[44px] rounded border px-3"
                  onClick={() => onChoisir(client)}
                >
                  Choisir ce client
                </button>
              ) : (
                <a href={s.lien} className="underline">
                  Ouvrir la demande
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Pose le type du client préchoisi dès le montage de l'étape 1 (il n'est pas dans l'état). */
function TypeClientAuMontage({
  ctx,
  clients,
}: {
  ctx: ContexteEtape;
  clients: readonly ClientOption[];
}) {
  const { etat, dispatch } = ctx;
  useEffect(() => {
    if (etat.clientId === "") return;
    const c = clients.find((x) => x.id === etat.clientId);
    if (c && etat.clientType !== c.type) dispatch({ type: "client", id: c.id, clientType: c.type });
  }, [etat.clientId, etat.clientType, clients, dispatch]);
  return null;
}

// ───────────────────────── pont avec le hook de sauvegarde ─────────────────────────

type Sauveur = (s: EtatSerialise) => Promise<ResultatSauvegarde>;

function PontSauvegarde(p: {
  ctx: ContexteEtape;
  urlAssistant: string;
  sauverBrouillon: (i: EntreeSauvegarde) => Promise<ReponseSauvegarde>;
  initial: { id: string; majLe: string } | undefined;
  illisible: boolean;
  enregistrer: (f: Sauveur | null) => void;
}) {
  const { projetId, rencontreId } = p.ctx.etat.origine;
  const origine = useMemo(
    () => ({
      ...(projetId ? { projetId } : {}),
      ...(rencontreId ? { rencontreId } : {}),
    }),
    [projetId, rencontreId],
  );
  const h = useBrouillonAuto({
    etat: p.ctx.etat,
    etape: p.ctx.etape,
    urlAssistant: p.urlAssistant,
    sauverBrouillon: p.sauverBrouillon,
    brouillonInitial: p.initial,
    brouillonIllisible: p.illisible,
    origine,
  });
  const { enregistrer } = p;
  useEffect(() => {
    enregistrer(h.sauvegarderMaintenant);
    return () => enregistrer(null);
  }, [h.sauvegarderMaintenant, enregistrer]);
  return (
    <StatutSauvegarde
      statut={h.statut}
      enregistreA={h.enregistreA}
      erreur={h.erreur}
      onRecharger={() => window.location.reload()}
    />
  );
}

// ───────────────────────── composant ─────────────────────────

export function AssistantDevisBranche(props: PropsAssistantDevisBranche) {
  const [depart] = useState(() => {
    const lu = payloadVersEtat(props.payloadInitial);
    // Un brouillon fourni est TOUJOURS passé : s'il est illisible, son contenu brut suit tel quel
    // et le chemin « illisible » d'origine s'applique (message affiché, brouillon non modifié).
    const initial = props.brouillon
      ? {
          id: props.brouillon.id,
          majLe: String(props.brouillon.revision),
          donnees:
            lu.source === "ecran"
              ? serialiser(lu.etat, lu.etape)
              : (props.payloadInitial.nonImprime["ecran"] as EtatSerialise),
        }
      : undefined;
    return { initial, illisible: brouillonEstIllisible(initial) };
  });
  const { initial, illisible } = depart;
  const dernier = useRef<Dernier | null>(
    initial ? { id: initial.id, revision: Number(initial.majLe) } : null,
  );
  const sauveur = useRef<Sauveur | null>(null);
  /** Révision du serveur inattendue (autre onglet ?) : plus aucune écriture ni envoi d'ici. */
  const enConflit = useRef(false);
  const [avis, setAvis] = useState<string | null>(null);
  const [cleEnvoi, setCleEnvoi] = useState(0);
  const enregistrer = useCallback((f: Sauveur | null) => {
    sauveur.current = f;
  }, []);

  const contexte = (devisId?: string) => ({
    tvaStandardPct: props.tauxStandard,
    textes: props.textesParDefaut,
    devisId: devisId ?? props.devisId ?? props.payloadInitial.sync.devisId ?? undefined,
    refClient: props.payloadInitial.refClient,
    venteBrouillonId: props.payloadInitial.venteBrouillonId,
    modeleId: props.payloadInitial.modeleId,
  });

  /** Contrat C2 du hook, branché sur les actions S06. La révision voyage dans `majLe`. */
  async function sauverBrouillon(i: EntreeSauvegarde): Promise<ReponseSauvegarde> {
    const payload = etatVersPayload(i.donnees.etat, i.donnees.etape, contexte());
    if (i.id === undefined) {
      const r = await creerBrouillonAssistantAction({
        payload,
        // Avec un brouillon fourni (même illisible), le lien au devis existe déjà : le renvoyer
        // ferait rendre le brouillon lié SANS écrire le payload.
        ...(props.devisId && !props.brouillon ? { devisId: props.devisId } : {}),
      });
      if ("error" in r) return { error: r.error };
      dernier.current = { id: r.data.id, revision: r.data.revision };
      return { data: { id: r.data.id, majLe: String(r.data.revision) } };
    }
    // La numérotation (étape 4) fait avancer la révision sans passer par le hook : la plus
    // récente des deux valeurs est celle du serveur.
    if (enConflit.current) return { error: MSG_CONFLIT, conflit: true };
    const duJeton = Number(i.attenduMajLe);
    const connue = dernier.current?.id === i.id ? dernier.current.revision : -1;
    const attenduRevision = Math.max(Number.isInteger(duJeton) ? duJeton : -1, connue);
    if (attenduRevision < 0) return { error: MSG_INDISPONIBLE };
    const r = await sauverBrouillonAssistantAction({
      id: i.id,
      attenduRevision,
      sauvegardeId: crypto.randomUUID(),
      payload,
      etape: payload.etape,
    });
    if ("error" in r) {
      return "conflit" in r && r.conflit ? { error: r.error, conflit: true } : { error: r.error };
    }
    dernier.current = { id: i.id, revision: r.data.revision };
    return { data: { id: i.id, majLe: String(r.data.revision) } };
  }

  async function sauvegarder(s: EtatSerialise): Promise<ResultatSauvegarde> {
    const f = sauveur.current;
    return f ? f(s) : { ok: false, erreur: MSG_INDISPONIBLE };
  }

  /**
   * Après un échec, la numérotation a pu faire avancer la révision : on la relit. Seule la
   * révision `dernier + 1` (la numérotation de l'envoi) est adoptée ; toute autre valeur vient
   * d'une autre session : conflit, rien n'est adopté.
   */
  async function relireRevision(): Promise<"adoptee" | "inchangee" | "conflit"> {
    const d = dernier.current;
    if (!d) return "inchangee";
    try {
      const r = await reprendreBrouillonAssistantAction(d.id);
      if (!("data" in r) || r.data.revision === d.revision) return "inchangee";
      if (r.data.revision === d.revision + 1) {
        dernier.current = { id: d.id, revision: r.data.revision };
        return "adoptee";
      }
      enConflit.current = true;
      return "conflit";
    } catch {
      // Sans relecture, l'envoi suivant sera refusé par le serveur (jamais envoyé deux fois).
      return "inchangee";
    }
  }

  function etapeQuatre(ctx: ContexteEtape): ReactNode {
    const client = props.clients.find((c) => c.id === ctx.etat.clientId);
    const preparer = async (): Promise<ResultatAction<ApercuPrepare>> => {
      try {
        return await preparerSansFiltre();
      } catch (err) {
        console.error("[devis-assistant] préparation de l'aperçu", err);
        return { error: MSG_INATTENDU };
      }
    };
    const preparerSansFiltre = async (): Promise<ResultatAction<ApercuPrepare>> => {
      if (enConflit.current) return { error: MSG_CONFLIT };
      const s = await sauvegarder(serialiser(ctx.etat, 4));
      if (!s.ok) return { error: s.erreur };
      const d = dernier.current;
      if (!d) return { error: MSG_INDISPONIBLE };
      const n = await numeroterDevisAssistantAction({
        brouillonId: d.id,
        attenduRevision: d.revision,
      });
      if ("error" in n) {
        // « Validité refusée » : le devis est numéroté et la révision a pu avancer.
        if ((await relireRevision()) === "conflit") return { error: MSG_CONFLIT };
        return { error: n.error };
      }
      dernier.current = { id: d.id, revision: n.data.revision };
      if (n.data.aRenumeroter) {
        return {
          error:
            "La saisie a changé pendant la numérotation : le devis porte la version précédente. Réessayez pour le mettre à jour.",
        };
      }
      const payload = etatVersPayload(ctx.etat, 4, contexte(n.data.devisId));
      const a = await apercuAssistantAction(payload);
      if ("error" in a) return { error: a.error };
      const v = versApercuPrepare(a.data, n.data, {
        clientNom: client?.raisonSociale ?? "",
        validite: ctx.etat.validite,
        objectif: ctx.etat.resultatVise,
        versionCgv: props.versionCgv,
        livrables: {
          A: ctx.etat.achat.phases.map((p) => p.livrable),
          B: ctx.etat.abonnement.phases.map((p) => p.livrable),
        },
      });
      return v.ok ? { data: v.prepare } : { error: v.erreur };
    };
    const envoyer = async (
      devisId: string,
    ): Promise<ResultatAction<{ enCorbeille: boolean; note?: string }>> => {
      if (enConflit.current) return { error: MSG_CONFLIT };
      const d = dernier.current;
      if (!d) return { error: MSG_INDISPONIBLE };
      try {
        const r = await envoyerDepuisAssistantAction({
          brouillonId: d.id,
          attenduRevision: d.revision,
        });
        if ("error" in r) {
          // Le message du serveur est affiché tel quel, aucun second envoi n'est lancé ici.
          const lu = await relireRevision();
          if (lu === "conflit") return { error: MSG_CONFLIT };
          if (lu === "adoptee") {
            // « À renuméroter » : le devis porte une version que le client n'a pas vue ici. On
            // refait un aperçu (sauver → numéroter → aperçu) au lieu de réenvoyer directement.
            setAvis(`${r.error} L'aperçu a été recalculé : relisez-le avant d'envoyer.`);
            setCleEnvoi((k) => k + 1);
          }
          return { error: r.error };
        }
        await relireRevision();
        // Le devis est ENVOYÉ côté serveur dans tous les cas : l'écran en est informé.
        props.onEnvoye?.({ devisId });
        if (!r.data.emailEnvoye) {
          return {
            data: {
              enCorbeille: false,
              note:
                r.data.note ??
                "Le devis est envoyé, mais l'e-mail n'a pas été préparé : ouvrez la fiche du devis.",
            },
          };
        }
        return { data: { enCorbeille: true, ...(r.data.note ? { note: r.data.note } : {}) } };
      } catch (err) {
        console.error("[devis-assistant] envoi", err);
        await relireRevision();
        return { error: MSG_INATTENDU };
      }
    };
    return (
      <>
        {avis ? <p role="status">{avis}</p> : null}
        <EtapeEnvoi
          key={cleEnvoi}
          etape={4}
          preparer={preparer}
          envoyer={envoyer}
          destinataire={client?.email ?? ""}
        />
      </>
    );
  }

  function rendreEtape(ctx: ContexteEtape): ReactNode {
    return (
      <>
        <PontSauvegarde
          ctx={ctx}
          urlAssistant={props.urlAssistant}
          sauverBrouillon={sauverBrouillon}
          initial={initial ? { id: initial.id, majLe: initial.majLe } : undefined}
          illisible={illisible}
          enregistrer={enregistrer}
        />
        {ctx.etape === 1 ? (
          <>
            <TypeClientAuMontage ctx={ctx} clients={props.clients} />
            <SourcesPourQuiPanneau
              clients={props.clients}
              onChoisir={(c) => ctx.dispatch({ type: "client", id: c.id, clientType: c.type })}
            />
          </>
        ) : null}
        {ctx.etape === 4 ? etapeQuatre(ctx) : props.rendreEtape(ctx)}
      </>
    );
  }

  return (
    <AssistantDevis
      validiteParDefaut={props.validiteParDefaut}
      formulesActives={props.formulesActives}
      defaultClientId={props.defaultClientId ?? props.payloadInitial.clientId ?? undefined}
      projetId={props.payloadInitial.projetId ?? undefined}
      rencontreId={props.payloadInitial.rencontreId ?? undefined}
      brouillonInitial={initial}
      sauvegarder={sauvegarder}
      rendreEtape={rendreEtape}
    />
  );
}
