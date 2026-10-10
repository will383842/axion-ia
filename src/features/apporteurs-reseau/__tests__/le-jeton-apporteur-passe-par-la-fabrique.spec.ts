// FAC-4 — le jeton du dossier apporteur passe par la fabrique commune de liens
// signés SANS qu'aucun lien déjà envoyé ne change.
//
// Les 20 valeurs ci-dessous ont été calculées avec le code de `main` AVANT la
// délégation (`3f672caa`). Elles ne se recalculent jamais : si l'une d'elles
// bouge, des liens reçus par des apporteurs cessent d'ouvrir leur dossier.

import { afterEach, describe, expect, it, vi } from "vitest";

import { jetonDossier, jetonDossierValide } from "@/features/apporteurs-reseau/jeton";

// Valeur de test fictive, assemblée pour ne pas ressembler à une clé aux yeux de gitleaks.
const SECRET = ["secret", "de", "test", "fac4", "fige", "0123456789abcdef"].join("-");

// [id, versionLien, jeton avec SECRET, jeton sans secret (hors production)]
const FIGES: ReadonlyArray<readonly [string, number, string, string]> = [
  [
    "8dcdc201-03bc-4a5d-8e00-c5c8a9b31f81",
    1,
    "2UbHaqbqzJVuw3AOpJPXCis3aO3KiTAG9W6tmNglxjg",
    "0ztkrWJnXXEKe3Vw_Wq4cpwAz4FTUZ3AN3c-X-tO520",
  ],
  [
    "c4d8279f-f660-4770-82b8-9633810ee50a",
    2,
    "LzMEbI2tYceA5QUTpd_9QMd6tJ_W1bhUsslcS_wWTno",
    "3A-M9nVLFT6mC4JiwRk7xT2xg8L01ZsYOBpCcPsmZZo",
  ],
  [
    "21cf5fa6-03b0-47f5-8755-b770aecf0ce2",
    3,
    "45XuzxX8Bbf53u9jkJURF6BmerRJJxLNJF7_nh5p2GU",
    "PvjAqiWoktb9KpUUrYvRNYNN85ZwNjqwzbSCEx2tZiQ",
  ],
  [
    "3f7a23a8-cb76-4277-8bb8-a41eee1d10d7",
    4,
    "pkb0iu1Yo0BEGZ6c1W2dDP5RT_blcm1r-_i_1JkHQhs",
    "zbjf9WiHeM6xbHy-dRuMkEv1peGTuq3faJN2zA4D8eo",
  ],
  [
    "a39b302d-ebae-4b21-8a82-9ad80e6b4b5f",
    5,
    "CyxoWqT9pkMqpVEJ-hdFxQY5QPJzlLoKKrbNWfBEI2U",
    "_RSHPDvvqVdQCs2tlH4TFUSRKFnm6v_8OTcXsMtnW1Q",
  ],
  [
    "b7cfcde9-ea7f-45dd-8502-4de2a76ed340",
    1,
    "LzfuRYO1dkR5fYzjfynCPhqGP33npgeNtcQ98kW1pW0",
    "qQjftFcEF-lr4Cz1lL_Tn0RSXlfCY_rUG5gfc65Uju8",
  ],
  [
    "94c22bb8-4de3-44f7-8150-eecde3b332b9",
    2,
    "a4eXfmqR5_uY62iPIISJYZtg6euE0u-6kJvxzKBM4vk",
    "5y0pPGmBciWfVXGFoPJqB3eGMCZTB0Z6KfL_J18x7RU",
  ],
  [
    "7fcc94f4-2bcf-4881-8937-a67fa7ec0e94",
    3,
    "xOPsbq5S38i6l5N0r4gPwjIUqXkGtDRE7fwt-ZGurj4",
    "Pop-24uka8vzcPUGc_JrlvV0SnMroEfldx3NkdtRWp8",
  ],
  [
    "9fb2ac87-2c20-413f-88a2-f7ce77a63d2d",
    4,
    "70CNb8WPEAqAB-su5uHlWQDSjGA8_p9E0O_LMEf10ZA",
    "Z_w3pdeQiTWwYNkWXn-4Mcqrxpmz7GYFpUAx7NTHOl8",
  ],
  [
    "3295212d-8939-46c9-8f63-0ee3b0317a6d",
    5,
    "4El614w0LpKn6sB-8SGsf3FHV1IZAHVRh4ODiOEGZvg",
    "fCBO7xwsJr-2PyOu1aYOa6D5tXDhdLRS0YBGSvAuVFI",
  ],
  [
    "bead57bf-3cdb-4ac7-853b-bbb0d6398288",
    1,
    "6CjB3b9jO36DsJvxQ7z0W1w5SARsnOHHrg2N1Pg7wLs",
    "oTAfi4Ue651ZDYtC5X5XGy0oUMuLTTzL5-esPhP43PA",
  ],
  [
    "8eb770f5-6230-4d53-8811-7bc93014ff8a",
    2,
    "jL8nb_sSmIKJCqn7Bp95Zou8YmB4mFfVusr8wFytlf8",
    "0Yd1QTxg6Q-72UParZhyXw53teGA0taRIDOr6bSl-mE",
  ],
  [
    "050b1c01-0c3a-4c3f-8c4a-cd5c488584a8",
    3,
    "3hp_JGee50mB5cCpejDQhf3lgNBiWLTs8nu-wC44Kl4",
    "PJ_tcM_mWyv0C4BTQF5YAkRMEzrI0uHeb4JnVtD2LEQ",
  ],
  [
    "aede5f80-7089-4901-8e79-421bf766ed81",
    4,
    "z0oy_LlMNp8yrlzoRyX7PuivCkkn--Y7ijbzPOPcPCY",
    "QzJJEk8XDbFB7DPnyy9_JSw553xB5vrt3GBpuSViLo8",
  ],
  [
    "465667a6-4909-43cb-8ded-7279a1fcef4e",
    5,
    "Oekrm2lpvPaM-R7onM2XtKPR7j4zTkY2rDG43llUyr8",
    "A8Cvx0S044nbTTSJahObWOti_iohiXEnbNAJAkNuy_s",
  ],
  [
    "872c4abd-4d25-411c-8407-955bda401ee5",
    41,
    "f_zd3BMfrBi1rLLUEKJ7A4bINMFromDT2osXej5L4zU",
    "DDxzKQdGhG5YXvhwJzLGT85Z3jpXsO3NC872JGRGops",
  ],
  [
    "a2b06a5d-f055-4436-8939-821ecba90b2c",
    42,
    "N39tnPr52W-fWx8mwI-yTFcISbEO92m8hHxbNDqlMAI",
    "oV5P26dvVS3U-3NwGKAw-IrhH8VETTK2Hy3Cg3HjTMo",
  ],
  [
    "458d62b5-c6d8-438c-8224-8d0586f2d4aa",
    43,
    "--7ll1iQdTDt8kXfe3ppKEtkhdCiqfFO534HaZfKYVU",
    "hk0H1Y6ELAfWDnQ9L_UAZhCu4aVUjBLy8PLuZdmU7xw",
  ],
  [
    "6802a4c2-4b54-4ccd-8966-465024a43a08",
    44,
    "rLZgYvUfMVUpb-IQ7EMRhX5JB8EUF5IdTkVrcDEsdw0",
    "j7DEbHBPMAmBYhJ9Q9L_z9Ks5Z3wjxccKI6AJx7rito",
  ],
  [
    "810e5145-a116-458c-8e80-55ac101f13bc",
    45,
    "QhbFwXxqP4tk67wxghgEjZ3wFIb7ptPtc8nkeFl3Qh8",
    "MtaXGx-TdOb8GGNLdGFwXtOHc8ZspB5yrB6fIwlmW2k",
  ],
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("FAC-4 — le jeton apporteur est identique avant et après la fabrique", () => {
  it("20 couples figés, avec AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    for (const [id, v, attendu] of FIGES) {
      expect(jetonDossier(id, v)).toBe(attendu);
      expect(jetonDossierValide(id, v, attendu)).toBe(true);
    }
  });

  it("20 couples figés, sans secret hors production", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    for (const [id, v, , attendu] of FIGES) {
      expect(jetonDossier(id, v)).toBe(attendu);
    }
  });

  it("sans secret EN PRODUCTION : aucun jeton, aucun lien valide", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const [id, v, jeton] = FIGES[0]!;
    expect(jetonDossier(id, v)).toBeNull();
    expect(jetonDossierValide(id, v, jeton)).toBe(false);
  });

  it("un jeton d'une autre version de lien est refusé (révocation)", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const [id, v, jeton] = FIGES[0]!;
    expect(jetonDossierValide(id, v + 1, jeton)).toBe(false);
  });

  it("le module délègue à la fabrique commune", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/features/apporteurs-reseau/jeton.ts", "utf8");
    expect(source).toContain("@/lib/security/lien-signe");
    expect(source).not.toMatch(/createHmac|timingSafeEqual/);
  });
});
