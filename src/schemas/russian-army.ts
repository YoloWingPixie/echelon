import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "russian-army",
  name: "Russian Ground Forces",
  description: "Standard Russian Ground Forces organizational structure",
  group: "Russia",
  echelons: [
    { label: "Army", slug: "army", level: 10, personnelDefault: 60000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 4500 },
    { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
    { label: "Company", slug: "co", level: 5, personnelDefault: 100 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 30 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 8 },
  ],
};

export default schema;
