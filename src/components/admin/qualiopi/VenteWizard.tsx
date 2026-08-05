"use client";
// use-client: state machine wizard 4 étapes (client → formation → devis/session
// → checklist) + appels Server Actions existantes — le wizard ORCHESTRE, il ne
// porte aucune logique métier nouvelle.

/**
 * VenteWizard — parcours guidé « Nouvelle vente » (plan 2026-08-05, phase 0).
 *
 * Stepper repris du wizard canonique du repo (CampaignWizardV2) : pastilles
 * aria-current="step", libellés masqués sous sm:, navigation Précédent/Suivant.
 *
 * Le brouillon (`VenteBrouillon`) est sauvegardé à CHAQUE navigation d'étape via
 * `updateVenteBrouillonAction` (créé paresseusement au premier besoin). Dès que
 * le client CRM existe, le serveur minimise le payload (contacts libres retirés).
 * À la création de la session, le brouillon est supprimé — l'affaire vit alors
 * dans ses entités réelles.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, CircleCheck, CircleMinus, ExternalLink, OctagonAlert } from "lucide-react";
import { toast } from "sonner";

import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminFormDirtyGuard,
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { createClientAction } from "@/server/actions/qualiopi/clients";
import { createDevisAction, sendDevisAction } from "@/server/actions/qualiopi/devis";
import { duplicateFormationAction } from "@/server/actions/qualiopi/formations";
import { createSessionAction } from "@/server/actions/qualiopi/sessions";
import {
  createVenteBrouillonAction,
  supprimerVenteBrouillonAction,
  updateVenteBrouillonAction,
} from "@/server/actions/qualiopi/vente-brouillon";
import {
  construireChecklistVente,
  type ChecklistVenteInput,
  type ChecklistEtat,
  type VenteFinancement,
} from "@/server/qualiopi/vente/checklist";

// ─────────────────────────────────────────────────────────────────────────────
// Types props (données pré-chargées côté serveur — zéro appel DB côté client)
// ─────────────────────────────────────────────────────────────────────────────

export interface VenteClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface VenteOffreOption {
  id: string;
  /** Vrai tier_id pricing.ts, null pour le catalogue V2 (cf. DevisForm). */
  tierId: string | null;
  code: string;
  titreFr: string;
  prixLabelFr: string;
  /** PU HT en centimes pré-résolu serveur — null = jamais pré-remplir 0. */
  prixHtCents: number | null;
  noteDevisFr: string;
  /** Cohérence site↔console jamais vérifiée ou > 30 j (même seuil que l'alerte). */
  tarifNonReverifie: boolean;
}

export interface VenteFormationOption {
  id: string;
  numero: string;
  titre: string;
  offreSiteId: string | null;
  dureeHeures: number;
}

export interface VenteDevisEtat {
  id: string;
  numero: string;
  statut: "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "transforme_convention";
  sentAt: string | null;
  fichierPdfUrl: string | null;
  docusealSubmissionId: string | null;
  montantTotalHtCents: number;
}

export interface VenteSessionEtat {
  id: string;
  numero: string;
  statut: "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";
}

export interface VenteBrouillonInitial {
  id: string;
  etape: number;
  payload: Record<string, unknown>;
  clientId: string | null;
  devisId: string | null;
  sessionId: string | null;
}

export interface VenteWizardProps {
  adminPrefix: string;
  role: string;
  clients: VenteClientOption[];
  offres: VenteOffreOption[];
  formations: VenteFormationOption[];
  /** Pré-sélection client (`?clientId=`, boutons CRM) — le brouillon prime. */
  clientInitialId?: string;
  /** Ventes déjà commencées par cet admin (rappel de reprise, sous l'en-tête). */
  brouillonsEnCours?: ReadonlyArray<{
    id: string;
    etape: number;
    clientRaisonSociale: string | null;
    /** Date déjà formatée fr-FR côté serveur. */
    modifieLe: string;
  }>;
  brouillon?: VenteBrouillonInitial;
  devisInitial?: VenteDevisEtat;
  sessionInitiale?: VenteSessionEtat;
  /** État checklist assemblé serveur (brouillon repris avec session existante). */
  checklistInitiale?: ChecklistVenteInput;
}

type Etape = 1 | 2 | 3 | 4;
type Chemin = "telle_quelle" | "adaptation" | "sur_mesure";

const STEP_LABELS = ["Client", "Formation", "Devis & session", "Checklist"];

const DEVIS_STATUT_LABELS: Record<VenteDevisEtat["statut"], string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé — en attente de signature",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  transforme_convention: "Transformé en convention",
};

const ETAT_META: Record<ChecklistEtat, { Icone: typeof Circle; classe: string; label: string }> = {
  fait: { Icone: CircleCheck, classe: "text-[color:var(--color-admin-success)]", label: "Fait" },
  a_faire: { Icone: Circle, classe: "text-[color:var(--color-admin-fg-soft)]", label: "À faire" },
  bloque: {
    Icone: OctagonAlert,
    classe: "text-[color:var(--color-admin-warning)]",
    label: "Bloqué",
  },
  sans_objet: {
    Icone: CircleMinus,
    classe: "text-[color:var(--color-admin-fg-soft)]",
    label: "Sans objet",
  },
};

