import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "us-navy",
  name: "US Navy",
  description: "Standard US Navy organizational structure",
  group: "United States",
  echelons: [
    { label: "Fleet", slug: "flt", level: 10, personnelDefault: 50000 },
    // Navy Task Forces vary wildly — a CSG-sized task force lands near
    // 7,500; a small regional task force can be a few hundred.
    { label: "Task Force", slug: "tf", level: 9, personnelDefault: 7500 },
    { label: "Task Group", slug: "tg", level: 8, personnelDefault: 2500 },
    { label: "Task Unit", slug: "tu", level: 7, personnelDefault: 800 },
    { label: "Task Element", slug: "te", level: 6, personnelDefault: 300 },
    { label: "Department", slug: "dept", level: 5, personnelDefault: 60 },
    { label: "Division", slug: "div", level: 4, personnelDefault: 20 },
  ],
};

export default schema;
