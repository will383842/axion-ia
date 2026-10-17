// @vitest-environment node

/**
 * « Mon dossier » — la demande de changement d'IBAN (préalable de `passage_paiement`).
 *
 * 🔴 IDOR : la fiche est TOUJOURS celle de la session de l'espace ; un identifiant
 * glissé dans le formulaire est ignoré. Le RIB joint part avec la demande. L'IBAN
 * saisi ne revient jamais dans l'adresse.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => vi.fn());
const demander = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/formateur/guard", () => ({ getFormateurSession: session }));
vi.mock("@/server/qualiopi/formateurs-independants/changements-coordonnees", async (orig) => ({
  ...(await orig<object>()),
  demanderChangementIbanAvecRib: demander,
}));
vi.mock("@/server/qualiopi/formateurs-independants/mon-dossier", () => ({
  deposerDepuisMonDossier: vi.fn(),
  MESSAGES_MON_DOSSIER: { indisponible: "x", type: "y" },
}));
vi.mock("@/server/qualiopi/formateurs-independants/numero-declaration-espace", () => ({
  transmettreNumeroDeclaration: vi.fn(),
  MESSAGES_NDA_ESPACE: {},
}));

import { MESSAGES_CHANGEMENT } from "@/server/qualiopi/formateurs-independants/changements-coordonnees";

import { demanderChangementIbanAction } from "../actions";

const MOI = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const AUTRE = "44444444-4444-4444-8444-444444444444";
const IBAN = "FR7630006000011234567890189";

function formulaire(avecRib = true): FormData {
  const f = new FormData();
  f.set("iban", IBAN);
  f.set("trainerId", AUTRE);
  if (avecRib) f.set("rib", new File([new Uint8Array([1, 2, 3])], "rib.pdf"));
  return f;
}

async function issue(f: FormData): Promise<string> {
  try {
    await demanderChangementIbanAction(f);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("pas de redirection");
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ trainerId: MOI });
  demander.mockResolvedValue({ ok: true });
});

describe("demande d'IBAN depuis l'espace", () => {
  it("sans session : renvoyé à la connexion, rien n'est demandé", async () => {
    session.mockResolvedValue(null);
    expect(await issue(formulaire())).toMatch(/^REDIRECT:/);
    expect(demander).not.toHaveBeenCalled();
  });

  it("🔴 IDOR — la fiche est celle de la session, jamais celle du formulaire", async () => {
    expect(await issue(formulaire())).toMatch(/issue=demande$/);
    expect(demander).toHaveBeenCalledTimes(1);
    const [trainerId, iban, rib] = demander.mock.calls[0]!;
    expect(trainerId).toBe(MOI);
    expect(iban).toBe(IBAN);
    expect(rib).toMatchObject({ nomFichier: "rib.pdf" });
    expect(Array.from((rib as { octets: Uint8Array }).octets)).toEqual([1, 2, 3]);
  });

  it("sans fichier : le service reçoit « pas de RIB » et l'issue le dit", async () => {
    demander.mockResolvedValue({ ok: false, message: MESSAGES_CHANGEMENT.ribManquant });
    const url = await issue(formulaire(false));
    expect(demander.mock.calls[0]![2]).toBeNull();
    expect(url).toMatch(/issue=changement_ribManquant$/);
  });

  it("l'IBAN ne revient jamais dans l'adresse", async () => {
    demander.mockResolvedValue({ ok: false, message: MESSAGES_CHANGEMENT.ibanInvalide });
    expect(await issue(formulaire())).not.toMatch(/FR76|7890189/);
  });
});
