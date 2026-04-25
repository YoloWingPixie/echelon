// Markdown outline export. Walks the current State and produces a bullet
// outline of the full ORBAT — one bullet per unit, nested by parent/child,
// with a flat "Unassigned" section appended when non-empty.
//
// Notes are skipped (they would blow up the outline); users can export JSON
// for full data. Collapsed state is ignored — the outline always shows the
// full tree regardless of viewport collapse.

import { formatNumber } from "./format";
import { childrenOf } from "./mutations";
import { unitPersonnel, totalPersonnel } from "./personnel";
import { SCHEMAS } from "./schemas";
import { fullSlug } from "./slug";
import type { State, Unit } from "./types";

// Render one unit's bullet body (everything after the leading "- "). Shared
// by the tree recursion and the flat Unassigned list so the per-unit format
// is defined in exactly one place.
function unitLine(state: State, unit: Unit, slug: string): string {
  const parts: string[] = [`**${unit.name}**`];
  if (slug) parts.push(` \`${slug}\``);
  if (unit.echelon) parts.push(` \u2014 ${unit.echelon}`);
  const people = unitPersonnel(unit, state.schemaId);
  parts.push(` \u00b7 ${formatNumber(people)} personnel`);
  if (unit.location) parts.push(` \u00b7 ${unit.location}`);
  return parts.join("");
}

// Recursive tree walk. Emits one bullet for `id` at the given depth, then
// recurses into children. Indentation is two spaces per level.
function emitSubtree(state: State, id: string, depth: number, out: string[]): void {
  const unit = state.units[id];
  if (!unit) return;
  const indent = "  ".repeat(depth);
  const slug = fullSlug(state, id);
  out.push(`${indent}- ${unitLine(state, unit, slug)}`);
  for (const childId of childrenOf(state, id)) {
    emitSubtree(state, childId, depth + 1, out);
  }
}

// ISO YYYY-MM-DD in UTC. Keeps the header deterministic across timezones.
function isoDate(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function buildMarkdown(state: State): string {
  const lines: string[] = [];

  lines.push(`# ORBAT \u2014 ${isoDate()}`);
  lines.push("");

  const schema = SCHEMAS.find((s) => s.id === state.schemaId);
  const schemaName = schema ? schema.name : state.schemaId;
  const headerParts: string[] = [`Schema: ${schemaName}`];
  if (state.prefix) headerParts.push(`Prefix: ${state.prefix}`);
  headerParts.push(`Total personnel: ${formatNumber(totalPersonnel(state))}`);
  lines.push(headerParts.join(" | "));
  lines.push("");

  lines.push("## Tree");
  lines.push("");
  if (state.rootIds.length === 0) {
    lines.push("- _(no root formations)_");
  } else {
    for (const rootId of state.rootIds) {
      emitSubtree(state, rootId, 0, lines);
    }
  }

  if (state.unassigned.length > 0) {
    lines.push("");
    lines.push(`## Unassigned (${state.unassigned.length})`);
    lines.push("");
    for (const id of state.unassigned) {
      const unit = state.units[id];
      if (!unit) continue;
      const slug = fullSlug(state, id);
      lines.push(`- ${unitLine(state, unit, slug)}`);
    }
  }

  // Trailing newline so the file ends cleanly when written to disk.
  return lines.join("\n") + "\n";
}
