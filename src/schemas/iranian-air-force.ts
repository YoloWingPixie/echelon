import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "iranian-air-force",
  name: "Iranian Air Force (IRIAF)",
  description: "Islamic Republic of Iran Air Force",
  echelons: [
    { label: "Air Command", slug: "acmd", level: 10, personnelDefault: 37000 },
    { label: "Tactical Air Base", slug: "tab", level: 7, personnelDefault: 2500 },
    { label: "Wing", slug: "wg", level: 7, personnelDefault: 1500 },
    { label: "Squadron", slug: "sqn", level: 6, personnelDefault: 250 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Detachment", slug: "det", level: 3, personnelDefault: 15 },
  ],
};

export default schema;
