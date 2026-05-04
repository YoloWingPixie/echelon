import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "iraqi-army-1990",
  name: "Iraqi Army, 1990",
  description: "Standard Iraqi Army organizational structure circa 1990 (including Republican Guard considerations).",
  group: "Iraq",
  echelons: [
    { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
    { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
    { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
  ],
};

export default schema;
