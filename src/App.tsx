import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { DndProvider } from "./dndContext";
import { Editor, type EditorMode } from "./components/Editor";
import {
  EquipmentEditor,
  type EquipmentEditorMode,
} from "./components/EquipmentEditor";
import { ExportDialog } from "./components/ExportDialog";
import { ImportDialog } from "./components/ImportDialog";
import { ImportYamlDialog } from "./components/ImportYamlDialog";
import { SchemaModal } from "./components/SchemaModal";
import { ShareDialog } from "./components/ShareDialog";
import { LibraryPage } from "./components/LibraryPage";
import { MiniMap } from "./components/MiniMap";
import { Palette } from "./components/Palette";
import { RootDropZone } from "./components/RootDropZone";
import { SearchDialog } from "./components/SearchDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { SetEditor, type SetEditorMode } from "./components/SetEditor";
import { StatsModal } from "./components/StatsModal";
import { TopBar, type ViewMode } from "./components/TopBar";
import { TreeCanvas } from "./components/TreeCanvas";
import { UnitContextMenu } from "./components/UnitContextMenu";
import { ancestorsOf, descendantCount as descendantCountQ } from "./mutations";
import { computeStats } from "./stats";
import { buildMarkdown } from "./exportMarkdown";
import {
  defaultExportFilename,
  exportOrbatPng,
  triggerBlobDownload,
  type ExportPngOptions,
} from "./exportPng";
import { escapeHtml } from "./format";
import { useDialogs } from "./useDialogs";
import { useOrbatState } from "./useOrbatState";
import {
  applyTheme,
  loadTheme,
  nextTheme,
  resolveTheme,
  saveTheme,
  type Theme,
} from "./theme";

// Leaflet + map tiles add ~50 KB gzipped to the bundle; lazy-load so
// users who never open the map view don't pay for it on first paint.
const MapView = lazy(() => import("./components/MapView"));
import { nextCoordFormat, type CoordFormat } from "./coords";
import { loadCoordFormat, saveCoordFormat } from "./coordFormat";
import {
  DEFAULT_ZOOM,
  loadZoom,
  saveZoom,
  zoomIn,
  zoomOut,
} from "./zoom";
import {
  loadLayoutPref,
  nextLayoutPref,
  saveLayoutPref,
  type LayoutPref,
} from "./layout";
import { parseShareHash, SHARE_HASH_PREFIX } from "./urlShare";
import { tryCopyToClipboard } from "./clipboard";
import { toYaml } from "./yamlFormat";
import {
  UNASSIGNED,
  type Equipment,
  type EquipmentSet,
  type State,
  type UnitFields,
} from "./types";

const STATUS_TIMEOUT_MS = 2500;

interface CopyOrPopupMessages {
  copied: string;
  popup: string;
  failed: string;
  popupTitle: string;
}

function copyOrPopup(
  text: string,
  msgs: CopyOrPopupMessages,
  flashStatus: (s: string) => void,
): void {
  void tryCopyToClipboard(text).then((ok) => {
    if (ok) {
      flashStatus(msgs.copied);
      return;
    }
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(
        `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;padding:16px">${escapeHtml(
          text,
        )}</pre>`,
      );
      w.document.title = msgs.popupTitle;
      flashStatus(msgs.popup);
    } else {
      flashStatus(msgs.failed);
    }
  });
}

// When focus is inside an editable field, global shortcuts (Ctrl+Z, Ctrl+C,
// Ctrl+X) must fall through to native text editing instead of being hijacked
// by the subtree clipboard / history.
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

interface ContextMenuState {
  x: number;
  y: number;
  unitId: string | null;
}

