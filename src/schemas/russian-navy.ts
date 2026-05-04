import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "russian-navy",
  name: "Russian Navy",
  description: "Standard Russian Navy organizational structure",
  echelons: [
    { label: "Fleet", slug: "flt", level: 10, personnelDefault: 25000 },
    { label: "Flotilla", slug: "flot", level: 9, personnelDefault: 8000 },
    { label: "Squadron", slug: "sqdn", level: 8, personnelDefault: 3000 },
    { label: "Division of Ships", slug: "divkor", level: 7, personnelDefault: 1500 },
    { label: "Brigade of Ships", slug: "brkor", level: 7, personnelDefault: 1500 },
    { label: "Ship", slug: "korabl", level: 6, personnelDefault: 250 },
    { label: "Department (Shipboard)", slug: "bch", level: 5, personnelDefault: 40 },
    { label: "Service (Shipboard)", slug: "sl", level: 4, personnelDefault: 20 },
    { label: "Division (Shipboard)", slug: "div_sb", level: 4, personnelDefault: 20 },
    { label: "Group (Shipboard)", slug: "grp_sb", level: 3, personnelDefault: 10 },
    { label: "Battery (Shipboard)", slug: "bat_sb", level: 2, personnelDefault: 6 },
    { label: "Team (Shipboard)", slug: "team_sb", level: 1, personnelDefault: 3 },
  ],
};

export default schema;
