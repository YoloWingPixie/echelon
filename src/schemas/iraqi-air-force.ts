import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "iraqi-air-force",
  name: "Iraqi Air Force",
  description: "Echelon schema for the Iraqi Air Force (Al-Quwwa al-Jawwiya al-Iraqiya). Based on publicly available information, covering historical and modern structures.",
  group: "Iraq",
  echelons: [
    { label: "Air Command", slug: "cmd", level: 10, personnelDefault: 100000 },
    { label: "Air Base Command", slug: "basecmd", level: 9, personnelDefault: 40000 },
    { label: "Group", slug: "gp", level: 8, personnelDefault: 14000 },
    { label: "Wing", slug: "wg", level: 7, personnelDefault: 3500 },
    { label: "Squadron", slug: "sqn", level: 6, personnelDefault: 500 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Detachment", slug: "det", level: 3, personnelDefault: 25 },
  ],
};

export default schema;
