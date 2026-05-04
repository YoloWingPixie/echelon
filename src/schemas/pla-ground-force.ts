import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "pla-ground-force",
  name: "PLA Ground Force",
  description: "Standard Chinese People's Liberation Army Ground Force organizational structure",
  group: "China",
  echelons: [
    { label: "Group Army", slug: "ga", level: 10, personnelDefault: 60000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 5000 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
    { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
  ],
};

export default schema;
