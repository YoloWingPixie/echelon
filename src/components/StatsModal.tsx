import { useMemo } from "react";
import type { Stats } from "../stats";
import { formatNumber, roleLabel } from "../format";
import { readinessBand, readinessLabel } from "../strength";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  stats: Stats | null;
  onClose: () => void;
}

// StatsModal follows the same backdrop/panel pattern as Editor and
// ExportDialog: a fixed-position .editor__backdrop hosts a centered panel.
// We reuse those classes rather than introducing a parallel set so the
// visual language stays consistent across modals.

export function StatsModal({ open, stats, onClose }: Props) {
  useEscape(onClose, open);

  if (!open || !stats) return null;

  return (
    <ModalBackdrop onClose={onClose}>
      <section
        className="editor stats-modal"
        aria-label="Statistics"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">Statistics</h2>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="stats-modal__body">
          <StatsContent stats={stats} />
        </div>
      </section>
    </ModalBackdrop>
  );
}

function StatsContent({ stats }: { stats: Stats }) {
  // Pre-compute max bar values once so every row in a given section scales
  // against the section's own maximum.
  const maxEchelon = useMemo(
    () => stats.byEchelon.reduce((m, e) => Math.max(m, e.count), 0),
    [stats.byEchelon],
  );
  const maxRole = useMemo(
    () => stats.byRole.reduce((m, r) => Math.max(m, r.count), 0),
    [stats.byRole],
  );
  const maxAffiliation = useMemo(
    () => stats.byAffiliation.reduce((m, a) => Math.max(m, a.count), 0),
    [stats.byAffiliation],
  );
  const maxTopEquip = useMemo(
    () => stats.topEquipment.reduce((m, e) => Math.max(m, e.quantity), 0),
    [stats.topEquipment],
  );
  const maxPersonnelEchelon = useMemo(
    () => stats.personnelByEchelon.reduce((m, e) => Math.max(m, e.total), 0),
    [stats.personnelByEchelon],
  );
  const maxPersonnelRole = useMemo(
    () => stats.personnelByRole.reduce((m, r) => Math.max(m, r.total), 0),
    [stats.personnelByRole],
  );
  const maxReadiness = useMemo(
    () => stats.byReadiness.reduce((m, r) => Math.max(m, r.count), 0),
    [stats.byReadiness],
  );
  // Skip the whole readiness section when every unit is unrated — the summary
  // line and bar rows would all be zero and the section would add noise.
  const hasReadinessData = useMemo(
    () => stats.byReadiness.some((r) => r.count > 0),
    [stats.byReadiness],
  );

  return (
    <>
      {/* ---- Overview ---- */}
      <div className="stats-modal__cards">
        <StatCard label="Units" value={stats.unitCount} />
        <StatCard label="Roots" value={stats.rootCount} />
        <StatCard label="Unassigned" value={stats.unassignedCount} />
        <StatCard label="Max depth" value={stats.maxDepth} />
        <StatCard label="Coordinates" value={stats.coordinatesCount} />
        <StatCard label="Named Location" value={stats.namedLocationCount} />
      </div>

      {/* ---- Personnel ---- */}
      <section className="stats-modal__section">
        <h3 className="stats-modal__heading">Personnel</h3>
        <div className="stats-modal__personnel-total">
          <span className="stats-modal__personnel-total-label">
            Total Personnel
          </span>
          <span className="stats-modal__personnel-total-value">
            {formatNumber(stats.personnelTotal)}
          </span>
        </div>
        <div className="stats-modal__personnel-sub">
          <h4 className="stats-modal__subheading">By Echelon</h4>
          {stats.personnelByEchelon.length === 0 ||
          stats.personnelTotal === 0 ? (
            <div className="stats-modal__empty">
              No personnel. Set overrides or echelon defaults to populate totals.
            </div>
          ) : (
            <table className="stats-modal__table">
              <thead>
                <tr>
                  <th>Echelon</th>
                  <th className="stats-modal__num">Units</th>
                  <th className="stats-modal__num">Personnel</th>
                  <th className="stats-modal__bar-col">Share</th>
                </tr>
              </thead>
              <tbody>
                {stats.personnelByEchelon.map((e) => (
                  <tr key={e.label}>
                    <td title={e.label}>{e.label}</td>
                    <td className="stats-modal__num">{e.unitCount}</td>
                    <td className="stats-modal__num">
                      {formatNumber(e.total)}
                    </td>
                    <td className="stats-modal__bar-col">
                      <span className="stats-modal__bar stats-modal__bar--inline">
                        <span
                          className="stats-modal__bar-fill"
                          style={{ width: pct(e.total, maxPersonnelEchelon) }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="stats-modal__personnel-sub">
          <h4 className="stats-modal__subheading">By Role</h4>
          {stats.personnelByRole.length === 0 ||
          stats.personnelTotal === 0 ? (
            <div className="stats-modal__empty">No personnel.</div>
          ) : (
            <ul className="stats-modal__bars">
              {stats.personnelByRole.map((r) => {
                const label = roleLabel(r.color);
                return (
                <li key={r.color} className="stats-modal__bar-row">
                  <span
                    className="stats-modal__pill"
                    style={{ background: `var(--${r.color})` }}
                    title={label}
                  />
                  <span
                    className="stats-modal__bar-label"
                    title={label}
                  >
                    {label}
                  </span>
                  <span className="stats-modal__bar">
                    <span
                      className="stats-modal__bar-fill"
                      style={{
                        width: pct(r.total, maxPersonnelRole),
                        background: `var(--${r.color})`,
                      }}
                    />
                  </span>
                  <span className="stats-modal__bar-count">
                    {formatNumber(r.total)}
                  </span>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ---- By Echelon ---- */}
      <section className="stats-modal__section">
        <h3 className="stats-modal__heading">By Echelon</h3>
        {stats.byEchelon.length === 0 ? (
          <div className="stats-modal__empty">No units.</div>
        ) : (
          <ul className="stats-modal__bars">
            {stats.byEchelon.map((e) => (
              <li key={e.label} className="stats-modal__bar-row">
                <span className="stats-modal__bar-label" title={e.label}>
                  {e.label}
                </span>
                <span className="stats-modal__bar">
                  <span
                    className="stats-modal__bar-fill"
                    style={{ width: pct(e.count, maxEchelon) }}
                  />
                </span>
                <span className="stats-modal__bar-count">{e.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- By Role ---- */}
      <section className="stats-modal__section">
        <h3 className="stats-modal__heading">By Role</h3>
        {stats.byRole.length === 0 ? (
          <div className="stats-modal__empty">No units.</div>
        ) : (
          <ul className="stats-modal__bars">
            {stats.byRole.map((r) => (
              <li key={r.color} className="stats-modal__bar-row">
                <span
                  className="stats-modal__pill"
                  style={{ background: `var(--${r.color})` }}
                  title={r.label}
                />
                <span className="stats-modal__bar-label" title={r.label}>
                  {r.label}
                </span>
                <span className="stats-modal__bar">
                  <span
                    className="stats-modal__bar-fill"
                    style={{
                      width: pct(r.count, maxRole),
                      background: `var(--${r.color})`,
                    }}
                  />
                </span>
                <span className="stats-modal__bar-count">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- By Affiliation (only if any unit has a symbol) ---- */}
      {stats.byAffiliation.length > 0 ? (
        <section className="stats-modal__section">
          <h3 className="stats-modal__heading">By Affiliation</h3>
          <ul className="stats-modal__bars">
            {stats.byAffiliation.map((a) => (
              <li key={a.affiliation} className="stats-modal__bar-row">
                <span
                  className="stats-modal__bar-label"
                  title={a.affiliation}
                >
                  {a.affiliation}
                </span>
                <span className="stats-modal__bar">
                  <span
                    className="stats-modal__bar-fill"
                    style={{ width: pct(a.count, maxAffiliation) }}
                  />
                </span>
                <span className="stats-modal__bar-count">{a.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Readiness (C-rating) ---- */}
      {hasReadinessData ? (
        <section className="stats-modal__section">
          <h3 className="stats-modal__heading">Readiness</h3>
          <div className="stats-modal__readiness-summary">
            {stats.byReadiness.map((r, i) => (
              <span key={r.rating}>
                {i > 0 ? " \u00b7 " : null}
                {r.rating}: {r.count}
              </span>
            ))}
            {" \u00b7 "}Unrated: {stats.unratedCount}
          </div>
          <ul className="stats-modal__bars">
            {stats.byReadiness.map((r) => {
              const band = readinessBand(r.rating);
              const label = readinessLabel(r.rating);
              return (
                <li key={r.rating} className="stats-modal__bar-row">
                  <span
                    className={`stats-modal__readiness-dot stats-modal__readiness-dot--${band}`}
                    title={label}
                  />
                  <span className="stats-modal__bar-label" title={label}>
                    {label}
                  </span>
                  <span className="stats-modal__bar">
                    <span
                      className={`stats-modal__bar-fill stats-modal__bar-fill--${band}`}
                      style={{ width: pct(r.count, maxReadiness) }}
                    />
                  </span>
                  <span className="stats-modal__bar-count">{r.count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---- Equipment totals ---- */}
      <div className="stats-modal__cards">
        <StatCard label="Items" value={stats.equipmentRowCount} />
        <StatCard label="Sets" value={stats.setRowCount} />
        <StatCard label="Custom" value={stats.customRowCount} />
        <StatCard
          label="Orphan refs"
          value={stats.orphanRefs}
          danger={stats.orphanRefs > 0}
        />
      </div>

      {/* ---- Top Equipment ---- */}
      <section className="stats-modal__section">
        <h3 className="stats-modal__heading">Top Equipment</h3>
        {stats.topEquipment.length === 0 ? (
          <div className="stats-modal__empty">No equipment attached.</div>
        ) : (
          <table className="stats-modal__table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="stats-modal__num">Qty</th>
                <th className="stats-modal__bar-col">Share</th>
              </tr>
            </thead>
            <tbody>
              {stats.topEquipment.map((e) => (
                <tr key={e.key}>
                  <td title={e.name}>{e.name}</td>
                  <td className="stats-modal__num">{e.quantity}</td>
                  <td className="stats-modal__bar-col">
                    <span className="stats-modal__bar stats-modal__bar--inline">
                      <span
                        className="stats-modal__bar-fill"
                        style={{ width: pct(e.quantity, maxTopEquip) }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---- By Category ---- */}
      <section className="stats-modal__section">
        <h3 className="stats-modal__heading">By Category</h3>
        {stats.byCategory.length === 0 ? (
          <div className="stats-modal__empty">
            No library-linked equipment attached.
          </div>
        ) : (
          <table className="stats-modal__table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="stats-modal__num">Items</th>
                <th className="stats-modal__num">Total qty</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCategory.map((c) => (
                <tr key={c.category}>
                  <td title={c.category}>{c.category}</td>
                  <td className="stats-modal__num">{c.items}</td>
                  <td className="stats-modal__num">{c.totalQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`stats-modal__card${danger ? " stats-modal__card--danger" : ""}`}
    >
      <div className="stats-modal__card-value">{value}</div>
      <div className="stats-modal__card-label">{label}</div>
    </div>
  );
}

function pct(n: number, max: number): string {
  if (max <= 0) return "0%";
  const ratio = n / max;
  // Guarantee a 2% floor so rows with count >= 1 are still visible.
  const v = Math.max(0.02, Math.min(1, ratio));
  return `${(v * 100).toFixed(1)}%`;
}
