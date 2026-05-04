import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "us-air-force",
  name: "US Air Force",
  description: "Standard US Air Force organizational structure",
  echelons: [
    { label: "Major Command", slug: "majcom", level: 10, personnelDefault: 100000 },
    { label: "Numbered Air Force", slug: "naf", level: 9, personnelDefault: 40000 },
    { label: "Wing", slug: "wg", level: 8, personnelDefault: 5000 },
    { label: "Group", slug: "gp", level: 7, personnelDefault: 1200 },
    { label: "Squadron", slug: "sq", level: 6, personnelDefault: 250 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Element", slug: "el", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
