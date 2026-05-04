import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "bundeswehr-heer",
  name: "Bundeswehr Heer",
  description: "German Army (Heer) organizational structure",
  group: "Germany",
  echelons: [
    { label: "Korps (Corps)", slug: "korps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 5000 },
    { label: "Regiment", slug: "rgt", level: 7, personnelDefault: 3500 },
    { label: "Bataillon (Battalion)", slug: "btl", level: 6, personnelDefault: 1000 },
    { label: "Kompanie (Company)", slug: "kp", level: 5, personnelDefault: 150 },
    { label: "Zug (Platoon)", slug: "zug", level: 4, personnelDefault: 40 },
    { label: "Gruppe (Squad)", slug: "grp", level: 2, personnelDefault: 10 },
    { label: "Trupp (Team)", slug: "trp", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
