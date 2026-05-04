import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "soviet-vvs-1991",
  name: "Soviet Air Forces (VVS), 1991",
  description: "Standard Soviet Air Forces (VVS) organizational structure circa 1991",
  echelons: [
    { label: "Air Army", slug: "va", level: 10, personnelDefault: 40000 },
    { label: "Aviation Division", slug: "ad", level: 8, personnelDefault: 14000 },
    { label: "Aviation Regiment", slug: "ap", level: 7, personnelDefault: 3500 },
    { label: "Aviation Squadron", slug: "ae", level: 6, personnelDefault: 500 },
    { label: "Flight/Link", slug: "zveno", level: 4, personnelDefault: 35 },
  ],
};

export default schema;
