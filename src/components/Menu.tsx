import {
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

// One row in the dropdown. Items without an onClick render as disabled;
// separator items render as a hairline divider instead of a button.
export interface MenuItem {
  label: string;
  sublabel?: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  separator?: boolean;
  groupHeader?: boolean;
  id?: string;
}

export interface MenuProps {
  // The trigger element — must be a single React element that accepts
  // `ref`, `onClick`, and `aria-expanded`. We clone it to wire those up so
  // callers can style it however they want without plumbing extra props.
  trigger: ReactNode;
  items: MenuItem[];
  // Align the menu's left or right edge with the trigger's corresponding edge.
  align?: "start" | "end";
  // Optional aria-label for the popover.
  label?: string;
}

const EDGE_MARGIN = 6;
const GAP = 4;

// Narrow the trigger element to something we can clone with a ref + onClick.
interface TriggerProps {
  ref?: Ref<HTMLElement>;
  onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "menu";
}

// Compute the focusable-item indices for a given items array. Separators and
// disabled items are skipped so arrow-key traversal lands on real actions.
function computeFocusable(items: MenuItem[]): number[] {
  const out: number[] = [];
  items.forEach((it, i) => {
    if (it.separator) return;
    if (!it.onClick) return;
    out.push(i);
  });
  return out;
}

function initialFocusIdx(items: MenuItem[], focusable: number[]): number {
  const activeIdx = items.findIndex(
    (it) => it.active && !it.separator && it.onClick,
  );
  if (activeIdx >= 0) return activeIdx;
  return focusable[0] ?? -1;
}

export function Menu({ trigger, items, align = "start", label }: MenuProps) {
  // Callback refs kept in state so the render pass can safely react to them
  // without touching `.current` during render (the React compiler forbids
  // reading refs during render).
  const [triggerNode, setTriggerNode] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Focus index starts at -1; we set it synchronously in the click handler
  // when opening the menu so we don't need a setState-in-effect.
  const [focusIdx, setFocusIdx] = useState(-1);

  const focusableIndices = computeFocusable(items);

  const close = () => {
    setOpen(false);
    setFocusIdx(-1);
  };

  const openMenu = () => {
    setOpen(true);
    setFocusIdx(initialFocusIdx(items, focusableIndices));
  };

  const toggle = () => {
    if (open) {
      close();
    } else {
      openMenu();
    }
  };

  // Clone the trigger with our ref + click handler + aria plumbing.
  let triggerEl: ReactNode = trigger;
  if (isValidElement(trigger)) {
    const typedTrigger = trigger as ReactElement<TriggerProps>;
    triggerEl = cloneElement(typedTrigger, {
      ref: setTriggerNode,
      onClick: (e: ReactMouseEvent<HTMLElement>) => {
        const prev = typedTrigger.props.onClick;
        if (prev) prev(e);
        toggle();
      },
      "aria-expanded": open,
      "aria-haspopup": "menu",
    });
  }

  // Compute popover position whenever it opens or the viewport changes.
  useLayoutEffect(() => {
    if (!open) return;
    if (!triggerNode) return;
    const tr = triggerNode.getBoundingClientRect();
    const menu = menuRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // First paint uses a best-guess width of 240 (our min-width); the
    // second layout pass (triggered by setPos) re-measures with real
    // dimensions and corrects.
    const mw = menu ? menu.offsetWidth : 240;
    const mh = menu ? menu.offsetHeight : 120;
    let left = align === "end" ? tr.right - mw : tr.left;
    let top = tr.bottom + GAP;
    if (left + mw + EDGE_MARGIN > vw) left = vw - mw - EDGE_MARGIN;
    if (left < EDGE_MARGIN) left = EDGE_MARGIN;
    if (top + mh + EDGE_MARGIN > vh) {
      const flipped = tr.top - mh - GAP;
      top = flipped >= EDGE_MARGIN ? flipped : vh - mh - EDGE_MARGIN;
    }
    setPos({ left, top });
  }, [open, align, triggerNode, items.length]);

  // Close on outside click, Escape, scroll, resize.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      const target = e.target instanceof Node ? e.target : null;
      if (!target) return;
      if (menu && menu.contains(target)) return;
      if (triggerNode && triggerNode.contains(target)) return;
      setOpen(false);
      setFocusIdx(-1);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        setFocusIdx(-1);
        triggerNode?.focus();
      }
    };
    const onDismiss = () => {
      setOpen(false);
      setFocusIdx(-1);
    };
    const onScroll = (e: Event) => {
      const menu = menuRef.current;
      if (menu && e.target instanceof Node && menu.contains(e.target)) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, triggerNode]);

  // Focus the DOM node matching focusIdx whenever it changes while open.
  useEffect(() => {
    if (!open) return;
    if (focusIdx < 0) return;
    const node = menuRef.current?.querySelector<HTMLButtonElement>(
      `[data-menu-idx="${focusIdx}"]`,
    );
    node?.focus();
  }, [focusIdx, open]);

  const moveFocus = (dir: 1 | -1) => {
    if (focusableIndices.length === 0) return;
    const curPos = focusableIndices.indexOf(focusIdx);
    let nextPos = curPos + dir;
    if (nextPos < 0) nextPos = focusableIndices.length - 1;
    if (nextPos >= focusableIndices.length) nextPos = 0;
    setFocusIdx(focusableIndices[nextPos]);
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (focusableIndices[0] !== undefined) {
        setFocusIdx(focusableIndices[0]);
      }
    } else if (e.key === "End") {
      e.preventDefault();
      const last = focusableIndices[focusableIndices.length - 1];
      if (last !== undefined) setFocusIdx(last);
    }
  };

  const pick = (item: MenuItem) => {
    if (!item.onClick) return;
    item.onClick();
    close();
  };

  return (
    <>
      {triggerEl}
      {open && pos ? (
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          aria-label={label}
          style={{ left: pos.left, top: pos.top }}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, i) => {
            if (item.separator) {
              return (
                <div
                  key={item.id ?? `sep-${i}`}
                  className="menu__separator"
                  role="separator"
                />
              );
            }
            if (item.groupHeader) {
              return (
                <div
                  key={item.id ?? `gh-${i}`}
                  className="menu__group-header"
                >
                  {item.label}
                </div>
              );
            }
            const disabled = !item.onClick;
            const classes = ["menu__item"];
            if (item.danger) classes.push("menu__item--danger");
            if (disabled) classes.push("menu__item--disabled");
            if (item.active) classes.push("menu__item--active");
            return (
              <button
                key={item.id ?? `${item.label}-${i}`}
                type="button"
                role="menuitem"
                data-menu-idx={i}
                tabIndex={disabled ? -1 : 0}
                className={classes.join(" ")}
                disabled={disabled}
                onClick={() => pick(item)}
              >
                <span className="menu__item-text">
                  <span className="menu__item-label">{item.label}</span>
                  {item.sublabel ? (
                    <span className="menu__item-sublabel">
                      {item.sublabel}
                    </span>
                  ) : null}
                </span>
                {item.active ? (
                  <span className="menu__item-check" aria-hidden>
                    {"\u2713"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
