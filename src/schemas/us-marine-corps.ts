import type { EchelonSchema } from "../types";

const schema: EchelonSchema = {
  id: "us-marine-corps",
  name: "US Marine Corps",
  description: "Standard US Marine Corps organizational structure (MAGTF)",
  group: "United States",
  echelons: [
    { label: "Marine Expeditionary Force", slug: "mef", level: 10, personnelDefault: 48000 },
    { label: "Marine Division", slug: "mdiv", level: 8, personnelDefault: 18000 },
    { label: "Marine Aircraft Wing", slug: "maw", level: 8, personnelDefault: 11000 },
    { label: "Marine Logistics Group", slug: "mlg", level: 8, personnelDefault: 8000 },
    { label: "Marine Expeditionary Brigade", slug: "meb", level: 8, personnelDefault: 16000 },
    { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
    { label: "Marine Aircraft Group", slug: "mag", level: 7, personnelDefault: 2500 },
    { label: "Combat Logistics Regiment", slug: "clr", level: 7, personnelDefault: 2000 },
    { label: "Marine Expeditionary Unit", slug: "meu", level: 7, personnelDefault: 2200 },
    { label: "Battalion", slug: "bn", level: 6, personnelDefault: 900 },
    { label: "Squadron", slug: "sqdn", level: 6, personnelDefault: 250 },
    { label: "Company", slug: "co", level: 5, personnelDefault: 180 },
    { label: "Detachment", slug: "det", level: 5, personnelDefault: 60 },
    { label: "Platoon", slug: "plt", level: 4, personnelDefault: 40 },
    { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
    { label: "Squad", slug: "sqd", level: 2, personnelDefault: 13 },
    { label: "Fire Team", slug: "ft", level: 1, personnelDefault: 4 },
  ],
};

export default schema;
