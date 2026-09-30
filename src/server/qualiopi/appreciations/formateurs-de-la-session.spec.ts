import { describe, it, expect } from "vitest";

import { formateursDeLaSession } from "./formateurs-de-la-session";

describe("formateursDeLaSession", () => {
  it("réunit le formateur principal, les affectés et ceux qui ont tenu une journée, sans doublon", () => {
    const ids = formateursDeLaSession({
      formateurPrincipalId: "a",
      sessionFormateurs: [{ trainerId: "a" }, { trainerId: "b" }],
      jours: [{ trainerId: "c" }, { trainerId: null }, { trainerId: "b" }],
    });
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });

  it("une session sans aucun formateur n'en désigne aucun", () => {
    expect(
      formateursDeLaSession({ formateurPrincipalId: null, sessionFormateurs: [], jours: [] }),
    ).toEqual([]);
  });
});
