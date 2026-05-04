import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "iranian-army",
  name: "Iranian Army (Artesh)",
  description: "Islamic Republic of Iran Army Ground Forces",
  echelons: [
    { label: "Regional HQ", slug: "rhq", level: 9, personnelDefault: 50000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 12000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
    { label: "Company", slug: "coy", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 30 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
  ],
};

export default schema;
