import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "british-army",
  name: "British Army",
  description: "Standard British Army organizational structure",
  group: "United Kingdom",
  echelons: [
    { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 4500 },
    { label: "Battle Group", slug: "bg", level: 6, personnelDefault: 800 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 650 },
    { label: "Squadron", slug: "sqn", level: 5, personnelDefault: 130 },
    { label: "Company", slug: "coy", level: 5, personnelDefault: 130 },
    { label: "Battery", slug: "bty", level: 5, personnelDefault: 100 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 30 },
    { label: "Troop", slug: "tp", level: 4, personnelDefault: 30 },
    { label: "Section", slug: "sec", level: 2, personnelDefault: 8 },
    { label: "Fire Team", slug: "ft", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
