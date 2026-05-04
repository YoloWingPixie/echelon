import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "soviet-vvs-1991",
  name: "Soviet Air Forces (VVS), 1991",
  description: "Standard Soviet Air Forces (VVS) organizational structure circa 1991",
  group: "Soviet Union",
  echelons: [
    { label: "Air Army", slug: "va", level: 10, personnelDefault: 40000 },
    { label: "Aviation Division", slug: "ad", level: 8, personnelDefault: 14000 },
    { label: "Fighter Aviation Regiment", slug: "iap", level: 7, personnelDefault: 3500 },
    { label: "Bomber Aviation Regiment", slug: "bap", level: 7, personnelDefault: 3500 },
    { label: "Ground Attack Aviation Regiment", slug: "shap", level: 7, personnelDefault: 3500 },
    { label: "Fighter-Bomber Aviation Regiment", slug: "apib", level: 7, personnelDefault: 3500 },
    { label: "Mixed Aviation Regiment", slug: "sap", level: 7, personnelDefault: 3000 },
    { label: "Reconnaissance Aviation Regiment", slug: "rap", level: 7, personnelDefault: 2500 },
    { label: "Transport Aviation Regiment", slug: "vtap", level: 7, personnelDefault: 2000 },
    { label: "Comms & Control Regiment", slug: "ops", level: 7, personnelDefault: 1500 },
    { label: "Helicopter Regiment", slug: "ovp", level: 7, personnelDefault: 2000 },
    { label: "Aviation Squadron", slug: "ae", level: 6, personnelDefault: 500 },
    { label: "Flight/Zveno", slug: "zveno", level: 4, personnelDefault: 35 },
    { label: "Pair/Para", slug: "para", level: 1, personnelDefault: 8 },
  ],
};

export default schema;
