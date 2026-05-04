import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "bundeswehr-heer",
  name: "Bundeswehr Heer",
  description: "German Army (Heer) organizational structure",
  echelons: [
    { label: "Korps", slug: "korps", level: 9, personnelDefault: 40000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 5000 },
    { label: "Regiment", slug: "rgt", level: 7, personnelDefault: 3500 },
    { label: "Bataillon", slug: "btl", level: 6, personnelDefault: 1000 },
    { label: "Kompanie", slug: "kp", level: 5, personnelDefault: 150 },
    { label: "Zug", slug: "zug", level: 4, personnelDefault: 40 },
    { label: "Gruppe", slug: "grp", level: 2, personnelDefault: 10 },
    { label: "Trupp", slug: "trp", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
