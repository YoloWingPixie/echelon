import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "gdr-luftstreitkraefte",
  name: "GDR Luftstreitkräfte",
  description: "Luftstreitkräfte der NVA — East German Air Force flying units",
  group: "East Germany",
  echelons: [
    { label: "Kommando LSK/LV (Air Force/Air Defense Command)", slug: "kdo", level: 10, personnelDefault: 35000 },
    { label: "Führungsorgan FMTFK (Front Aviation Command)", slug: "fmtfk", level: 9, personnelDefault: 8000 },
    { label: "Luftverteidigungsdivision (Air Defense Division)", slug: "lvd", level: 8, personnelDefault: 12000 },
    { label: "Jagdfliegergeschwader (Fighter Wing)", slug: "jg", level: 7, personnelDefault: 1500 },
    { label: "Jagdbombergeschwader (Fighter-Bomber Wing)", slug: "jbg", level: 7, personnelDefault: 1500 },
    { label: "Marinefliegergeschwader (Naval Aviation Wing)", slug: "mfg", level: 7, personnelDefault: 1200 },
    { label: "Hubschraubergeschwader (Helicopter Wing)", slug: "hg", level: 7, personnelDefault: 1200 },
    { label: "Transportfliegergeschwader (Transport Wing)", slug: "tg", level: 7, personnelDefault: 1000 },
    { label: "Fliegertechnisches Bataillon (Flight Technical Bn)", slug: "ftb", level: 6, personnelDefault: 400 },
    { label: "Staffel (Squadron)", slug: "st", level: 5, personnelDefault: 120 },
    { label: "Kette (Flight)", slug: "kt", level: 4, personnelDefault: 30 },
    { label: "Schwarm (Element)", slug: "schw", level: 2, personnelDefault: 8 },
  ],
};

export default schema;
