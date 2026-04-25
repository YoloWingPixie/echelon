import {
  UNASSIGNED,
  newEquipmentRowId,
  type State,
  type Unit,
  type UnitEquipment,
} from "./types";
import { getEquipment, seedEquipmentLibrary } from "./equipmentLibrary";
import { getEquipmentSet, seedEquipmentSets } from "./equipmentSets";

// Build a UnitEquipment row referencing a specific library item. Pulls the
// display name from the library so the demo stays in sync with upstream
// renames. Optional `strengthPercent` drives the band coloring on the card.
function item(
  equipmentId: string,
  quantity: number,
  strengthPercent?: number,
): UnitEquipment {
  const e = getEquipment(equipmentId);
  return {
    id: newEquipmentRowId(),
    kind: "item",
    refId: equipmentId,
    name: e?.name ?? `Unknown (${equipmentId})`,
    quantity,
    ...(typeof strengthPercent === "number" ? { strengthPercent } : {}),
  };
}

// Build a UnitEquipment row referencing a library set.
function set(setId: string, quantity: number): UnitEquipment {
  const s = getEquipmentSet(setId);
  return {
    id: newEquipmentRowId(),
    kind: "set",
    refId: setId,
    name: s?.name ?? `Unknown set (${setId})`,
    quantity,
  };
}

// Small demo tree: a battalion with two companies (one with a platoon child),
// plus one unit sitting in the unassigned palette. Each unit pulls a mix of
// library items and sets so the equipment picker has something real to show.
export function demoSeed(): State {
  const battalion: Unit = {
    id: "u_demo_bn",
    name: "1st Battalion, 12th Cavalry",
    short: "1-12 CAV",
    echelon: "Battalion",
    color: "c-blue",
    image: "",
    equipment: [
      set("us-army-combined-arms-battalion-hhc", 1),
      // 75% strength → "substantial" band so the strength display is
      // visible on first load.
      item("17672c58-9cb7-4ae1-9a0a-7f8e928abda7", 3, 75), // Mortar 2B11 120mm
    ],
    parentId: null,
    // Demo symbol — friendly mechanized infantry HQ at battalion echelon.
    // Echelon override is null so the symbol follows whatever the unit's
    // actual echelon level resolves to in the active schema (Battalion → F).
    symbol: {
      affiliation: "friend",
      status: "present",
      dimension: "land",
      functionId: "infantry-mech",
      mobility: "tracked",
      modifiers: {
        hq: true,
        taskForce: false,
        feint: false,
        reinforced: false,
        reduced: false,
        installation: false,
      },
      echelonOverride: null,
    },
    // Demo coordinates — Fort Hood, Texas.
    coordinates: { lat: 31.135, lon: -97.777 },
    // Demo named location — geocoding of this string resolves to roughly
    // the same coords via Nominatim; the Editor offers a one-click
    // "USE COORDINATES" affordance to populate the pair from the match.
    location: "Fort Hood, TX",
    notes:
      "Attached to 1st Cavalry Division. Tasked with screening the FLOT.",
    // Slight under-strength override vs. the Battalion default (500) to
    // demonstrate the feature in the Editor and Stats modal.
    personnelOverride: 482,
    // C2 — a minor-shortfalls battalion; matches the 75% mortar strength above.
    readiness: "C2",
  };
  const alpha: Unit = {
    id: "u_demo_a",
    name: "Alpha Company",
    short: "A/1-12",
    echelon: "Company",
    color: "c-coral",
    image: "",
    equipment: [
      set("us-army-tank-company", 1),
      item("b7da5e11-5b4d-4af8-bb57-2dddb13d531e", 3), // M1A2C (cmd)
      item("ee520f19-c0fe-4ca8-9ad2-bbae8a404ef5", 4), // LUV HMMWV Jeep
    ],
    parentId: "u_demo_bn",
    // Demo coordinates — offset ~0.01° north-east of the battalion.
    coordinates: { lat: 31.145, lon: -97.767 },
    // Named sub-location to exercise the card's name fallback + tooltip.
    location: "Fort Hood Cavalry Range",
    notes: "Task-organized with tank platoon from B Co.",
    // C1 — fully ready; drives the green dot on this card.
    readiness: "C1",
  };
  const bravo: Unit = {
    id: "u_demo_b",
    name: "Bravo Company",
    short: "B/1-12",
    echelon: "Company",
    color: "c-coral",
    image: "",
    equipment: [
      set("us-army-mechanized-infantry-company", 1),
      item("6352f365-13c5-42b2-b799-8d76e320790e", 2), // Scout HMMWV
    ],
    parentId: "u_demo_bn",
  };
  const recon: Unit = {
    id: "u_demo_r",
    name: "Recon Platoon",
    short: "1/A-1-12",
    echelon: "Platoon",
    color: "c-teal",
    image: "",
    equipment: [
      item("6352f365-13c5-42b2-b799-8d76e320790e", 6), // Scout HMMWV
      item("3977d399-da3a-412b-87a2-15f075259b03", 2), // ATGM HMMWV
      item("4dd6a0fc-e4e3-4993-9020-dfce604ff997", 3), // Infantry M249
    ],
    parentId: "u_demo_a",
    // Reduced strength recon platoon — override well below the Platoon
    // default (35) to show the Editor's "(override)" indicator.
    personnelOverride: 22,
    // C3 — marginally ready; the coral dot matches the reduced personnel.
    readiness: "C3",
    // Demo symbol — friendly recon platoon, wheeled.
    symbol: {
      affiliation: "friend",
      status: "present",
      dimension: "land",
      functionId: "recon",
      mobility: "wheeled",
      modifiers: {
        hq: false,
        taskForce: false,
        feint: false,
        reinforced: false,
        reduced: false,
        installation: false,
      },
      echelonOverride: null,
    },
  };
  const support: Unit = {
    id: "u_demo_s",
    name: "Forward Support Company",
    short: "FSC",
    echelon: "Company",
    color: "c-pink",
    image: "",
    equipment: [
      set("us-army-forward-support-company", 1),
      item("d654f9de-b5d9-4ba4-a6b3-d7e3865ae998", 3), // Refueler M978 HEMTT
      item("9db56a2e-b0e7-4c87-ac63-917e5cd7bbf2", 5), // Truck M939 Heavy
    ],
    parentId: UNASSIGNED,
  };

  return {
    units: {
      [battalion.id]: battalion,
      [alpha.id]: alpha,
      [bravo.id]: bravo,
      [recon.id]: recon,
      [support.id]: support,
    },
    rootIds: [battalion.id],
    unassigned: [support.id],
    schemaId: "generic",
    equipmentLibrary: seedEquipmentLibrary(),
    equipmentSets: seedEquipmentSets(),
  };
}
