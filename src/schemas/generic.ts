import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "generic",
  name: "Generic",
  group: "International",
  echelons: [
    { label: "Theater", slug: "th", level: 10, personnelDefault: 100000 },
    { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
    { label: "Regiment", slug: "rgt", level: 7, personnelDefault: 3500 },
    { label: "Battalion", slug: "batt", level: 6, personnelDefault: 500 },
    { label: "Squadron", slug: "sqn", level: 5, personnelDefault: 130 },
    { label: "Company", slug: "coy", level: 5, personnelDefault: 130 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Section", slug: "sec", level: 3, personnelDefault: 25 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
    { label: "Team", slug: "tm", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
