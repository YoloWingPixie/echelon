import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "pmc",
  name: "Generic PMC",
  description: "A generalized theoretical operational structure for Private Military Companies, focusing on deployable units.",
  group: "International",
  echelons: [
    { label: "Operational HQ", slug: "ophq", level: 10, personnelDefault: 2000 },
    { label: "Sector Command", slug: "sctcmd", level: 9, personnelDefault: 800 },
    // PMC task groups are small mission-focused formations — a few teams
    // plus support, nowhere near a conventional brigade.
    { label: "Task Group", slug: "tg", level: 8, personnelDefault: 150 },
    { label: "Team", slug: "tm", level: 5, personnelDefault: 12 },
    { label: "Element", slug: "elm", level: 5, personnelDefault: 12 },
    { label: "Section", slug: "sec", level: 3, personnelDefault: 6 },
    { label: "Cell", slug: "cell", level: 2, personnelDefault: 4 },
  ],
};

export default schema;
