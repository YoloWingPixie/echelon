// A tiny segmented control — a pill of radio-style toggle buttons. The
// active option sits on a soft info tint; inactive options read as muted
// ghost buttons. Generic over the option value type so consumers can use
// unions like "tree" | "library" without stringly-typing calls.

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string>(props: SegmentedProps<T>) {
  const { value, options, onChange, ariaLabel } = props;
  return (
    <div
      className="segmented"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.title}
            className={
              active
                ? "segmented__option segmented__option--active"
                : "segmented__option"
            }
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