function chaine(payload: Record<string, unknown>, cle: string): string {
  const v = payload[cle];
  return typeof v === "string" ? v : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function VenteWizard({
  adminPrefix,
  role,
  clients,
  offres,
  formations,
  clientInitialId,
  brouillonsEnCours,
  brouillon,
  devisInitial,
  sessionInitiale,
  checklistInitiale,
}: VenteWizardProps): React.ReactElement {
  const router = useRouter();
  const base = `/fr/${adminPrefix}`;
  const [isPending, startTransition] = useTransition();

  const p = brouillon?.payload ?? {};

  const [etape, setEtape] = useState<Etape>(() => {
    const e = brouillon?.etape ?? 1;
    return e >= 1 && e <= 4 ? (e as Etape) : 1;
  });
  const [brouillonId, setBrouillonId] = useState<string | null>(brouillon?.id ?? null);
  const [sale, setSale] = useState(false);

  // ── Étape 1 — client ──
  const [modeClient, setModeClient] = useState<"existant" | "nouveau">(
    brouillon?.clientId
      ? "existant"
      : (chaine(p, "modeClient") as "existant" | "nouveau") || "existant",
  );
  const [rechercheClient, setRechercheClient] = useState("");
  const [clientId, setClientId] = useState(brouillon?.clientId ?? clientInitialId ?? "");
  const [clientCree, setClientCree] = useState<{ id: string; numero: string } | null>(null);
  const [raisonSociale, setRaisonSociale] = useState(chaine(p, "raisonSociale"));
  const [siret, setSiret] = useState(chaine(p, "siret"));
  const [contactEmail, setContactEmail] = useState(chaine(p, "contactEmail"));

  // ── Étape 2 — formation ──
  const [offreId, setOffreId] = useState(chaine(p, "offreId"));
  const [formationId, setFormationId] = useState(chaine(p, "formationId"));
  const [chemin, setChemin] = useState<Chemin>((chaine(p, "chemin") as Chemin) || "telle_quelle");
  const [adaptation, setAdaptation] = useState<{ id: string; numero: string } | null>(() => {
    const id = chaine(p, "formationAdapteeId");
    const numero = chaine(p, "formationAdapteeNumero");
    return id ? { id, numero } : null;
  });

  // ── Étape 3 — devis & session ──
  const [nbParticipants, setNbParticipants] = useState(chaine(p, "nbParticipants") || "1");
  const [dureeHeures, setDureeHeures] = useState(chaine(p, "dureeHeures"));
  const [montantEur, setMontantEur] = useState(chaine(p, "montantEur"));
  const [financement, setFinancement] = useState<VenteFinancement>(
    (chaine(p, "financement") as VenteFinancement) || "direct",
  );
  const [devis, setDevis] = useState<VenteDevisEtat | null>(devisInitial ?? null);
  const [dateDebut, setDateDebut] = useState(chaine(p, "dateDebut"));
  const [dateFin, setDateFin] = useState(chaine(p, "dateFin"));
  const [modalite, setModalite] = useState<"presentiel" | "distanciel" | "hybride">(
    (chaine(p, "modalite") as "presentiel" | "distanciel" | "hybride") || "presentiel",
  );
  const [sessionCreee, setSessionCreee] = useState<VenteSessionEtat | null>(
    sessionInitiale ?? null,
  );

  // Rôle : la page gate déjà admin/super_admin ; garde défensive si un rôle
  // moindre atteignait un jour cet écran — les guards serveur JETTENT, autant
  // griser avec l'explication plutôt que laisser un bouton qui explose.
  const peutPublier = role === "admin" || role === "super_admin";

  const offreChoisie = offres.find((o) => o.id === offreId) ?? null;
  const formationsDeLOffre = useMemo(
    () => (offreId ? formations.filter((f) => f.offreSiteId === offreId) : formations),
    [formations, offreId],
  );
  const clientsFiltres = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.raisonSociale.toLowerCase().includes(q) || c.numero.toLowerCase().includes(q),
    );
  }, [clients, rechercheClient]);

  const clientLabel =
    clients.find((c) => c.id === clientId)?.raisonSociale ??
    (clientCree !== null ? raisonSociale : null);

  const devisAccepte = devis?.statut === "accepte" || devis?.statut === "transforme_convention";

  // ── Persistance du brouillon (à chaque navigation d'étape) ──────────────────

  function payloadCourant(): Record<string, unknown> {
    return {
      modeClient,
      // Contacts libres : ne vivent dans le payload QUE tant que le Client
      // n'existe pas — le serveur les retire dès que clientId est posé.
      ...(clientId === "" ? { raisonSociale, siret, contactEmail } : {}),
      offreId,
      formationId,
      chemin,
      ...(adaptation !== null
        ? { formationAdapteeId: adaptation.id, formationAdapteeNumero: adaptation.numero }
        : {}),
      nbParticipants,
      dureeHeures,
      montantEur,
      financement,
      dateDebut,
      dateFin,
      modalite,
    };
  }

  async function persisterBrouillon(prochaineEtape: Etape): Promise<boolean> {
    // Vente convertie (session créée, brouillon supprimé) : l'affaire vit dans
    // ses entités réelles — ne PAS recréer un brouillon en naviguant.
    if (sessionCreee !== null && brouillonId === null) return true;
    let id = brouillonId;
    if (id === null) {
      const cree = await createVenteBrouillonAction();
      if ("error" in cree) {
        toast.error(`Sauvegarde du brouillon impossible : ${cree.error}`);
        return false;
      }
      id = cree.data.id;
      setBrouillonId(id);
    }
    const r = await updateVenteBrouillonAction({
      id,
      etape: prochaineEtape,
      payload: payloadCourant(),
      ...(clientId !== "" ? { clientId } : {}),
      ...(devis !== null ? { devisId: devis.id } : {}),
      ...(sessionCreee !== null ? { sessionId: sessionCreee.id } : {}),
    });
    if ("error" in r) {
      toast.error(`Sauvegarde du brouillon impossible : ${r.error}`);
      return false;
    }
    setSale(false);
    return true;
  }

  function allerEtape(cible: Etape): void {
    startTransition(async () => {
      const ok = await persisterBrouillon(cible);
      if (ok) setEtape(cible);
    });
  }

  // ── Actions métier (orchestration pure — les guards vivent côté serveur) ────

  function creerClient(): void {
    if (raisonSociale.trim().length === 0) {
      toast.error("La raison sociale est requise");
      return;
    }
    startTransition(async () => {
      const r = await createClientAction({
        raisonSociale: raisonSociale.trim(),
        ...(siret.trim() !== "" ? { siret: siret.trim() } : {}),
        ...(contactEmail.trim() !== "" ? { contactEmail: contactEmail.trim() } : {}),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setClientId(r.data.id);
      setClientCree(r.data);
      setSale(true);
      toast.success(`Client ${r.data.numero} créé`);
    });
  }

  function adapterFormation(): void {
    // Re-clic sur le chemin B : ne PAS dupliquer une seconde fois.
    if (adaptation !== null) {
      setChemin("adaptation");
      return;
    }
    if (formationId === "") {
      toast.error("Choisissez d'abord la formation à adapter");
      return;
    }
    startTransition(async () => {
      // estSurMesure + clientId : sans eux, la copie d'une formation catalogue
      // serait ARCHIVÉE par le prochain cleanup du seed, et la vente perdrait
      // le lien client↔adaptation.
      const r = await duplicateFormationAction(formationId, {
        estSurMesure: true,
        ...(clientId !== "" ? { clientId } : {}),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setAdaptation({ id: r.data.id, numero: r.data.numero });
      setChemin("adaptation");
      setSale(true);
      toast.success(`Adaptation ${r.data.numero} créée`);
    });
  }

  function creerDevis(): void {
    if (offreChoisie === null) {
      toast.error("Choisissez une offre (étape 2)");
      return;
    }
    // Espaces (dont insécables/fines du format fr-FR affiché en placeholder)
    // retirés AVANT parseFloat : « 1 190 » s'arrêtait à l'espace → 1,00 € HT
    // silencieux sur le devis.
    const montantCents = Math.round(
      parseFloat(montantEur.replace(/[\s  ]/g, "").replace(",", ".")) * 100,
    );
    if (!Number.isFinite(montantCents) || montantCents <= 0) {
      toast.error("Renseignez un montant HT (aucun prix ferme n'est pré-rempli pour cette offre)");
      return;
    }
    const nb = parseInt(nbParticipants, 10);
    const duree = parseFloat(dureeHeures.replace(",", "."));
    startTransition(async () => {
      const r = await createDevisAction({
        clientId,
        activite: "formation",
        lignes: [
          {
            designation: offreChoisie.titreFr,
            quantite: 1,
            prixUnitaireHtCents: montantCents,
            offreCode: offreChoisie.code,
            ...(offreChoisie.tierId !== null ? { offreTierId: offreChoisie.tierId } : {}),
          },
        ],
        financementSuggere: financement,
        ...(Number.isFinite(nb) && nb >= 1 ? { nbParticipants: nb } : {}),
        ...(Number.isFinite(duree) && duree > 0 ? { dureeHeures: duree } : {}),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const nouveau: VenteDevisEtat = {
        id: r.data.id,
        numero: r.data.numero,
        statut: "brouillon",
        sentAt: null,
        fichierPdfUrl: null,
        docusealSubmissionId: null,
        montantTotalHtCents: montantCents,
      };
      setDevis(nouveau);
      setSale(true);
      toast.success(`Devis ${r.data.numero} créé (brouillon)`);
      // Référence aussitôt posée sur le brouillon (l'état du wizard doit
      // survivre à une fermeture d'onglet juste après la création).
      if (brouillonId !== null) {
        await updateVenteBrouillonAction({ id: brouillonId, devisId: r.data.id });
      }
    });
  }

  function envoyerDevis(): void {
    if (devis === null) return;
    startTransition(async () => {
      const r = await sendDevisAction(devis.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setDevis({
        ...devis,
        statut: "envoye",
        sentAt: new Date().toISOString(),
        // Le PDF est généré par sendDevisAction (fail-soft) — la valeur exacte
        // sera relue de la base à la reprise du brouillon.
        fichierPdfUrl: devis.fichierPdfUrl,
      });
      setSale(true);
      toast.success(
        r.data.emailEnvoye
          ? "Devis envoyé au client"
          : `Devis marqué envoyé${r.data.note !== undefined ? ` — ${r.data.note}` : ""}`,
      );
    });
  }

  function creerSession(): void {
    if (devis === null || !devisAccepte || formationId === "" || clientId === "") return;
    // Retour arrière après création : createSessionAction TOLÈRE un devis déjà
    // lié (idempotence côté serveur) — sans cette garde, re-soumettre créait
    // une SECONDE session réelle sur le même devis.
    if (sessionCreee !== null) {
      toast.error(`La session ${sessionCreee.numero} existe déjà pour cette vente`);
      return;
    }
    // Chemin B : la session doit porter l'ADAPTATION publiée, pas l'originale —
    // sinon la vente « adaptée » anime la formation générique et l'adaptation
    // reste orpheline.
    if (chemin === "adaptation" && (adaptation === null || formationId !== adaptation.id)) {
      toast.error(
        "Chemin adaptation : publiez l'adaptation puis re-sélectionnez-la à l'étape 2 (elle apparaît dans la liste une fois publiée).",
      );
      return;
    }
    if (dateDebut === "" || dateFin === "") {
      toast.error("Renseignez les dates de début et de fin");
      return;
    }
    const nb = parseInt(nbParticipants, 10);
    startTransition(async () => {
      const r = await createSessionAction({
        formationId,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        modalite,
        nbParticipantsPrevus: Number.isFinite(nb) && nb >= 1 ? nb : 1,
        montantHtCents: devis.montantTotalHtCents,
        clientId,
        devisId: devis.id,
        financementType: financement,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setSessionCreee({ id: r.data.id, numero: r.data.numero, statut: "planifiee" });
      toast.success(`Session ${r.data.numero} créée`);
      // Conversion : le brouillon a rempli son office, on le supprime.
      if (brouillonId !== null) {
        await supprimerVenteBrouillonAction(brouillonId);
        setBrouillonId(null);
      }
      setSale(false);
      setEtape(4);
    });
  }

  // ── Checklist (module pur — rendu d'état, aucun recalcul d'alerte) ──────────

  const checklistItems = useMemo(() => {
    // Brouillon repris avec session existante : l'état complet (documents,
    // inscriptions, alertes) a été assemblé côté serveur.
    if (checklistInitiale !== undefined && sessionCreee?.id === sessionInitiale?.id) {
      return construireChecklistVente(checklistInitiale);
    }
    // Session fraîchement créée : aucun document ni inscription encore.
    const input: ChecklistVenteInput = {
      devis:
        devis !== null
          ? {
              statut: devis.statut,
              fichierPdfUrl: devis.fichierPdfUrl,
              docusealSubmissionId: devis.docusealSubmissionId,
              sentAt: devis.sentAt,
            }
          : null,
      session:
        sessionCreee !== null
          ? { statut: sessionCreee.statut, financementType: financement, opcoSubrogation: false }
          : null,
      documentsGeneres: [],
      enrollmentsActifs: 0,
      alertesOuvertes: [],
    };
    return construireChecklistVente(input);
  }, [checklistInitiale, sessionCreee, sessionInitiale, devis, financement]);

  // ── Gates de navigation ─────────────────────────────────────────────────────

  const peutQuitterEtape1 = clientId !== "";
  const peutQuitterEtape2 = offreId !== "" && (chemin !== "telle_quelle" || formationId !== "");

  // ── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Nouvelle vente"
        description={`Parcours guidé client → formation → devis → session — étape ${etape} sur 4.`}
      />
      <AdminFormDirtyGuard dirty={sale && etape < 4} />

      {/* Reprise : le seul chemin quand un devis envoyé attend sa signature. */}
      {brouillonsEnCours !== undefined && brouillonsEnCours.length > 0 ? (
        <div className="mb-[var(--space-admin-5,12px)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold">
            Ventes en cours ({brouillonsEnCours.length})
          </p>
          <ul className="flex flex-col gap-[var(--space-admin-2)]">
            {brouillonsEnCours.map((b) => (
              <li key={b.id} className="text-[length:var(--text-admin-sm)]">
                <Link
                  href={`${base}/qualiopi/vente/new?brouillon=${b.id}`}
                  className="text-[color:var(--color-admin-accent)] underline hover:no-underline"
                >
                  {b.clientRaisonSociale ?? "Client non choisi"} — étape {b.etape}/4
                </Link>{" "}
                <span className="text-[color:var(--color-admin-fg-soft)]">
                  (modifié le {b.modifieLe})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Stepper (pattern CampaignWizardV2 : pastilles + libellés masqués sous sm:) */}
      <div className="mb-[var(--space-admin-6,16px)] flex items-center gap-[var(--space-admin-3,6px)]">
        {([1, 2, 3, 4] as const).map((n) => (
          <div key={n} className="flex flex-1 items-center gap-[var(--space-admin-2,4px)]">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[length:var(--text-admin-xs)] font-semibold",
                etape === n
                  ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-white"
                  : etape > n
                    ? "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]"
                    : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)]",
              )}
              aria-current={etape === n ? "step" : undefined}
            >
              {etape > n ? <Check size={14} aria-label="Étape terminée" /> : n}
            </span>
            <span className="hidden text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] sm:inline">
              {STEP_LABELS[n - 1]}
            </span>
            {n < 4 ? (
              <span className="hidden h-px flex-1 bg-[color:var(--color-admin-border)] sm:inline" />
            ) : null}
          </div>
        ))}
      </div>

      {/* ── Étape 1 — Client ─────────────────────────────────────────────── */}
      {etape === 1 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 1 — Pour quel client ?
          </h2>

          <div
            className="mb-[var(--space-admin-4,8px)] flex flex-wrap gap-[var(--space-admin-4,8px)]"
            role="radiogroup"
            aria-label="Mode de sélection du client"
          >
            <label className="flex items-center gap-2 text-[length:var(--text-admin-sm)]">
              <input
                type="radio"
                name="modeClient"
                checked={modeClient === "existant"}
                onChange={() => {
                  setModeClient("existant");
                  setSale(true);
                }}
              />
              Client existant
            </label>
            <label className="flex items-center gap-2 text-[length:var(--text-admin-sm)]">
              <input
                type="radio"
                name="modeClient"
                checked={modeClient === "nouveau"}
                onChange={() => {
                  setModeClient("nouveau");
                  setSale(true);
                }}
              />
              Nouveau client
            </label>
          </div>

          {modeClient === "existant" ? (
            <div className="flex flex-col gap-[var(--space-admin-3,6px)]">
              <input
                type="search"
                value={rechercheClient}
                onChange={(e) => setRechercheClient(e.target.value)}
                placeholder="Rechercher (raison sociale, numéro)…"
                aria-label="Rechercher un client"
                className="admin-input"
              />
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setSale(true);
                }}
                aria-label="Client"
                className="admin-input"
              >
                <option value="">— Choisir un client —</option>
                {clientsFiltres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.raisonSociale}
                  </option>
                ))}
              </select>
              {clientsFiltres.length === 0 ? (
                <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                  Aucun client ne correspond — créez-en un via « Nouveau client ».
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--space-admin-3,6px)]">
              {clientCree !== null ? (
                // `self-start` : dans une colonne flex, un badge s'étirait sur
                // TOUTE la largeur de la carte — une pastille de 1 100 px.
                <AdminBadge tone="success" className="self-start">
                  Client {clientCree.numero} créé — passez à l&apos;étape suivante
                </AdminBadge>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                    Raison sociale *
                    <input
                      type="text"
                      value={raisonSociale}
                      onChange={(e) => {
                        setRaisonSociale(e.target.value);
                        setSale(true);
                      }}
                      className="admin-input"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                    SIRET (facultatif)
                    <input
                      type="text"
                      value={siret}
                      onChange={(e) => {
                        setSiret(e.target.value);
                        setSale(true);
                      }}
                      className="admin-input"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                    E-mail de contact (facultatif — requis plus tard pour envoyer le devis)
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        setSale(true);
                      }}
                      className="admin-input"
                    />
                  </label>
                  <div>
                    <AdminButton onClick={creerClient} loading={isPending}>
                      Créer le client
                    </AdminButton>
                  </div>
                </>
              )}
            </div>
          )}
        </AdminCard>
      ) : null}

      {/* ── Étape 2 — Formation ──────────────────────────────────────────── */}
      {etape === 2 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 2 — Quelle formation ?
          </h2>

          <div className="flex flex-col gap-[var(--space-admin-3,6px)]">
            <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
              Offre du catalogue
              <select
                value={offreId}
                onChange={(e) => {
                  setOffreId(e.target.value);
                  setFormationId("");
                  setSale(true);
                }}
                aria-label="Offre"
                className="admin-input"
              >
                <option value="">— Choisir une offre —</option>
                {offres.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} — {o.titreFr} ({o.prixLabelFr})
                    {o.tarifNonReverifie ? " — tarif à revérifier" : ""}
                  </option>
                ))}
              </select>
            </label>

            {offreChoisie !== null ? (
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                {offreChoisie.noteDevisFr}
              </p>
            ) : null}
            {offreChoisie !== null && offreChoisie.tarifNonReverifie ? (
              <p className="admin-alert admin-alert-warning text-[length:var(--text-admin-xs)]">
                Le tarif de cette offre n&apos;a pas été revérifié depuis plus de 30 jours (ou
                jamais) : confirmer la cohérence avec la page du site avant d&apos;émettre le devis
                (« Vérifier la cohérence » sur l&apos;écran Offres).
              </p>
            ) : null}

            <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
              Formation publiée
              <select
                value={formationId}
                onChange={(e) => {
                  setFormationId(e.target.value);
                  const f = formations.find((x) => x.id === e.target.value);
                  if (f !== undefined && dureeHeures === "") setDureeHeures(String(f.dureeHeures));
                  setSale(true);
                }}
                aria-label="Formation"
                className="admin-input"
              >
                <option value="">— Choisir une formation —</option>
                {formationsDeLOffre.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.numero} — {f.titre} ({f.dureeHeures} h)
                  </option>
                ))}
              </select>
              {offreId !== "" && formationsDeLOffre.length === 0 ? (
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                  Aucune formation publiée pour cette offre — adaptez une formation existante ou
                  créez-en une sur-mesure.{" "}
                  {/* 🔴 Vérification en production le 2026-08-05 : les seules offres
                      actives sans formation sont les trois accompagnements
                      INDIVIDUELS (+ « Sur demande »). Le message n'offrait que
                      des issues « formation », donc aucune issue juste : pour du
                      1-to-1, le bon geste est le parcours de séances. Tant que
                      la table de routage offre↔prestation n'existe pas (phase
                      1b), on ne DEVINE pas — on nomme la troisième issue et on
                      transporte le client. */}
                  S&apos;il s&apos;agit d&apos;un accompagnement individuel,{" "}
                  <Link
                    href={
                      clientId !== ""
                        ? `${base}/coaching/parcours/new?clientId=${clientId}`
                        : `${base}/coaching/parcours/new`
                    }
                    className="text-[color:var(--color-admin-accent)] underline hover:no-underline"
                  >
                    créez plutôt un parcours 1-to-1
                  </Link>
                  .
                </span>
              ) : null}
            </label>

            {/* Trois chemins — PAS d'édition inline d'une formation publiée
                (l'éditer la dépublierait). */}
            <div
              className="mt-[var(--space-admin-3,6px)] grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-3"
              role="radiogroup"
              aria-label="Chemin de la formation"
            >
              <button
                type="button"
                role="radio"
                aria-checked={chemin === "telle_quelle"}
                onClick={() => {
                  setChemin("telle_quelle");
                  setSale(true);
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded border p-3 text-left transition",
                  chemin === "telle_quelle"
                    ? "border-[color:var(--color-admin-accent)] ring-2 ring-[color:var(--color-admin-accent)]"
                    : "border-[color:var(--color-admin-border)] hover:bg-[color:var(--color-admin-surface-2)]",
                )}
              >
                <span className="font-semibold">A — Telle quelle</span>
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                  La formation publiée, sans modification (défaut).
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={chemin === "adaptation"}
                onClick={adapterFormation}
                disabled={!peutPublier || isPending}
                title={
                  peutPublier
                    ? undefined
                    : "Réservé aux rôles admin / super_admin : l'adaptation devra être publiée, ce que votre rôle ne permet pas."
                }
                className={cn(
                  "flex flex-col items-start gap-1 rounded border p-3 text-left transition",
                  chemin === "adaptation"
                    ? "border-[color:var(--color-admin-accent)] ring-2 ring-[color:var(--color-admin-accent)]"
                    : "border-[color:var(--color-admin-border)] hover:bg-[color:var(--color-admin-surface-2)]",
                  !peutPublier ? "cursor-not-allowed opacity-50" : "",
                )}
              >
                <span className="font-semibold">B — Adapter pour ce client</span>
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                  Duplique la formation choisie en brouillon éditable.
                </span>
              </button>
              {/* Bouton (pas un Link) : la navigation ne part QU'APRÈS la
                  sauvegarde du brouillon — un Link naviguait immédiatement et
                  perdait toute la saisie depuis la dernière étape
                  (AdminFormDirtyGuard ne couvre que beforeunload). */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setChemin("sur_mesure");
                  startTransition(async () => {
                    await persisterBrouillon(etape);
                    router.push(`${base}/qualiopi/formations/new`);
                  });
                }}
                className="flex flex-col items-start gap-1 rounded border border-[color:var(--color-admin-border)] p-3 text-left transition hover:bg-[color:var(--color-admin-surface-2)]"
              >
                <span className="flex items-center gap-1 font-semibold">
                  C — Sur-mesure
                  <ExternalLink size={12} aria-hidden="true" />
                </span>
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                  Créer une formation neuve depuis zéro (le brouillon de vente est conservé).
                </span>
              </button>
            </div>

            {adaptation !== null ? (
              <div
                role="status"
                className="rounded border border-[color:var(--color-admin-warning)] p-[var(--space-admin-4,8px)] text-[length:var(--text-admin-sm)]"
              >
                <p className="font-semibold">
                  Adaptation {adaptation.numero} créée (statut : en préparation)
                </p>
                <p className="text-[color:var(--color-admin-fg-soft)]">
                  Complétez-la et publiez-la avant de créer la session — une copie sort en «
                  intention », elle n&apos;est pas encore éligible aux sessions.
                </p>
                <Link
                  href={`${base}/qualiopi/formations/${adaptation.id}`}
                  className="text-[color:var(--color-admin-accent)] underline hover:no-underline"
                >
                  Ouvrir la fiche de l&apos;adaptation
                </Link>
              </div>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      {/* ── Étape 3 — Devis & session ────────────────────────────────────── */}
      {etape === 3 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 3 — Devis, puis session
          </h2>

          {devis === null ? (
            <div className="flex flex-col gap-[var(--space-admin-3,6px)]">
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                Devis pour {clientLabel ?? "le client choisi"} — ligne unique depuis l&apos;offre{" "}
                {offreChoisie !== null ? `${offreChoisie.code} (${offreChoisie.prixLabelFr})` : ""}.
              </p>
              <div className="grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                  Montant HT (€)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montantEur}
                    onChange={(e) => {
                      setMontantEur(e.target.value);
                      setSale(true);
                    }}
                    placeholder={
                      offreChoisie?.prixHtCents != null
                        ? (offreChoisie.prixHtCents / 100).toLocaleString("fr-FR")
                        : "Aucun prix ferme — à chiffrer"
                    }
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                  Participants prévus
                  <input
                    type="number"
                    min={1}
                    value={nbParticipants}
                    onChange={(e) => {
                      setNbParticipants(e.target.value);
                      setSale(true);
                    }}
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                  Durée (heures)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dureeHeures}
                    onChange={(e) => {
                      setDureeHeures(e.target.value);
                      setSale(true);
                    }}
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                  Financement envisagé
                  <select
                    value={financement}
                    onChange={(e) => {
                      setFinancement(e.target.value as VenteFinancement);
                      setSale(true);
                    }}
                    className="admin-input"
                  >
                    <option value="direct">Direct (entreprise)</option>
                    <option value="opco">OPCO</option>
                    <option value="france_travail">France Travail</option>
                  </select>
                </label>
              </div>
              {offreChoisie !== null && offreChoisie.prixHtCents !== null && montantEur === "" ? (
                <div>
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (offreChoisie.prixHtCents !== null) {
                        setMontantEur(String(offreChoisie.prixHtCents / 100));
                        setSale(true);
                      }
                    }}
                  >
                    Reprendre le prix catalogue
                  </AdminButton>
                </div>
              ) : null}
              <div>
                <AdminButton onClick={creerDevis} loading={isPending} disabled={clientId === ""}>
                  Créer le devis (brouillon)
                </AdminButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--space-admin-4,8px)]">
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3,6px)]">
                <span className="font-semibold">Devis {devis.numero}</span>
                <AdminBadge tone={devisAccepte ? "success" : "info"}>
                  {DEVIS_STATUT_LABELS[devis.statut]}
                </AdminBadge>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                  {(devis.montantTotalHtCents / 100).toLocaleString("fr-FR")} € HT
                </span>
                <Link
                  href={`${base}/qualiopi/devis/${devis.id}`}
                  className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
                >
                  Ouvrir la fiche devis
                </Link>
              </div>

              {devis.statut === "brouillon" ? (
                <div>
                  <AdminButton onClick={envoyerDevis} loading={isPending}>
                    Envoyer le devis
                  </AdminButton>
                </div>
              ) : null}

              {sessionCreee !== null ? (
                // Retour arrière après création : ré-afficher le formulaire
                // permettait une SECONDE session sur le même devis (l'action
                // serveur tolère un devis déjà lié).
                <div
                  role="status"
                  className="flex flex-wrap items-center gap-[var(--space-admin-3,6px)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4,8px)]"
                >
                  <CircleCheck
                    size={16}
                    aria-hidden="true"
                    className="text-[color:var(--color-admin-success)]"
                  />
                  <span className="font-semibold">Session {sessionCreee.numero} créée</span>
                  <Link
                    href={`${base}/qualiopi/sessions/${sessionCreee.id}`}
                    className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
                  >
                    Ouvrir la session
                  </Link>
                </div>
              ) : devisAccepte ? (
                <div className="flex flex-col gap-[var(--space-admin-3,6px)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4,8px)]">
                  <h3 className="font-semibold">Créer la session</h3>
                  <div className="grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                      Date de début
                      <input
                        type="date"
                        value={dateDebut}
                        onChange={(e) => {
                          setDateDebut(e.target.value);
                          setSale(true);
                        }}
                        className="admin-input"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                      Date de fin
                      <input
                        type="date"
                        value={dateFin}
                        onChange={(e) => {
                          setDateFin(e.target.value);
                          setSale(true);
                        }}
                        className="admin-input"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                      Modalité
                      <select
                        value={modalite}
                        onChange={(e) => {
                          setModalite(e.target.value as typeof modalite);
                          setSale(true);
                        }}
                        className="admin-input"
                      >
                        <option value="presentiel">Présentiel</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="hybride">Hybride</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                      Participants prévus
                      <input
                        type="number"
                        min={1}
                        value={nbParticipants}
                        onChange={(e) => {
                          setNbParticipants(e.target.value);
                          setSale(true);
                        }}
                        className="admin-input"
                      />
                    </label>
                  </div>
                  {formationId === "" ? (
                    <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                      Choisissez une formation publiée à l&apos;étape 2 (une adaptation doit être
                      publiée avant d&apos;être éligible).
                    </p>
                  ) : chemin === "adaptation" &&
                    (adaptation === null || formationId !== adaptation.id) ? (
                    <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                      Chemin adaptation : la session doit porter l&apos;adaptation, pas la formation
                      d&apos;origine. Publiez l&apos;adaptation puis re-sélectionnez-la à
                      l&apos;étape 2 (elle apparaît dans la liste une fois publiée).
                    </p>
                  ) : null}
                  <div>
                    <AdminButton
                      onClick={creerSession}
                      loading={isPending}
                      disabled={
                        formationId === "" ||
                        (chemin === "adaptation" &&
                          (adaptation === null || formationId !== adaptation.id))
                      }
                    >
                      Créer la session
                    </AdminButton>
                  </div>
                </div>
              ) : devis.statut === "envoye" || devis.statut === "brouillon" ? (
                <p
                  role="status"
                  className="rounded border border-[color:var(--color-admin-border)] p-[var(--space-admin-4,8px)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
                >
                  La session se crée quand le devis est accepté — reprenez ce brouillon depuis «
                  Nouvelle vente » (il est proposé en haut de la page) dès la signature reçue.
                </p>
              ) : (
                <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                  Devis {DEVIS_STATUT_LABELS[devis.statut].toLowerCase()} : émettez une révision
                  depuis la fiche devis avant de poursuivre.
                </p>
              )}
            </div>
          )}
        </AdminCard>
      ) : null}

      {/* ── Étape 4 — Checklist ──────────────────────────────────────────── */}
      {etape === 4 ? (
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5,12px)] text-[length:var(--text-admin-lg)] font-semibold">
            Étape 4 — Checklist du dossier
          </h2>
          <ul className="flex flex-col gap-[var(--space-admin-3,6px)]">
            {checklistItems.map((item) => {
              const meta = ETAT_META[item.etat];
              const href =
                item.key === "devis" && devis !== null
                  ? `${base}/qualiopi/devis/${devis.id}`
                  : sessionCreee !== null
                    ? `${base}/qualiopi/sessions/${sessionCreee.id}`
                    : null;
              return (
                <li
                  key={item.key}
                  className="flex items-start gap-[var(--space-admin-3,6px)] rounded border border-[color:var(--color-admin-border)] p-[var(--space-admin-3,6px)]"
                >
                  <meta.Icone
                    size={18}
                    aria-label={meta.label}
                    className={cn("mt-0.5 shrink-0", meta.classe)}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {href !== null ? (
                        <Link href={href} className="hover:underline">
                          {item.libelle}
                        </Link>
                      ) : (
                        item.libelle
                      )}
                    </p>
                    <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                      {item.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {sessionCreee !== null ? (
            <div className="mt-[var(--space-admin-5,12px)]">
              <AdminButton
                onClick={() => router.push(`${base}/qualiopi/sessions/${sessionCreee.id}`)}
              >
                Ouvrir la session {sessionCreee.numero}
              </AdminButton>
            </div>
          ) : null}
        </AdminCard>
      ) : null}

      {/* ── Navigation Précédent / Suivant ───────────────────────────────── */}
      <div className="mt-[var(--space-admin-5,12px)] flex items-center justify-between gap-[var(--space-admin-3,6px)]">
        {etape > 1 ? (
          <AdminButton
            variant="secondary"
            onClick={() => allerEtape((etape - 1) as Etape)}
            loading={isPending}
          >
            Précédent
          </AdminButton>
        ) : (
          <span />
        )}
        {etape < 4 ? (
          <AdminButton
            onClick={() => allerEtape((etape + 1) as Etape)}
            loading={isPending}
            disabled={(etape === 1 && !peutQuitterEtape1) || (etape === 2 && !peutQuitterEtape2)}
          >
            Suivant
          </AdminButton>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
