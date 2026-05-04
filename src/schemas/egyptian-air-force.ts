import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "egyptian-air-force",
  name: "Egyptian Air Force",
  description: "Echelon schema for the Egyptian Air Force (Al-Qūwāt al-Gawwīyä al-Miṣrīyä). Based on publicly available information.",
  echelons: [
    { label: "Air Force", slug: "eaf", level: 10, personnelDefault: 100000 },
    { label: "Air Fleet", slug: "flt", level: 9, personnelDefault: 40000 },
    { label: "Air Division", slug: "adiv", level: 8, personnelDefault: 14000 },
    { label: "Air Wing", slug: "wg", level: 7, personnelDefault: 3500 },
    { label: "Air Brigade", slug: "abde", level: 7, personnelDefault: 3500 },
    { label: "Squadron", slug: "sq", level: 6, personnelDefault: 500 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Detachment", slug: "det", level: 3, personnelDefault: 25 },
  ],
};

export default schema;
