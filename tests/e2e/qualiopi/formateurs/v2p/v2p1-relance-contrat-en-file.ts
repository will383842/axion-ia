// V2P1 — Relance du contrat-cadre (F18) DÉJÀ EN FILE quand la raison de relancer
// disparaît : le formateur signe, il répond, sa collaboration prend fin, ou la
// direction coupe `relances_auto`.
//
// Parcours : un contrat-cadre préparé, son lien F16 parti il y a 5 jours (pièce et
// journal posés en base, comme la console les laisse) ; le VRAI passage des
// campagnes (`passerCampagnes`, registre réel restreint aux fiches du scénario)
// décide F18 « J+3 » et l'enfile. La boîte est SATURÉE (40 envois dans l'heure :
// `saturerLaBoite`) : F18 attend dans la file, comme en production quand le quota
// est épuisé. Pendant l'attente, l'événement d'arrêt arrive. À la levée du bridage,
// le worker relit l'état au départ (`relecture-au-depart.ts`) : on observe ce qu'il
// fait de F18 (`sent` ou `cancelled` et son motif).

import {
  approuverEmailAction,
  definirReglageEmailAction,
} from "@/server/actions/qualiopi/email-outbox";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

import {
  aNettoyer,
  basculer,
  creerAdmin,
  dansLaFenetre,
  effacerOpposition,
  formateurAvecContrat,
  lignesCloses,
  menage,
  prisma,
  remettreInterrupteurs,
  saturerLaBoite,
  seConnecter,
  type LigneEnvoi,
} from "./outils";

const BRIDAGE_MS = 20_000;

const formateurAvecContratEnAttente = () => formateurAvecContrat("formateur-contrat-a-signer", 5);

type Cas =
  "temoin" | "signe" | "repond" | "oppose" | "fin-collaboration" | "relances-coupees" | "corbeille";

export interface ObservationsV2p1 {
  readonly adresses: string[];
  readonly passages: Array<{ envoyes: number; gares: number; campagnesActives: number }>;
  readonly coupure: { ok: boolean };
  readonly regle: { ok: boolean };
  readonly approbation: { ok: boolean };
  /** Par cas : les lignes F18 du journal une fois le worker passé. */
  readonly f18: Record<Cas, LigneEnvoi[]>;
}

export default async function v2p1(): Promise<ObservationsV2p1> {
  try {
    const direction = await creerAdmin("super_admin");
    const fiches = {
      temoin: await formateurAvecContratEnAttente(),
      signe: await formateurAvecContratEnAttente(),
      repond: await formateurAvecContratEnAttente(),
      oppose: await formateurAvecContratEnAttente(),
      "fin-collaboration": await formateurAvecContratEnAttente(),
      "relances-coupees": await formateurAvecContratEnAttente(),
      corbeille: await formateurAvecContratEnAttente(),
    } as const;
    const ids = (cas: readonly Cas[]) => new Set(cas.map((c) => fiches[c].id));
    // La campagne RÉELLE du registre, restreinte aux fiches du scénario (rien n'est
    // envoyé aux autres).
    const contrat = REGISTRE_CAMPAGNES.find((c) => c.id === "contrat-relance");
    if (contrat === undefined) throw new Error("banc : campagne F18 absente du registre");
    const passage = (miennes: ReadonlySet<string>) =>
      passerCampagnes(dansLaFenetre(), {
        registre: [
          {
            ...contrat,
            lireFaits: async (m: Date) =>
              (await contrat.lireFaits(m)).filter((f) => miennes.has(f.entityId)),
          },
        ],
      });
    const f18 = (cas: Cas) =>
      lignesCloses(fiches[cas].email, 2).then((l) =>
        l.filter((x) => x.template === "formateur-contrat-relance"),
      );
    const signer = (cas: Cas) =>
      prisma.documentGenere.update({
        where: { id: fiches[cas].documentId },
        data: { statutSignature: "signee" },
      });

    // ── 1er tour : la boîte est pleine, F18 part en file pour cinq fiches ───
    await saturerLaBoite(BRIDAGE_MS);
    const p1 = await passage(ids(["temoin", "signe", "repond", "oppose", "fin-collaboration"]));
    // Pendant l'attente : l'un signe, l'autre répond (« J'ai répondu ailleurs »), un
    // troisième clique « ne plus recevoir », la collaboration du dernier prend fin.
    await signer("signe");
    await prisma.reponseEntranteFormateur.create({
      data: {
        trainerId: fiches.repond.id,
        source: "hors_circuit",
        recuLe: new Date(),
        auto: false,
        auteurId: direction.id,
      },
    });
    await enregistrerOppositionPourAdresse(fiches.oppose.email, {
      origine: "lien-desinscription",
    });
    aNettoyer(() => effacerOpposition(fiches.oppose.email));
    await prisma.trainer.update({
      where: { id: fiches["fin-collaboration"].id },
      data: {
        finCollaborationAt: new Date(),
        finCollaborationMotif: "initiative_formateur",
      } as never,
    });
    const tour1 = {
      temoin: await f18("temoin"),
      signe: await f18("signe"),
      repond: await f18("repond"),
      oppose: await f18("oppose"),
      "fin-collaboration": await f18("fin-collaboration"),
    };

    // ── 2e tour : F18 en file, la direction coupe `relances_auto` ──────────
    await saturerLaBoite(BRIDAGE_MS);
    const p2 = await passage(ids(["relances-coupees"]));
    const coupure = await basculer(direction, "relances_auto", false);
    const coupees = await f18("relances-coupees");
    await remettreInterrupteurs();

    // ── 3e tour : F18 garé en corbeille (règle « à valider » qui le nomme),
    //    le contrat est signé, puis la direction approuve l'e-mail en retard ──
    seConnecter(direction);
    const regle = await definirReglageEmailAction({
      scope: "global",
      template: "formateur-contrat-relance",
      mode: "validation",
    });
    const idRegle = "data" in regle ? regle.data?.id : undefined;
    aNettoyer(() => prisma.emailAutomationSetting.deleteMany({ where: { id: idRegle ?? "∅" } }));
    const p3 = await passage(ids(["corbeille"]));
    await prisma.emailAutomationSetting.deleteMany({ where: { id: idRegle ?? "∅" } });
    await signer("corbeille");
    const garee = await prisma.emailOutbox.findFirst({
      where: { entityId: fiches.corbeille.id, template: "formateur-contrat-relance" },
      select: { id: true },
    });
    seConnecter(direction);
    const approbation = garee ? await approuverEmailAction({ id: garee.id }) : { error: "rien" };
    const corbeille = await f18("corbeille");

    await prisma.reponseEntranteFormateur.deleteMany({ where: { trainerId: fiches.repond.id } });
    return {
      adresses: Object.values(fiches).map((f) => f.email),
      passages: [p1, p2, p3].map((p) => ({
        envoyes: p.envoyes,
        gares: p.gares,
        campagnesActives: p.campagnesActives,
      })),
      coupure: { ok: coupure.ok },
      regle: { ok: idRegle !== undefined },
      approbation: { ok: !("error" in approbation) },
      f18: { ...tour1, "relances-coupees": coupees, corbeille },
    };
  } finally {
    await remettreInterrupteurs();
    await menage();
  }
}
