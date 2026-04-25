import { useMemo, useState } from "react";
import { SCHEMAS } from "../schemas";
import { themeLabel, type Theme } from "../theme";
import { coordFormatLabel, type CoordFormat } from "../coords";
import { formatZoomPercent } from "../zoom";
import { layoutPrefLabel, type LayoutPref } from "../layout";
import { Menu, type MenuItem } from "./Menu";
import { Segmented } from "./Segmented";

export type ViewMode = "tree" | "library" | "map";

interface Props {
  onNewUnit: () => void;
  onReset: () => void;
  onExport: () => void;
  onExportMarkdown: () => void;
  onExportPng: () => void;
  onExportYaml: () => void;
  onOpenImport: () => void;
  onOpenImportYaml: () => void;
  onOpenSchemaModal: () => void;
  onOpenShare: () => void;
  status: string | null;
  schemaId: string;
  onSchemaChange: (schemaId: string) => void;
  prefix: string;
  onPrefixChange: (prefix: string) => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  theme: Theme;
  onCycleTheme: () => void;
  coordFormat: CoordFormat;
  onCycleCoordFormat: () => void;
  // Canvas zoom. Discrete ladder — buttons step, percentage click resets.
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  // Tree layout: AUTO (per-subtree smart), WIDE (force fan), TALL (force stack).
  layoutPref: LayoutPref;
  onCycleLayoutPref: () => void;
  // Undo / redo.
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // Paste destinations. Enabled when clipboardLabel !== null.
  clipboardLabel: string | null;
  onPasteAsRoot: () => void;
  onPasteAsUnassigned: () => void;
  onOpenStats: () => void;
  onOpenSearch: () => void;
  onOpenHelp: () => void;
}

const CARET = "\u25BE";

