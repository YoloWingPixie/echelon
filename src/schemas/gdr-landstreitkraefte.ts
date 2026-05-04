import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "gdr-landstreitkraefte",
  name: "GDR Landstreitkräfte",
  description: "NVA Land Forces (Landstreitkräfte der NVA)",
  group: "East Germany",
  echelons: [
    { label: "Militärbezirk (Military District)", slug: "mbz", level: 10, personnelDefault: 50000 },
    { label: "Division", slug: "div", level: 8, personnelDefault: 12000 },
    { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
    { label: "Regiment", slug: "rgt", level: 7, personnelDefault: 2500 },
    { label: "Bataillon (Battalion)", slug: "btl", level: 6, personnelDefault: 500 },
    { label: "Kompanie (Company)", slug: "kp", level: 5, personnelDefault: 120 },
    { label: "Batterie (Battery)", slug: "bttr", level: 5, personnelDefault: 100 },
    { label: "Zug (Platoon)", slug: "zug", level: 4, personnelDefault: 30 },
    { label: "Gruppe (Squad)", slug: "grp", level: 2, personnelDefault: 10 },
  ],
};

export default schema;
