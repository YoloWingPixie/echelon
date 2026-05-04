import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "gdr-lsklv",
  name: "GDR LSK/LV",
  description: "Luftstreitkräfte/Luftverteidigung (LSK/LV) — NVA Air Force and Air Defense",
  group: "East Germany",
  echelons: [
    { label: "Kommando LSK/LV (Air Force/Air Defense Command)", slug: "kdo", level: 10, personnelDefault: 35000 },
    { label: "Luftverteidigungsdivision (Air Defense Division)", slug: "lvd", level: 8, personnelDefault: 12000 },
    { label: "Fla-Raketenbrigade (SAM Brigade)", slug: "frbr", level: 7, personnelDefault: 3000 },
    { label: "Jagdfliegergeschwader (Fighter Wing)", slug: "jg", level: 7, personnelDefault: 1500 },
    { label: "Fla-Raketenregiment (SAM Regiment)", slug: "frr", level: 7, personnelDefault: 2500 },
    { label: "Fla-Raketenabteilung (SAM Battalion)", slug: "fra", level: 6, personnelDefault: 250 },
    { label: "Staffel (Squadron)", slug: "st", level: 5, personnelDefault: 120 },
    { label: "Startbatterie (Launch Battery)", slug: "sbtr", level: 5, personnelDefault: 80 },
    { label: "Kette (Flight)", slug: "kt", level: 4, personnelDefault: 30 },
    { label: "Zug (Platoon)", slug: "zug", level: 4, personnelDefault: 25 },
  ],
};

export default schema;
