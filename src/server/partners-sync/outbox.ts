/**
 * outbox.ts — l'écriture d'un événement destiné à Axion Partners, DANS la transaction métier
 * (INT-T02, REQ-INT-001, partners/ADR-0022 point 15).
 *
 * ── Pourquoi DANS la transaction, quand le canal CRM écrit APRÈS ─────────────────────────────
 * `crm-sync/enqueue.ts` écrit après le commit, et il a raison pour lui : un lead perdu à cause de
 * la synchro est pire qu'un événement manquant, que la réconciliation rattrape. Ici l'arbitrage
 * s'inverse. Un événement perdu, c'est une COMMISSION due à un tiers et jamais calculée ; un
 * événement émis pour une écriture annulée, c'est une commission versée à tort. La seule forme
 * qui ne perd ni ne duplique est la ligne écrite par la même transaction que le fait : un retour
 * arrière n'en laisse aucune, une validation en laisse exactement une.
 *
 * Conséquence assumée : si l'insertion échoue, l'écriture métier échoue avec elle. C'est voulu,
 * et c'est pourquoi rien ici ne lève pour une raison évitable :
 *   · un doublon (le même fait écrit deux fois) passe par `ON CONFLICT DO NOTHING`
 *     (`skipDuplicates`) — une violation d'unicité attrapée en JS laisserait la transaction
 *     Postgres AVORTÉE, et toutes les instructions suivantes de l'appelant échoueraient ;
 *   · un type hors contrat lève AVANT d'écrire : c'est une faute de programmation, visible dès le
 *     premier essai en développement, jamais une panne de production.
 *
 * ── Inertie ──────────────────────────────────────────────────────────────────────────────────
 * Verrou fermé (drapeau absent, ou build) : rien n'est validé, rien n'est écrit, `null` est rendu.
 * Le comportement du site est alors strictement celui d'avant ce module — y compris pour un
 * appelant fautif, qui ne casse rien tant que le canal est fermé.
 */
import { PRODUCTEUR } from "@/server/partners/config";
import { SCHEMA_VERSION, TYPES_EVENEMENT, estDansLeContratV1 } from "@/server/partners/contrat";
import { identifiantEvenement } from "@/server/partners/enveloppe";

import { canalPartnersOuvert } from "./config";

/** Un refus définitif, dit comme le récepteur le dirait : 422. */
export class EvenementHorsContrat extends Error {
  readonly statut = 422 as const;

  constructor(message: string) {
    super(message);
    this.name = "EvenementHorsContrat";
  }
}

export type FaitPartners = {
  /** Un nom de `TYPES_EVENEMENT` (contrat publié par Partners, copié par INT-T01b). */
  readonly type: string;
  /** Ce qui identifie le FAIT, pas l'appel : deux écritures du même fait → un seul `event_id`. */
  readonly cleDeFait: string;
  readonly occurredAt: Date;
  /** `{ <espace>_id: "<id>" }` — la forme que le récepteur met à plat. */
  readonly sujet: unknown;
  /** Construit par `src/server/partners/payloads.ts`, jamais à la main. */
  readonly payload: Record<string, unknown>;
};

/**
 * Le client accepté : un client de TRANSACTION. Typé structurellement (les tests passent un faux),
 * `createMany` en syntaxe de méthode pour rester bivariant face aux génériques de Prisma — même
 * raison que `CrmOutboxWriter`.
 */
export interface EcrivainOutboxPartners {
  partnersSyncOutbox: {
    createMany(args: {
      data: {
        eventId: string;
        eventType: string;
        subjectRef: string;
        corps: string;
      }[];
      skipDuplicates: boolean;
    }): PromiseLike<{ count: number }>;
  };
}

const SUJET_MAX = 180;

/**
 * Le sujet mis à plat : `{ client_id: "<id>" }` → `client:<id>`. C'est la règle EXACTE du
 * récepteur (`sujetRefDe`, axion-apporteurs `src/server/integrations/axionia/reception.ts`) : les
 * deux côtés indexent le même texte. Toute autre forme est refusée ici, car la colonne est
 * obligatoire et une référence inventée réveillerait le mauvais dossier.
 */
