import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "russian-air-force",
  name: "Russian Aerospace Forces (Air Force)",
  description: "Standard Russian Air Force organizational structure",
  echelons: [
    { label: "Air Army", slug: "aa", level: 10, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
    { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
    { label: "Squadron", slug: "sqdn", level: 6, personnelDefault: 500 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Section", slug: "sec", level: 3, personnelDefault: 25 },
  ],
};

export default schema;
