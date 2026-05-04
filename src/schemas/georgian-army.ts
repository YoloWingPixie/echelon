import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "georgian-army",
  name: "Georgian Army",
  description: "Standard Georgian Army organizational structure",
  group: "Georgia",
  echelons: [
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
    { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
  ],
};

export default schema;