export function aplatirSujet(sujet: unknown): string {
  if (sujet !== null && typeof sujet === "object" && !Array.isArray(sujet)) {
    const entrees = Object.entries(sujet as Record<string, unknown>);
    if (entrees.length === 1) {
      const [cle, valeur] = entrees[0] as [string, unknown];
      const espace = /^([a-z][a-z_]*)_id$/.exec(cle)?.[1];
      if (espace !== undefined && typeof valeur === "string" && valeur !== "") {
        const ref = `${espace}:${valeur}`;
        if (ref.length <= SUJET_MAX) return ref;
      }
    }
  }
  throw new EvenementHorsContrat(
    "[partners-sync] sujet illisible : attendu un objet à UNE clé `<espace>_id` et une valeur " +
      `non vide (≤ ${SUJET_MAX} caractères une fois mis à plat).`,
  );
}

/**
 * Le BROUILLON du corps : l'enveloppe complète, dans l'ordre du contrat, avec `emitted_at` et
 * `sequence` encore nuls. Ils ne sont connus qu'au premier envoi — la séquence parce qu'elle est
 * posée par le relais sous verrou (jamais ici, où l'ordre de validation diffère de l'ordre des
 * numéros), l'instant d'émission par définition.
 */
function brouillonDeCorps(fait: FaitPartners, eventId: string, sujet: unknown): string {
  return JSON.stringify({
    event_id: eventId,
    event_type: fait.type,
    schema_version: SCHEMA_VERSION,
    occurred_at: fait.occurredAt.toISOString(),
    emitted_at: null,
    producer: PRODUCTEUR,
    subject_ref: sujet,
    sequence: null,
    payload: fait.payload,
  });
}

/**
 * Le corps DÉFINITIF : le brouillon, `sequence` et `emitted_at` posés. Appelé une seule fois par
 * ligne, par le relais, dans la transaction qui pose la séquence ; ensuite le texte est FIGÉ, et
 * c'est lui — jamais un objet re-sérialisé — qui est signé, transmis et relu.
 *
 * `JSON.parse` puis `JSON.stringify` rendent le même ordre de clés que la sérialisation d'origine
 * (les clés entières d'abord, puis l'ordre d'insertion — déjà appliqué au brouillon) : la fonction
 * est idempotente, le test le vérifie.
 */
export function finaliserCorps(brouillon: string, sequence: bigint, emisLe: Date): string {
  const env = JSON.parse(brouillon) as Record<string, unknown>;
  const numero = Number(sequence);
  if (!Number.isSafeInteger(numero) || numero < 1) {
    throw new Error(`[partners-sync] séquence hors bornes : ${sequence.toString()}`);
  }
  if (env.emitted_at === null) env.emitted_at = emisLe.toISOString();
  env.sequence = numero;
  return JSON.stringify(env);
}

/**
 * Écrit l'événement dans la file de sortie, dans la transaction `tx`.
 *
 * Rend l'`event_id` (déterministe), ou `null` si le canal est fermé. Lève `EvenementHorsContrat`
 * (422) pour un type hors du contrat ou un sujet illisible, et lève si on lui passe le client
 * GLOBAL : hors transaction, un retour arrière métier ne l'effacerait pas.
 */
export async function ecrireEvenementPartners(
  tx: EcrivainOutboxPartners,
  fait: FaitPartners,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  if (!estDansLeContratV1(fait.type)) {
    throw new EvenementHorsContrat(
      `[partners-sync] « ${fait.type} » n'est pas dans le contrat (${TYPES_EVENEMENT.join(", ")}).`,
    );
  }
  if ("$transaction" in (tx as object)) {
    throw new Error(
      "[partners-sync] ecrireEvenementPartners exige le client d'une transaction " +
        "(`prisma.$transaction(async (tx) => …)`) : hors transaction, un retour arrière métier " +
        "laisserait l'événement derrière lui (REQ-INT-001).",
    );
  }

  const subjectRef = aplatirSujet(fait.sujet);
  const eventId = identifiantEvenement(fait.type, fait.cleDeFait);

  await tx.partnersSyncOutbox.createMany({
    data: [
      {
        eventId,
        eventType: fait.type,
        subjectRef,
        corps: brouillonDeCorps(fait, eventId, fait.sujet),
      },
    ],
    skipDuplicates: true,
  });

  return eventId;
}
