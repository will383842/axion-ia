/**
 * Sources « Pour qui ? » de l'assistant de devis (fiche S13) — PUR, client-safe, lecture seule.
 *
 * La seule source est la Boîte de réception (`/contacts`, `listInbox`) : appels réservés et
 * messages du site. Il n'existe pas de « liste de demandes de devis » (`/qualiopi/entrees`
 * redirige déjà vers `/contacts`). Les candidatures et les demandes de podcast sont écartées :
 * ce ne sont pas des clients potentiels d'un devis.
 *
 * Aucune création implicite : une demande sans fiche client rend `clientId: null` et le lien de
 * sa page existante. Ni e-mail ni téléphone ne sortent d'ici (le brouillon n'en stocke jamais).
 */
import type { InboxChannel, InboxItem } from "@/features/admin-inbox/types";

export const CANAUX_SOURCES_DEVIS: ReadonlyArray<InboxChannel> = ["appel", "message"];

/**
 * Natures de demande qui peuvent devenir un devis (clés techniques de `InboxItem.nature`) :
 * types unifiés des messages, types de base sans type unifié, types de rendez-vous.
 */
export const NATURES_GARDEES: ReadonlyArray<string> = [
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  "simulateur_roi",
  "contact",
  "quote_request",
  "intervention",
  "diagnostic",
  "echange_projet",
];

/** Natures écartées : pas un client potentiel d'un devis. Toute nature inconnue l'est aussi. */
export const NATURES_EXCLUES: ReadonlyArray<string> = [
  "apporteur",
  "recrutement",
  "presse",
  "partenariat",
  "speaker",
  "investisseur",
  "support_client",
  "autre",
  "salon",
  "tour_de_france_ia",
];

export interface SourcePourQui {
  clientId: string | null;
  libelle: string;
  detail: string;
  lien: string;
}

interface ClientMinimal {
  id: string;
}

function norme(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * @param clients Map issue de `clientsParEmail` (clé : e-mail en minuscules).
 * @param recherche Texte libre ; vide = tout.
 */
export function sourcesPourQui(
  items: ReadonlyArray<InboxItem>,
  clients: ReadonlyMap<string, ClientMinimal>,
  recherche: string,
): SourcePourQui[] {
  const q = norme(recherche.trim());
  const out: SourcePourQui[] = [];
  for (const it of items) {
    if (!CANAUX_SOURCES_DEVIS.includes(it.channel)) continue;
    // Une ligne sans nature, ou d'une nature non classée, n'est jamais proposée.
    if (it.nature === undefined || !NATURES_GARDEES.includes(it.nature)) continue;
    if (q !== "") {
      const meule = norme(
        [it.contactName, it.contactEmail, it.context, it.subject].filter(Boolean).join(" "),
      );
      if (!meule.includes(q)) continue;
    }
    const cle = it.contactEmail?.trim().toLowerCase();
    const client = cle ? clients.get(cle) : undefined;
    out.push({
      clientId: client?.id ?? null,
      libelle: it.contactName ?? it.context ?? it.subject,
      detail: [it.subject, it.context, it.statusLabel].filter(Boolean).join(" · "),
      lien: it.detailHref,
    });
  }
  return out;
}

/** Le client choisi d'abord, puis l'ordre d'arrivée ; au plus `max` lignes. */
export function ordonnerSources(
  sources: ReadonlyArray<SourcePourQui>,
  clientId: string | null | undefined,
  max = 10,
): SourcePourQui[] {
  const choisies = clientId ? sources.filter((s) => s.clientId === clientId) : [];
  const autres = clientId ? sources.filter((s) => s.clientId !== clientId) : [...sources];
  return [...choisies, ...autres].slice(0, max);
}
