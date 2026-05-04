import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "pla-navy",
  name: "PLA Navy",
  description: "Standard Chinese People's Liberation Army Navy (PLAN) organizational structure",
  echelons: [
    { label: "Fleet", slug: "flt", level: 10, personnelDefault: 40000 },
    { label: "Naval Base", slug: "nb", level: 9, personnelDefault: 15000 },
    // PLAN flotillas are surface-action groups typically larger than a
    // western squadron — a handful of major combatants plus support.
    { label: "Flotilla", slug: "flot", level: 8, personnelDefault: 6000 },
    { label: "Squadron", slug: "sqdn", level: 7, personnelDefault: 2000 },
    { label: "Ship", slug: "ship", level: 6, personnelDefault: 300 },
    { label: "Department", slug: "dept", level: 5, personnelDefault: 40 },
  ],
};

export default schema;
