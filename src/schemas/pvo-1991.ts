import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "pvo-1991",
  name: "PVO (Air Defense Forces), 1991",
  description: "Standard PVO organizational structure",
  // Slugs follow the russian-transliterated convention used by
  // soviet-vvs-1991 and russian-navy (apvo = armiya PVO, zrp = zenitno-
  // raketnyi polk, zrdn = zenitno-raketnyi divizion, etc.) rather than
  // generic English abbreviations.
  echelons: [
    { label: "Air Defense Army", slug: "apvo", level: 11, personnelDefault: 500000 },
    { label: "District", slug: "okr", level: 10, personnelDefault: 100000 },
    { label: "Corps", slug: "kpvo", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "dpvo", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "brig", level: 7, personnelDefault: 3500 },
    { label: "Regiment", slug: "zrp", level: 7, personnelDefault: 3500 },
    { label: "Battalion", slug: "zrdn", level: 6, personnelDefault: 500 },
    { label: "Squadron", slug: "ae", level: 6, personnelDefault: 500 },
    // Independent Battery (otdel'naya batareya) reports directly to a
    // regiment or higher without a battalion in between, so it sits at
    // battalion level rather than standard battery level.
    { label: "Independent Battery", slug: "obatr", level: 6, personnelDefault: 150 },
    { label: "Company", slug: "rota", level: 5, personnelDefault: 130 },
    { label: "Battery", slug: "zrbatr", level: 5, personnelDefault: 130 },
    { label: "Flight", slug: "zveno", level: 4, personnelDefault: 35 },
    { label: "Platoon", slug: "vzvod", level: 4, personnelDefault: 35 },
    { label: "Section", slug: "sec", level: 3, personnelDefault: 25 },
    { label: "Squad", slug: "otd", level: 2, personnelDefault: 10 },
  ],
};

export default schema;
