import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "nato-command",
  name: "NATO Command",
  description: "NATO integrated command and force structure echelons",
  group: "International",
  echelons: [
    { label: "Supreme Headquarters", slug: "shq", level: 11, personnelDefault: 500000 },
    { label: "Army Group", slug: "ag", level: 10, personnelDefault: 200000 },
    { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 4000 },
    { label: "Battle Group", slug: "bg", level: 6, personnelDefault: 800 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 600 },
    { label: "Company", slug: "coy", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    { label: "Section", slug: "sec", level: 3, personnelDefault: 10 },
  ],
};

export default schema;
