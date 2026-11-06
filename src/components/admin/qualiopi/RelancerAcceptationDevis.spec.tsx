/**
 * Deux alertes DISTINCTES : « acceptation non enregistrée » et « plans non proposés ».
 * Le second ne parle ni d'acceptation manquante, ni de plan à créer à la main.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { RelancerAcceptationDevis } from "./RelancerAcceptationDevis";

const rendre = (cas: "acceptation" | "plans") =>
  renderToStaticMarkup(
    <RelancerAcceptationDevis
      cas={cas}
      documentGenereId="d"
      relancerAction={async () => ({ ok: true, devisAcceptes: 1 })}
    />,
  );

describe("RelancerAcceptationDevis", () => {
  it("cas « acceptation » : texte d'acceptation non enregistrée", () => {
    const html = rendre("acceptation");
    expect(html).toContain("acceptation n&#x27;a pas été enregistrée");
    expect(html).toContain("Relancer l&#x27;acceptation");
  });

  it("cas « plans » : texte exact, bouton « Relancer la proposition des plans », rien à créer à la main", () => {
    const html = rendre("plans");
    expect(html).toContain("plans récurrents attendus n&#x27;ont pas été proposés");
    expect(html).toContain("Relancer la proposition des plans");
    expect(html).not.toContain("aucune formule retenue");
    expect(html).not.toContain("acceptation n&#x27;a pas été enregistrée");
    expect(html).not.toContain("à la main");
  });
});