function App() {
  const api = useOrbatState();
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [equipEditor, setEquipEditor] = useState<EquipmentEditorMode>({
    kind: "closed",
  });
  const [libSetEditor, setLibSetEditor] = useState<SetEditorMode>({ kind: "closed" });
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [coordFormat, setCoordFormat] = useState<CoordFormat>(() =>
    loadCoordFormat(),
  );
  const [zoom, setZoom] = useState<number>(() => loadZoom());
  const [layoutPref, setLayoutPref] = useState<LayoutPref>(() =>
    loadLayoutPref(),
  );
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<number | null>(null);
  const dialogs = useDialogs();
  const statsOpen = dialogs.active === "stats";
  const canvasRef = useRef<HTMLElement | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  // Id of the unit currently under the mouse pointer. Updated via
  // UnitCard's onMouseEnter/Leave callbacks. A ref (not state) because we
  // only need the value inside keyboard handlers — no render should track it.
  const hoveredUnitIdRef = useRef<string | null>(null);
  // Always-current pointer to `api`. Drop-site handlers passed to UnitCard
  // (wrapped in React.memo) must have stable references across renders so
  // memoized cards can skip re-rendering on unrelated mutations. Reading
  // `api` from this ref inside those handlers — paired with empty/flashStatus
  // deps — keeps the handler identity stable while still picking up the
  // latest state at call time. Synced via effect (updating refs during
  // render is disallowed by the react-hooks/refs rule).
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  // Apply the currently-selected theme to <html data-theme="..."> whenever
  // the user toggles it, and subscribe to OS preference changes while on
  // "auto" so flipping Dark Mode at the system level re-resolves live.
  useEffect(() => {
    applyTheme(resolveTheme(theme));
    saveTheme(theme);
    if (theme !== "auto") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("auto"));
    // Safari <14 only has addListener; modern browsers have addEventListener.
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [theme]);

  const handleCycleTheme = useCallback(() => {
    setTheme((t) => nextTheme(t));
  }, []);

  useEffect(() => {
    saveCoordFormat(coordFormat);
  }, [coordFormat]);

  const handleCycleCoordFormat = useCallback(() => {
    setCoordFormat((f) => nextCoordFormat(f));
  }, []);

  useEffect(() => {
    saveZoom(zoom);
  }, [zoom]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => zoomIn(z));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => zoomOut(z));
  }, []);
  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  useEffect(() => {
    saveLayoutPref(layoutPref);
  }, [layoutPref]);

  const handleCycleLayoutPref = useCallback(() => {
    setLayoutPref((p) => nextLayoutPref(p));
  }, []);

  const flashStatus = useCallback((msg: string) => {
    setStatus(msg);
    if (statusTimer.current !== null) {
      window.clearTimeout(statusTimer.current);
    }
    statusTimer.current = window.setTimeout(() => {
      setStatus(null);
      statusTimer.current = null;
    }, STATUS_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current);
      }
    };
  }, []);

  // Click-drag panning on the canvas background. Activates only when the
  // pointer goes down on empty space (not a card / drop zone / anchor),
  // so native card drag-and-drop still wins for the intended click target.
  // Listeners attach to the canvas on mousedown and to the document on
  // move/up, released on pointerup — same pattern as the MiniMap drag.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let pan: {
      startX: number;
      startY: number;
      scrollLeft: number;
      scrollTop: number;
    } | null = null;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Don't intercept clicks on interactive elements or cards — users
      // still expect their native click/drag behavior to win there.
      if (
        target.closest(
          ".unit-card, .root-drop-zone, a, button, input, textarea, select",
        )
      ) {
        return;
      }
      pan = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      };
      canvas.classList.add("canvas--panning");
      e.preventDefault();
    };

    const onMove = (e: MouseEvent) => {
      if (!pan) return;
      canvas.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX);
      canvas.scrollTop = pan.scrollTop - (e.clientY - pan.startY);
    };

    const onUp = () => {
      if (!pan) return;
      pan = null;
      canvas.classList.remove("canvas--panning");
    };

    canvas.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleOpenEditor = useCallback((id: string) => {
    setEditor({ kind: "edit", unitId: id });
  }, []);

  const handleNewUnit = useCallback(() => {
    setEditor({ kind: "create" });
  }, []);

  const handleCancelEditor = useCallback(() => {
    setEditor({ kind: "closed" });
  }, []);

  const handleSaveNew = useCallback(
    (fields: UnitFields) => {
      api.createUnit(fields);
      flashStatus(`Created "${fields.name}" in Unassigned.`);
      setEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleSaveEdit = useCallback(
    (id: string, fields: UnitFields) => {
      api.updateUnit(id, fields);
      flashStatus(`Saved "${fields.name}".`);
      setEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  // Inline-rename from the card face. Only `name` is updated — other fields
  // are left alone. The trim / empty-guard already lives in the card, so by
  // the time this fires we know `name` is a non-empty trimmed string.
  const handleRenameUnit = useCallback(
    (id: string, name: string) => {
      apiRef.current.updateUnit(id, { name });
      flashStatus(`Renamed to "${name}".`);
    },
    [flashStatus],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const u = api.state.units[id];
      const label = u ? u.name : "unit";
      api.deleteUnit(id);
      flashStatus(`Deleted "${label}". Children (if any) moved to Unassigned.`);
      setEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleDropOntoUnit = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return; // self drop = no-op
      const a = apiRef.current;
      const dragged = a.state.units[draggedId];
      const target = a.state.units[targetId];
      if (!dragged || !target) return;
      const targetWasCollapsed = !!target.collapsed;
      const result = a.moveTo(draggedId, targetId);
      if (!result.ok) {
        flashStatus(
          result.reason ?? "That drop would create a cycle — rejected.",
        );
        return;
      }
      // Auto-expand the target after a successful drop so the user sees the
      // newly-added child. Toggle (not "set") is safe here — the target was
      // collapsed before the move, so flipping it produces an expanded view.
      if (targetWasCollapsed) {
        a.toggleCollapsed(targetId);
      }
      flashStatus(`Moved "${dragged.name}" under "${target.name}".`);
    },
    [flashStatus],
  );

  const handleDropAtRoot = useCallback(
    (draggedId: string) => {
      const a = apiRef.current;
      const dragged = a.state.units[draggedId];
      if (!dragged) return;
      const result = a.moveTo(draggedId, null);
      if (!result.ok) {
        flashStatus(result.reason ?? "Could not promote to root.");
        return;
      }
      flashStatus(`Promoted "${dragged.name}" to a root formation.`);
    },
    [flashStatus],
  );

  const handleDropToUnassigned = useCallback(
    (draggedId: string) => {
      const dragged = api.state.units[draggedId];
      if (!dragged) return;
      if (dragged.parentId === UNASSIGNED) return;
      api.moveToUnassigned(draggedId);
      flashStatus(`Moved "${dragged.name}" to Unassigned.`);
    },
    [api, flashStatus],
  );

  const handleSchemaChange = useCallback(
    (schemaId: string) => {
      api.setSchema(schemaId);
    },
    [api],
  );

  const handleReset = useCallback(() => {
    const ok = window.confirm(
      "Reset discards the current ORBAT and reloads the demo tree. Continue?",
    );
    if (!ok) return;
    api.resetToDemo();
    setEditor({ kind: "closed" });
    setEquipEditor({ kind: "closed" });
    setLibSetEditor({ kind: "closed" });
    flashStatus("Reset to demo tree.");
  }, [api, flashStatus]);

  const handleExport = useCallback(() => {
    copyOrPopup(
      JSON.stringify(api.state, null, 2),
      {
        copied: "Exported JSON copied to clipboard.",
        popup: "Exported JSON opened in new window.",
        failed: "Export failed: clipboard and popup both blocked.",
        popupTitle: "ORBAT export",
      },
      flashStatus,
    );
  }, [api.state, flashStatus]);

  const handleExportMarkdown = useCallback(() => {
    const text = buildMarkdown(api.state);
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    triggerBlobDownload(blob, `${defaultExportFilename().replace(/\.png$/, "")}.md`);
    // Also try the clipboard as a bonus so users can paste directly.
    void tryCopyToClipboard(text).then((ok) => {
      flashStatus(
        ok
          ? "Markdown outline downloaded and copied to clipboard."
          : "Markdown outline downloaded.",
      );
    });
  }, [api.state, flashStatus]);

  const handleExportPng = useCallback(() => {
    // Short-circuit the empty case so we don't open a dialog for a canvas
    // with nothing to capture.
    if (
      api.state.rootIds.length === 0 &&
      api.state.unassigned.length === 0
    ) {
      flashStatus("Nothing to export — tree is empty.");
      return;
    }
    dialogs.open("export");
  }, [api.state.rootIds.length, api.state.unassigned.length, flashStatus]);

  const handleCancelExportPng = useCallback(() => {
    dialogs.close();
  }, []);

  const handleConfirmExportPng = useCallback(
    async (opts: ExportPngOptions) => {
      const node = canvasRef.current;
      if (!node) {
        flashStatus("PNG export failed: canvas not ready.");
        return;
      }
      try {
        const blob = await exportOrbatPng(node, opts);
        triggerBlobDownload(blob, defaultExportFilename());
        flashStatus("PNG downloaded.");
        dialogs.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        flashStatus(`PNG export failed: ${msg}`);
        throw err;
      }
    },
    [flashStatus],
  );

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // ---- Import JSON ----

  const handleOpenImport = useCallback(() => {
    dialogs.open("import");
  }, []);

  const handleCancelImport = useCallback(() => {
    dialogs.close();
  }, []);

  const handleConfirmImport = useCallback(
    (imported: State) => {
      api.replaceState(imported);
      // The editor may have been open on a unit id that no longer exists in
      // the imported state — close it so we don't operate on a stale id.
      setEditor({ kind: "closed" });
      dialogs.close();
      const n = Object.keys(imported.units).length;
      flashStatus(`Imported ${n} ${n === 1 ? "unit" : "units"}.`);
    },
    [api, flashStatus],
  );

  // ---- Import YAML ----

  const handleOpenImportYaml = useCallback(() => {
    dialogs.open("importYaml");
  }, []);

  const handleCancelImportYaml = useCallback(() => {
    dialogs.close();
  }, []);

  const handleConfirmImportYaml = useCallback(
    (imported: State) => {
      api.replaceState(imported);
      setEditor({ kind: "closed" });
      dialogs.close();
      const n = Object.keys(imported.units).length;
      flashStatus(`Imported ${n} ${n === 1 ? "unit" : "units"} from YAML.`);
    },
    [api, flashStatus],
  );

  // ---- Export YAML ----

  const handleExportYaml = useCallback(() => {
    copyOrPopup(
      toYaml(api.state),
      {
        copied: "Exported YAML copied to clipboard.",
        popup: "Exported YAML opened in new window.",
        failed: "YAML export failed: clipboard and popup both blocked.",
        popupTitle: "ORBAT YAML export",
      },
      flashStatus,
    );
  }, [api.state, flashStatus]);

  // ---- Schema modal ----

  const handleOpenSchemaModal = useCallback(() => {
    dialogs.open("schema");
  }, []);

  const handleCloseSchemaModal = useCallback(() => {
    dialogs.close();
  }, []);

  // ---- Share via URL ----

  const handleOpenShare = useCallback(() => {
    dialogs.open("share");
  }, []);

  const handleCloseShare = useCallback(() => {
    dialogs.close();
  }, []);

  // One-time hash-load on mount. If the URL arrives with
  // `#state=<compressed>`, decode it and replace the current state. We
  // also clear the hash afterwards so a reload doesn't re-apply the same
  // shared state on top of any edits the user made since (and so the URL
  // bar doesn't show the long compressed blob). replaceState routes through
  // the history wrapper so the receiver can Ctrl+Z to get their previous
  // ORBAT back. The state mutations fire inside a timeout so we aren't
  // triggering setState synchronously during the initial mount effect
  // (react-hooks/set-state-in-effect).
  // Ref survives StrictMode's double-invoked mount so the body runs once.
  const shareHashAppliedRef = useRef(false);
  useEffect(() => {
    if (shareHashAppliedRef.current) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith(SHARE_HASH_PREFIX)) return;
    shareHashAppliedRef.current = true;
    // Parse BEFORE clearing the hash so we don't lose the token.
    const loaded = parseShareHash(hash);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    // Defer setState out of the effect body (project lint rule).
    window.setTimeout(() => {
      if (!loaded) {
        flashStatus("Share link could not be parsed — loading demo instead.");
        return;
      }
      api.replaceState(loaded);
      flashStatus(
        "Loaded shared ORBAT. Use Ctrl+Z to undo if you want your previous state back.",
      );
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStateIsEmpty =
    api.state.rootIds.length === 0 && api.state.unassigned.length === 0;

  // ---- Hover tracking (for keyboard shortcuts targeting hovered unit) ----

  const handleHoverEnter = useCallback((unitId: string) => {
    hoveredUnitIdRef.current = unitId;
  }, []);

  const handleHoverLeave = useCallback((unitId: string) => {
    // Only clear if the leaving id matches the currently-hovered ref —
    // otherwise we'd race: enter(B) can fire before leave(A), which would
    // null out B.
    if (hoveredUnitIdRef.current === unitId) {
      hoveredUnitIdRef.current = null;
    }
  }, []);

  // ---- Context menu ----

  const handleOpenContextMenu = useCallback(
    (unitId: string, x: number, y: number) => {
      setCtxMenu({ x, y, unitId });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setCtxMenu(null);
  }, []);

  // ---- Stats modal ----

  const handleOpenStats = useCallback(() => {
    dialogs.open("stats");
  }, []);

  const handleCloseStats = useCallback(() => {
    dialogs.close();
  }, []);

  // ---- Search dialog ----

  const handleOpenSearch = useCallback(() => {
    dialogs.open("search");
  }, []);

  const handleCloseSearch = useCallback(() => {
    dialogs.close();
  }, []);

  // Picking a result from the search dialog does three things:
  //   1. Expands every collapsed ancestor so the target is visible.
  //   2. Closes the dialog.
  //   3. After the next paint (rAF), scrolls the target card into view and
  //      adds a short-lived highlight class.
  // The rAF hop is important: expanding ancestors triggers a re-render, and
  // the target card's DOM node may not exist until React has committed that
  // render. Scrolling synchronously would find nothing.
  const handleSelectSearchResult = useCallback(
    (unitId: string) => {
      // 1. Expand every collapsed ancestor so the target is visible.
      for (const ancestor of ancestorsOf(api.state, unitId)) {
        if (ancestor.collapsed) api.toggleCollapsed(ancestor.id);
      }

      // 2. Close the dialog.
      dialogs.close();

      // 3. After React commits the expansion, scroll + highlight.
      requestAnimationFrame(() => {
        // A second rAF guarantees layout after the render from step 1.
        requestAnimationFrame(() => {
          const node = document.querySelector<HTMLElement>(
            `[data-unit-id="${unitId}"]`,
          );
          if (!node) return;
          node.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
          node.classList.add("unit-card--highlight");
          window.setTimeout(() => {
            node.classList.remove("unit-card--highlight");
          }, 1500);
        });
      });
    },
    [api],
  );

  // Compute stats lazily — only walk the graph when the modal is open.
  const stats = useMemo(
    () => (statsOpen ? computeStats(api.state) : null),
    [statsOpen, api.state],
  );

  // ---- Bulk collapse / expand (from context menu) ----

  const collectIdsWithChildren = useCallback((): string[] => {
    // Any unit that has at least one child. Used by the "Collapse all" /
    // "Expand all" context-menu actions. Walks state.units directly rather
    // than calling api.childrenOf per-id to keep the cost at O(N).
    const state = api.state;
    const parentIds = new Set<string>();
    for (const id in state.units) {
      const pid = state.units[id].parentId;
      if (typeof pid === "string" && pid !== UNASSIGNED) {
        parentIds.add(pid);
      }
    }
    return [...parentIds];
  }, [api.state]);

  const handleCollapseAll = useCallback(() => {
    const ids = collectIdsWithChildren();
    api.setAllCollapsed(ids, true);
    flashStatus(`Collapsed ${ids.length} ${ids.length === 1 ? "subtree" : "subtrees"}.`);
  }, [api, collectIdsWithChildren, flashStatus]);

  const handleExpandAll = useCallback(() => {
    const ids = collectIdsWithChildren();
    api.setAllCollapsed(ids, false);
    flashStatus(`Expanded all subtrees.`);
  }, [api, collectIdsWithChildren, flashStatus]);

  const handleToggleCollapsedAction = useCallback(
    (unitId: string) => {
      api.toggleCollapsed(unitId);
    },
    [api],
  );

  // ---- Subtree action helpers ----

  // Count root + descendants via the cached children index.
  const descendantCount = useCallback(
    (rootId: string): number =>
      api.state.units[rootId] ? descendantCountQ(api.state, rootId) + 1 : 0,
    [api.state],
  );

  const handleCopy = useCallback(
    (unitId: string) => {
      const u = api.state.units[unitId];
      if (!u) return;
      const count = descendantCount(unitId);
      api.copySubtree(unitId);
      flashStatus(`Copied "${u.name}" (${count} ${count === 1 ? "unit" : "units"}).`);
    },
    [api, descendantCount, flashStatus],
  );

  const handleCut = useCallback(
    (unitId: string) => {
      const u = api.state.units[unitId];
      if (!u) return;
      const count = descendantCount(unitId);
      api.cutSubtree(unitId);
      flashStatus(`Cut "${u.name}" (${count} ${count === 1 ? "unit" : "units"}).`);
    },
    [api, descendantCount, flashStatus],
  );

  const handleDuplicate = useCallback(
    (unitId: string) => {
      const u = api.state.units[unitId];
      if (!u) return;
      const newId = api.duplicateUnit(unitId);
      if (newId) flashStatus(`Duplicated "${u.name}".`);
    },
    [api, flashStatus],
  );

  const handlePasteAsChild = useCallback(
    (parentId: string) => {
      const clip = api.clipboard;
      if (!clip) return;
      const count = Object.keys(clip.units).length;
      const newId = api.pasteSubtreeAt(parentId);
      if (newId) {
        flashStatus(`Pasted "${clip.sourceName}" (${count} ${count === 1 ? "unit" : "units"}).`);
      }
    },
    [api, flashStatus],
  );

  const handlePasteAsRoot = useCallback(() => {
    const clip = api.clipboard;
    if (!clip) return;
    const count = Object.keys(clip.units).length;
    const newId = api.pasteSubtreeAt(null);
    if (newId) {
      flashStatus(`Pasted "${clip.sourceName}" (${count} ${count === 1 ? "unit" : "units"}).`);
    }
  }, [api, flashStatus]);

  const handlePasteAsUnassigned = useCallback(() => {
    const clip = api.clipboard;
    if (!clip) return;
    const count = Object.keys(clip.units).length;
    const newId = api.pasteSubtreeAt(UNASSIGNED);
    if (newId) {
      flashStatus(`Pasted "${clip.sourceName}" (${count} ${count === 1 ? "unit" : "units"}).`);
    }
  }, [api, flashStatus]);

  const handleContextDelete = useCallback(
    (unitId: string) => {
      const u = api.state.units[unitId];
      const label = u ? u.name : "unit";
      api.deleteUnit(unitId);
      flashStatus(`Deleted "${label}". Children (if any) moved to Unassigned.`);
    },
    [api, flashStatus],
  );

  const handleUndo = useCallback(() => {
    if (!api.canUndo) return;
    api.undo();
    flashStatus("Undid last change.");
  }, [api, flashStatus]);

  const handleRedo = useCallback(() => {
    if (!api.canRedo) return;
    api.redo();
    flashStatus("Redid.");
  }, [api, flashStatus]);

  // ---- Global keyboard shortcuts ----
  //
  // Undo/redo + hover-target copy/cut/duplicate/paste. All guarded so they
  // don't hijack native typing inside form fields.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      // `?` (Shift+/) opens the cheatsheet — non-modifier shortcut.
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dialogs.open("help");
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Undo / redo.
      if (key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
      if (key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Open the Import dialog.
      if (key === "i") {
        e.preventDefault();
        dialogs.open("import");
        return;
      }

      // Open the Search dialog (Ctrl+K / Cmd+K).
      if (key === "k") {
        e.preventDefault();
        dialogs.open("search");
        return;
      }

      // `=` and `+` share a physical key — handle both so zoom-in works
      // with or without Shift.
      if (key === "=" || key === "+") {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (key === "-") {
        e.preventDefault();
        handleZoomOut();
        return;
      }
      if (key === "0") {
        e.preventDefault();
        handleZoomReset();
        return;
      }

      // Subtree ops targeting the hovered unit.
      const hovered = hoveredUnitIdRef.current;

      if (key === "c") {
        // Preserve native copy when the user has a text selection.
        const sel = window.getSelection();
        if (sel && sel.toString() !== "") return;
        if (!hovered) return;
        e.preventDefault();
        handleCopy(hovered);
        return;
      }
      if (key === "x") {
        const sel = window.getSelection();
        if (sel && sel.toString() !== "") return;
        if (!hovered) return;
        e.preventDefault();
        handleCut(hovered);
        return;
      }
      if (key === "d") {
        if (!hovered) return;
        e.preventDefault();
        handleDuplicate(hovered);
        return;
      }
      if (key === "v") {
        if (!api.clipboard) return;
        e.preventDefault();
        if (hovered) {
          handlePasteAsChild(hovered);
        } else {
          handlePasteAsRoot();
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    api.clipboard,
    handleCopy,
    handleCut,
    handleDuplicate,
    handlePasteAsChild,
    handlePasteAsRoot,
    handleRedo,
    handleUndo,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  ]);

  // ---- Library editor handlers ----

  const handleOpenEquipment = useCallback((id: string) => {
    setEquipEditor({ kind: "edit", equipmentId: id });
  }, []);

  const handleNewEquipment = useCallback(() => {
    setEquipEditor({ kind: "create" });
  }, []);

  const handleCancelEquipmentEditor = useCallback(() => {
    setEquipEditor({ kind: "closed" });
  }, []);

  const handleSaveNewEquipment = useCallback(
    (fields: Omit<Equipment, "id">) => {
      api.createEquipment(fields);
      flashStatus(`Created "${fields.name}".`);
      setEquipEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleSaveEditEquipment = useCallback(
    (id: string, fields: Omit<Equipment, "id">) => {
      api.updateEquipment(id, fields);
      flashStatus(`Saved "${fields.name}".`);
      setEquipEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleDeleteEquipment = useCallback(
    (id: string) => {
      const eq = api.state.equipmentLibrary[id];
      const label = eq ? eq.name : "equipment";
      api.deleteEquipment(id);
      flashStatus(`Deleted "${label}".`);
      setEquipEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleOpenSet = useCallback((id: string) => {
    setLibSetEditor({ kind: "edit", setId: id });
  }, []);

  const handleNewSet = useCallback(() => {
    setLibSetEditor({ kind: "create" });
  }, []);

  const handleCancelSetEditor = useCallback(() => {
    setLibSetEditor({ kind: "closed" });
  }, []);

  const handleSaveNewSet = useCallback(
    (fields: Omit<EquipmentSet, "id">) => {
      api.createEquipmentSet(fields);
      flashStatus(`Created "${fields.name}".`);
      setLibSetEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleSaveEditSet = useCallback(
    (id: string, fields: Omit<EquipmentSet, "id">) => {
      api.updateEquipmentSet(id, fields);
      flashStatus(`Saved "${fields.name}".`);
      setLibSetEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  const handleDeleteSet = useCallback(
    (id: string) => {
      const s = api.state.equipmentSets[id];
      const label = s ? s.name : "set";
      api.deleteEquipmentSet(id);
      flashStatus(`Deleted "${label}".`);
      setLibSetEditor({ kind: "closed" });
    },
    [api, flashStatus],
  );

  // Resolve target equipment/set for the editor modals. When the user deletes
  // an entry and the editor is still showing, this may briefly resolve to
  // undefined — EquipmentEditor / SetEditor handle the missing case by doing
  // nothing on delete.
  const equipEditorTarget: Equipment | undefined =
    equipEditor.kind === "edit"
      ? api.state.equipmentLibrary[equipEditor.equipmentId]
      : undefined;
  const equipEditorUsage =
    equipEditor.kind === "edit"
      ? api.equipmentUsageCount(equipEditor.equipmentId)
      : 0;

  const libSetEditorTarget: EquipmentSet | undefined =
    libSetEditor.kind === "edit"
      ? api.state.equipmentSets[libSetEditor.setId]
      : undefined;
  const libSetEditorUsage =
    libSetEditor.kind === "edit"
      ? api.equipmentSetUsageCount(libSetEditor.setId)
      : 0;

  const clipboardLabel = api.clipboard ? api.clipboard.sourceName : null;

  return (
    <DndProvider>
      <div className="app">
        <TopBar
          onNewUnit={handleNewUnit}
          onReset={handleReset}
          onExport={handleExport}
          onExportMarkdown={handleExportMarkdown}
          onExportPng={handleExportPng}
          onExportYaml={handleExportYaml}
          onOpenImport={handleOpenImport}
          onOpenImportYaml={handleOpenImportYaml}
          onOpenSchemaModal={handleOpenSchemaModal}
          onOpenShare={handleOpenShare}
          status={status}
          schemaId={api.state.schemaId}
          onSchemaChange={handleSchemaChange}
          prefix={api.state.prefix ?? ""}
          onPrefixChange={api.setPrefix}
          viewMode={viewMode}
          onSetViewMode={handleSetViewMode}
          theme={theme}
          onCycleTheme={handleCycleTheme}
          coordFormat={coordFormat}
          onCycleCoordFormat={handleCycleCoordFormat}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          layoutPref={layoutPref}
          onCycleLayoutPref={handleCycleLayoutPref}
          canUndo={api.canUndo}
          canRedo={api.canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          clipboardLabel={clipboardLabel}
          onPasteAsRoot={handlePasteAsRoot}
          onPasteAsUnassigned={handlePasteAsUnassigned}
          onOpenStats={handleOpenStats}
          onOpenSearch={handleOpenSearch}
          onOpenHelp={() => dialogs.open("help")}
        />
        {viewMode === "tree" ? (
          <main className="main">
            <Palette
              api={api}
              onDropToUnassigned={handleDropToUnassigned}
              onDropUnit={handleDropOntoUnit}
              onOpenEditor={handleOpenEditor}
              onRenameUnit={handleRenameUnit}
              onOpenContextMenu={handleOpenContextMenu}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              coordFormat={coordFormat}
            />
            <div className="canvas-wrap">
              <section className="canvas" ref={canvasRef}>
                <div
                  className="canvas__zoom"
                  style={
                    {
                      "--canvas-zoom": zoom,
                    } as CSSProperties
                  }
                >
                  <TreeCanvas
                    api={api}
                    onDropUnit={handleDropOntoUnit}
                    onOpenEditor={handleOpenEditor}
                    onRenameUnit={handleRenameUnit}
                    onOpenContextMenu={handleOpenContextMenu}
                    onHoverEnter={handleHoverEnter}
                    onHoverLeave={handleHoverLeave}
                    coordFormat={coordFormat}
                    layoutPref={layoutPref}
                  />
                  <RootDropZone onDropAtRoot={handleDropAtRoot} />
                </div>
              </section>
              {api.state.rootIds.length > 0 ? (
                <MiniMap
                  api={api}
                  canvasRef={canvasRef}
                  zoom={zoom}
                  layoutPref={layoutPref}
                />
              ) : null}
            </div>
          </main>
        ) : viewMode === "library" ? (
          <main className="main main--library">
            <LibraryPage
              api={api}
              onOpenEquipment={handleOpenEquipment}
              onNewEquipment={handleNewEquipment}
              onOpenSet={handleOpenSet}
              onNewSet={handleNewSet}
            />
          </main>
        ) : (
          <main className="main main--map">
            <Suspense
              fallback={
                <div className="map-view__loading">Loading map{"\u2026"}</div>
              }
            >
              <MapView
                api={api}
                theme={resolveTheme(theme)}
                onOpenEditor={handleOpenEditor}
              />
            </Suspense>
          </main>
        )}
        <Editor
          mode={editor}
          state={api.state}
          onCancel={handleCancelEditor}
          onSaveNew={handleSaveNew}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDelete}
        />
        <EquipmentEditor
          mode={equipEditor}
          equipment={equipEditorTarget}
          usageCount={equipEditorUsage}
          onCancel={handleCancelEquipmentEditor}
          onSaveNew={handleSaveNewEquipment}
          onSaveEdit={handleSaveEditEquipment}
          onDelete={handleDeleteEquipment}
        />
        <SetEditor
          mode={libSetEditor}
          state={api.state}
          set={libSetEditorTarget}
          usageCount={libSetEditorUsage}
          onCancel={handleCancelSetEditor}
          onSaveNew={handleSaveNewSet}
          onSaveEdit={handleSaveEditSet}
          onDelete={handleDeleteSet}
        />
        <ExportDialog
          open={dialogs.active === "export"}
          onCancel={handleCancelExportPng}
          onExport={handleConfirmExportPng}
        />
        <ImportDialog
          open={dialogs.active === "import"}
          currentStateIsEmpty={currentStateIsEmpty}
          onCancel={handleCancelImport}
          onImport={handleConfirmImport}
        />
        <ImportYamlDialog
          open={dialogs.active === "importYaml"}
          currentStateIsEmpty={currentStateIsEmpty}
          onCancel={handleCancelImportYaml}
          onImport={handleConfirmImportYaml}
        />
        <SchemaModal
          open={dialogs.active === "schema"}
          schemaId={api.state.schemaId}
          equipmentLibrary={api.state.equipmentLibrary}
          equipmentSets={api.state.equipmentSets}
          onClose={handleCloseSchemaModal}
          onStatus={flashStatus}
        />
        <ShareDialog
          open={dialogs.active === "share"}
          state={api.state}
          onClose={handleCloseShare}
          onStatus={flashStatus}
        />
        {ctxMenu ? (
          <UnitContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            unitId={ctxMenu.unitId}
            clipboardLabel={clipboardLabel}
            hasChildren={
              ctxMenu.unitId
                ? api.childrenOf(ctxMenu.unitId).length > 0
                : false
            }
            isCollapsed={
              ctxMenu.unitId
                ? !!api.state.units[ctxMenu.unitId]?.collapsed
                : false
            }
            onClose={handleCloseContextMenu}
            onCopy={() => ctxMenu.unitId && handleCopy(ctxMenu.unitId)}
            onCut={() => ctxMenu.unitId && handleCut(ctxMenu.unitId)}
            onDuplicate={() => ctxMenu.unitId && handleDuplicate(ctxMenu.unitId)}
            onPasteAsChild={() =>
              ctxMenu.unitId && handlePasteAsChild(ctxMenu.unitId)
            }
            onEdit={() => ctxMenu.unitId && handleOpenEditor(ctxMenu.unitId)}
            onDelete={() => ctxMenu.unitId && handleContextDelete(ctxMenu.unitId)}
            onToggleCollapsed={() =>
              ctxMenu.unitId && handleToggleCollapsedAction(ctxMenu.unitId)
            }
            onCollapseAll={handleCollapseAll}
            onExpandAll={handleExpandAll}
          />
        ) : null}
        <StatsModal
          open={statsOpen}
          stats={stats}
          onClose={handleCloseStats}
        />
        <SearchDialog
          open={dialogs.active === "search"}
          state={api.state}
          onClose={handleCloseSearch}
          onSelect={handleSelectSearchResult}
        />
        <ShortcutsDialog open={dialogs.active === "help"} onClose={() => dialogs.close()} />
      </div>
    </DndProvider>
  );
}

export default App;
