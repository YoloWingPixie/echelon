import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "us-army",
  name: "US Army",
  description: "Standard US Army organizational structure",
  echelons: [
    { label: "Field Army", slug: "fa", level: 10, personnelDefault: 100000 },
    { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "d", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 4500 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
    { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
  ],
};

export default schema;
