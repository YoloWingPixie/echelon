import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "gdr-lsklv",
  name: "GDR LSK/LV",
  description: "Luftstreitkräfte/Luftverteidigung (LSK/LV) — NVA Air Force and Air Defense",
  echelons: [
    { label: "Kommando LSK/LV", slug: "kdo", level: 10, personnelDefault: 35000 },
    { label: "Luftverteidigungsdivision", slug: "lvd", level: 8, personnelDefault: 12000 },
    { label: "Fla-Raketenbrigade", slug: "frbr", level: 7, personnelDefault: 3000 },
    { label: "Jagdfliegergeschwader", slug: "jg", level: 7, personnelDefault: 1500 },
    { label: "Fla-Raketenregiment", slug: "frr", level: 7, personnelDefault: 2500 },
    { label: "Fla-Raketenabteilung", slug: "fra", level: 6, personnelDefault: 250 },
    { label: "Staffel", slug: "st", level: 5, personnelDefault: 120 },
    { label: "Startbatterie", slug: "sbtr", level: 5, personnelDefault: 80 },
    { label: "Kette", slug: "kt", level: 4, personnelDefault: 30 },
    { label: "Zug", slug: "zug", level: 4, personnelDefault: 25 },
  ],
};

export default schema;
