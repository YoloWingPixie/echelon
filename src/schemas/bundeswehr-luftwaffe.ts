import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "bundeswehr-luftwaffe",
  name: "Bundeswehr Luftwaffe",
  description: "German Air Force (Luftwaffe) organizational structure",
  group: "Germany",
  echelons: [
    { label: "Luftwaffenkommando (Air Force Command)", slug: "lwkdo", level: 10, personnelDefault: 30000 },
    { label: "Luftwaffendivision (Air Force Division)", slug: "lwdiv", level: 8, personnelDefault: 8000 },
    { label: "Geschwader (Wing)", slug: "gschw", level: 7, personnelDefault: 1500 },
    { label: "Gruppe (Group)", slug: "grp", level: 6, personnelDefault: 500 },
    { label: "Staffel (Squadron)", slug: "st", level: 5, personnelDefault: 120 },
    { label: "Schwarm (Section)", slug: "schw", level: 2, personnelDefault: 8 },
    { label: "Rotte (Pair)", slug: "rt", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