export function TopBar({
  onNewUnit,
  onReset,
  onExport,
  onExportMarkdown,
  onExportPng,
  onExportYaml,
  onOpenImport,
  onOpenImportYaml,
  onOpenSchemaModal,
  onOpenShare,
  status,
  schemaId,
  onSchemaChange,
  prefix,
  onPrefixChange,
  viewMode,
  onSetViewMode,
  theme,
  onCycleTheme,
  coordFormat,
  onCycleCoordFormat,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  layoutPref,
  onCycleLayoutPref,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  clipboardLabel,
  onPasteAsRoot,
  onPasteAsUnassigned,
  onOpenStats,
  onOpenSearch,
  onOpenHelp,
}: Props) {
  const canPaste = clipboardLabel !== null;

  // Prefix chip keeps a local buffer so typing doesn't fire an undoable
  // mutation per keystroke. Committed on blur / Enter / Escape-revert.
  // When the prop changes externally (import, undo, reset) we re-sync via
  // the "derived state with a prev-prop sentinel" pattern — React's
  // recommended alternative to an effect for prop-driven state resets.
  const [prefixDraft, setPrefixDraft] = useState(prefix);
  const [lastPrefixProp, setLastPrefixProp] = useState(prefix);
  if (prefix !== lastPrefixProp) {
    setLastPrefixProp(prefix);
    setPrefixDraft(prefix);
  }
  const commitPrefix = () => {
    if (prefixDraft !== prefix) onPrefixChange(prefixDraft);
  };

  // ---- File menu ----
  const fileItems = useMemo<MenuItem[]>(
    () => [
      {
        id: "share",
        label: "Share Link\u2026",
        sublabel: "Copy a URL that loads this ORBAT",
        onClick: onOpenShare,
      },
      {
        id: "import",
        label: "Import JSON\u2026",
        sublabel: "Load an ORBAT from JSON (Ctrl+I)",
        onClick: onOpenImport,
      },
      {
        id: "import-yaml",
        label: "Import YAML\u2026",
        sublabel: "Paste a YAML ORBAT document",
        onClick: onOpenImportYaml,
      },
      {
        id: "schema",
        label: "Schema\u2026",
        sublabel: "YAML format reference",
        onClick: onOpenSchemaModal,
      },
      { id: "sep-0", separator: true, label: "" },
      {
        id: "export-json",
        label: "Export JSON",
        sublabel: "Copy state to clipboard",
        onClick: onExport,
      },
      {
        id: "export-yaml",
        label: "Export YAML",
        sublabel: "Copy logical ORBAT to clipboard",
        onClick: onExportYaml,
      },
      {
        id: "export-md",
        label: "Export Markdown",
        sublabel: "Copy outline to clipboard",
        onClick: onExportMarkdown,
      },
      {
        id: "export-png",
        label: "Export PNG\u2026",
        sublabel: "Render tree as an image",
        onClick: onExportPng,
      },
      { id: "sep-1", separator: true, label: "" },
      {
        id: "reset",
        label: "Reset to Demo\u2026",
        sublabel: "Discard current ORBAT",
        danger: true,
        onClick: onReset,
      },
    ],
    [
      onOpenShare,
      onOpenImport,
      onOpenImportYaml,
      onOpenSchemaModal,
      onExport,
      onExportYaml,
      onExportMarkdown,
      onExportPng,
      onReset,
    ],
  );

  // ---- Paste menu (only when clipboard is present) ----
  const pasteSublabel = clipboardLabel ?? "";
  const pasteItems = useMemo<MenuItem[]>(
    () => [
      {
        id: "paste-root",
        label: "Paste as Root",
        sublabel: pasteSublabel,
        onClick: onPasteAsRoot,
      },
      {
        id: "paste-unassigned",
        label: "Paste as Unassigned",
        sublabel: pasteSublabel,
        onClick: onPasteAsUnassigned,
      },
    ],
    [pasteSublabel, onPasteAsRoot, onPasteAsUnassigned],
  );

  // ---- Schema menu ----
  const activeSchema = SCHEMAS.find((s) => s.id === schemaId);
  const schemaItems = useMemo<MenuItem[]>(
    () =>
      SCHEMAS.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: s.description,
        active: s.id === schemaId,
        onClick: () => onSchemaChange(s.id),
      })),
    [schemaId, onSchemaChange],
  );

  return (
    <header className="topbar">
      <div className="topbar__actions">
        {/* 1. Brand */}
        <div className="topbar__group topbar__group--first topbar__brand">
          <div className="topbar__logo" aria-hidden>
            {"\u25C8"}
          </div>
          <div className="topbar__title">Echelon</div>
        </div>

        {/* 2. Primary */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onNewUnit}
          >
            + New unit
          </button>
        </div>

        {/* 3. Edit (Undo / Redo — rendered as a joined pair) */}
        <div className="topbar__group">
          <div className="btn-group">
            <button
              type="button"
              className="btn btn--ghost btn-group__btn btn-group__btn--first"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              className="btn btn--ghost btn-group__btn btn-group__btn--last"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
              aria-label="Redo"
            >
              Redo
            </button>
          </div>
        </div>

        {/* 4. Clipboard (only if clipboard populated) */}
        {canPaste ? (
          <div className="topbar__group">
            <Menu
              label="Paste menu"
              align="start"
              trigger={
                <button
                  type="button"
                  className="btn btn--ghost"
                  title={`Paste "${clipboardLabel}"`}
                >
                  Paste {CARET}
                </button>
              }
              items={pasteItems}
            />
          </div>
        ) : null}

        {/* 5. File menu */}
        <div className="topbar__group">
          <Menu
            label="File menu"
            align="start"
            trigger={
              <button type="button" className="btn btn--ghost">
                File {CARET}
              </button>
            }
            items={fileItems}
          />
        </div>

        {/* 6. Search */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenSearch}
            title="Find a unit (Ctrl+K)"
          >
            Search
          </button>
        </div>

        {/* 6b. Stats */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenStats}
            title="Show ORBAT statistics"
          >
            Stats
          </button>
        </div>

        {/* 6c. Help / keyboard shortcuts */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--ghost btn--help"
            onClick={onOpenHelp}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
        </div>

        {/* 7. Spacer */}
        <div className="topbar__spacer" />

        {/* 8. View toggle */}
        <div className="topbar__group">
          <Segmented<ViewMode>
            ariaLabel="View mode"
            value={viewMode}
            options={[
              { value: "tree", label: "Tree", title: "Orbat tree" },
              {
                value: "library",
                label: "Library",
                title: "Equipment & sets",
              },
              { value: "map", label: "Map", title: "Geographic view" },
            ]}
            onChange={onSetViewMode}
          />
        </div>

        {/* 8.5 Prefix (inline input chip) */}
        <div className="topbar__group">
          <label
            className="chip chip--prefix"
            title="Document-level slug prefix — prepended to every unit's full slug"
          >
            <span className="chip__key">Prefix</span>
            <input
              type="text"
              className="chip__input"
              value={prefixDraft}
              onChange={(e) => setPrefixDraft(e.target.value)}
              onBlur={commitPrefix}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setPrefixDraft(prefix);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder="none"
              spellCheck={false}
              aria-label="Document-level slug prefix"
            />
          </label>
        </div>

        {/* 9. Schema */}
        <div className="topbar__group">
          <Menu
            label="Schema picker"
            align="end"
            trigger={
              <button
                type="button"
                className="btn btn--ghost btn--schema"
                title="Change echelon schema"
              >
                <span className="btn--schema__prefix">Schema:</span>
                <span className="btn--schema__name">
                  {activeSchema ? activeSchema.name : schemaId}
                </span>
                <span className="btn--schema__caret" aria-hidden>
                  {CARET}
                </span>
              </button>
            }
            items={schemaItems}
          />
        </div>

        {/* 10. Theme chip */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--ghost chip chip--theme"
            onClick={onCycleTheme}
            title="Cycle theme: Auto \u2192 Light \u2192 Dark \u2192 Swiss"
            aria-label={`Theme: ${themeLabel(theme)}. Click to cycle.`}
          >
            <span className="chip__key">Theme</span>
            <span className="chip__val">{themeLabel(theme)}</span>
          </button>
        </div>

        {/* 10b. Zoom group — −/percentage/+ with click-to-reset */}
        <div className="topbar__group">
          <div className="btn-group chip chip--zoom">
            <button
              type="button"
              className="btn btn--ghost btn-group__btn btn-group__btn--first chip__step"
              onClick={onZoomOut}
              title="Zoom out (Ctrl+-)"
              aria-label="Zoom out"
            >
              {"\u2212"}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn-group__btn chip__val chip__val--button"
              onClick={onZoomReset}
              title="Reset zoom (Ctrl+0)"
              aria-label={`Canvas zoom ${formatZoomPercent(zoom)}. Click to reset.`}
            >
              {formatZoomPercent(zoom)}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn-group__btn btn-group__btn--last chip__step"
              onClick={onZoomIn}
              title="Zoom in (Ctrl++)"
              aria-label="Zoom in"
            >
              {"+"}
            </button>
          </div>
        </div>

        {/* 10b. Layout chip — cycle AUTO / WIDE / TALL */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--ghost chip chip--layout"
            onClick={onCycleLayoutPref}
            title="Cycle tree layout: Auto \u2192 Wide \u2192 Tall"
            aria-label={`Tree layout: ${layoutPrefLabel(layoutPref)}. Click to cycle.`}
          >
            <span className="chip__key">Layout</span>
            <span className="chip__val">{layoutPrefLabel(layoutPref)}</span>
          </button>
        </div>

        {/* 11. Coords chip */}
        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--ghost chip chip--coord"
            onClick={onCycleCoordFormat}
            title="Cycle coordinate format: Decimal \u2192 MGRS \u2192 DMS"
            aria-label={`Coordinate format: ${coordFormatLabel(coordFormat)}. Click to cycle.`}
          >
            <span className="chip__key">Coords</span>
            <span className="chip__val">{coordFormatLabel(coordFormat)}</span>
          </button>
        </div>
      </div>

      {/* Thin status sub-row — collapses to zero height when empty. */}
      <div
        className={
          status
            ? "topbar__status-row topbar__status-row--visible"
            : "topbar__status-row"
        }
        aria-live="polite"
      >
        <div className="topbar__status">{status ?? ""}</div>
      </div>
    </header>
  );
}
