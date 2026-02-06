import { useState, useMemo, useCallback } from "react";

// ─── TRACE DATA: Figure-8 scenario (the coupling law violation) ───
// This is the canonical scenario from the Model: why quorum counting alone fails across epochs.
const FIGURE_8_TRACE = {
  title: "Figure-8: Epoch×Quorum Coupling Violation",
  description: "Shows why commit certificates must be monotone in (Epoch, Index), not just Index.",
  spec: { type: "Linearizable Register", invariant: "Single committed value per index" },
  failureModel: "Crash-recovery with stable storage",
  steps: [
    {
      id: 0,
      event: "Initial state — 3 replicas, epoch 1, R1 is leader",
      narration: "Clean start. All boundaries at 0. R1 holds the authority certificate for epoch 1.",
      replicas: {
        R1: { epoch: 1, leader: true, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
        R2: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
        R3: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
      },
      messages: [],
      certificates: [{ type: "authority", holder: "R1", epoch: 1, detail: "R1 elected leader, epoch 1" }],
      boundaries_moved: [],
      invariants_ok: true,
      geometry_highlight: "authority",
    },
    {
      id: 1,
      event: "Client writes X — R1 appends at index 1",
      narration: "R1 appends X to its local log. E₁ advances to 1. Entry is wet cement — not committed, not durable yet.",
      replicas: {
        R1: { epoch: 1, leader: true, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }] },
        R2: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
        R3: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
      },
      messages: [{ from: "Client", to: "R1", label: "write(X)", type: "request" }],
      certificates: [],
      boundaries_moved: [{ replica: "R1", boundary: "E", from: 0, to: 1 }],
      invariants_ok: true,
      geometry_highlight: null,
    },
    {
      id: 2,
      event: "R1 replicates X to R2 — R2 appends and fsyncs",
      narration: "R2 receives X, appends it, fsyncs to disk. Both E₂ and D₂ advance to 1. Now 2 of 3 replicas have X durably — a majority. But R1 hasn't committed yet.",
      replicas: {
        R1: { epoch: 1, leader: true, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }] },
        R2: { epoch: 1, leader: false, T: 0, D: 1, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }] },
        R3: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
      },
      messages: [
        { from: "R1", to: "R2", label: "append(X, idx=1, e=1)", type: "replication" },
        { from: "R2", to: "R1", label: "ack(fsync, idx=1)", type: "ack" },
      ],
      certificates: [],
      boundaries_moved: [
        { replica: "R2", boundary: "E", from: 0, to: 1 },
        { replica: "R2", boundary: "D", from: 0, to: 1 },
      ],
      invariants_ok: true,
      geometry_highlight: "safety",
    },
    {
      id: 3,
      event: "⚡ R1 crashes before committing X",
      narration: "R1 dies. X is on a majority (R1 memory + R2 disk) but R1 never advanced C. X is NOT committed — it's wet cement on a majority. This is the critical setup for Figure-8.",
      replicas: {
        R1: { epoch: 1, leader: true, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }], crashed: true },
        R2: { epoch: 1, leader: false, T: 0, D: 1, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }] },
        R3: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
      },
      messages: [],
      certificates: [],
      boundaries_moved: [],
      invariants_ok: true,
      geometry_highlight: "failure",
    },
    {
      id: 4,
      event: "R3 elected leader in epoch 2 (R2 + R3 form majority)",
      narration: "R3 wins election with votes from R2 and R3. But R3's log is empty — it doesn't have X. In a naive protocol, R3 might not pick up X from R2's log. The authority certificate transfers to R3.",
      replicas: {
        R1: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }], crashed: true },
        R2: { epoch: 2, leader: false, T: 0, D: 1, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }] },
        R3: { epoch: 2, leader: true, T: 0, D: 0, A: 0, C: 0, E: 0, log: [] },
      },
      messages: [],
      certificates: [{ type: "authority", holder: "R3", epoch: 2, detail: "R3 elected leader, epoch 2, votes: {R2, R3}" }],
      boundaries_moved: [],
      invariants_ok: true,
      geometry_highlight: "authority",
    },
    {
      id: 5,
      event: "Client writes Y — R3 appends Y at index 1, replicates to R2",
      narration: "R3 overwrites index 1 with Y (epoch 2). R2 truncates X and accepts Y — the old branch is pruned. Now the majority has Y at index 1, not X.",
      replicas: {
        R1: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }], crashed: true },
        R2: { epoch: 2, leader: false, T: 0, D: 1, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
        R3: { epoch: 2, leader: true, T: 0, D: 1, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
      },
      messages: [
        { from: "Client", to: "R3", label: "write(Y)", type: "request" },
        { from: "R3", to: "R2", label: "append(Y, idx=1, e=2)", type: "replication" },
        { from: "R2", to: "R3", label: "ack(truncate+fsync)", type: "ack" },
      ],
      certificates: [],
      boundaries_moved: [
        { replica: "R3", boundary: "E", from: 0, to: 1 },
        { replica: "R3", boundary: "D", from: 0, to: 1 },
      ],
      invariants_ok: true,
      geometry_highlight: "coupling",
    },
    {
      id: 6,
      event: "R3 commits Y at index 1 — C advances to 1",
      narration: "R3 has a valid commit certificate: majority (R2+R3) in epoch 2 with Y at index 1. C moves to 1. Y is now on the committed trunk.",
      replicas: {
        R1: { epoch: 1, leader: false, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }], crashed: true },
        R2: { epoch: 2, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
        R3: { epoch: 2, leader: true, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
      },
      messages: [],
      certificates: [{ type: "commit", holder: "R3", epoch: 2, detail: "Commit cert: idx=1, quorum={R2,R3}, epoch=2" }],
      boundaries_moved: [
        { replica: "R2", boundary: "C", from: 0, to: 1 },
        { replica: "R3", boundary: "C", from: 0, to: 1 },
        { replica: "R2", boundary: "A", from: 0, to: 1 },
        { replica: "R3", boundary: "A", from: 0, to: 1 },
      ],
      invariants_ok: true,
      geometry_highlight: "safety",
    },
    {
      id: 7,
      event: "⚡ R1 recovers, wins epoch 3 election with R2",
      narration: "R1 comes back with X still on disk. Gets elected in epoch 3. A NAIVE protocol might let R1 see 'X is on a majority of epoch-1 logs' and try to commit X. This is the Figure-8 danger zone.",
      replicas: {
        R1: { epoch: 3, leader: true, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }], recovered: true },
        R2: { epoch: 3, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
        R3: { epoch: 2, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }], partitioned: true },
      },
      messages: [],
      certificates: [{ type: "authority", holder: "R1", epoch: 3, detail: "R1 elected, epoch 3, votes: {R1, R2}" }],
      boundaries_moved: [],
      invariants_ok: true,
      geometry_highlight: "coupling",
    },
    {
      id: 8,
      event: "🔴 DANGER: Naive commit of X would violate trunk monotonicity",
      narration: "If R1 commits X at (epoch=1, idx=1), it contradicts Y at (epoch=2, idx=1) which is ALREADY on the committed trunk. This is a phantom commit — the coupling law is violated. The fix: R1 must adopt R2's log (which has Y from a higher epoch) before operating.",
      replicas: {
        R1: { epoch: 3, leader: true, T: 0, D: 0, A: 0, C: 0, E: 1, log: [{ idx: 1, val: "X", epoch: 1 }], danger: true },
        R2: { epoch: 3, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
        R3: { epoch: 2, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }], partitioned: true },
      },
      messages: [],
      certificates: [],
      boundaries_moved: [],
      invariants_ok: false,
      violation: {
        type: "coupling",
        law: "Trunk monotonicity in (Epoch, Index)",
        detail: "X at (e=1, idx=1) conflicts with committed Y at (e=2, idx=1). Quorum intersection exists (R2 has Y) but naive index-only counting ignores epoch ordering.",
        framework_ref: "§4.3 Coupling Law: sets × epochs",
      },
      geometry_highlight: "coupling",
    },
    {
      id: 9,
      event: "✅ Correct: R1 adopts R2's higher-epoch log, truncates X",
      narration: "The protocol's fix: during election, R1 discovers R2 has an entry at idx=1 from a higher epoch (2 > 1). R1 truncates its stale branch and adopts Y. The committed trunk is preserved. This is the coupling law in action.",
      replicas: {
        R1: { epoch: 3, leader: true, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
        R2: { epoch: 3, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }] },
        R3: { epoch: 2, leader: false, T: 0, D: 1, A: 1, C: 1, E: 1, log: [{ idx: 1, val: "Y", epoch: 2 }], partitioned: true },
      },
      messages: [
        { from: "R2", to: "R1", label: "log: Y@(e=2, idx=1)", type: "replication" },
      ],
      certificates: [{ type: "commit", holder: "R1", epoch: 3, detail: "R1 adopts committed trunk via R2. Trunk monotonicity preserved." }],
      boundaries_moved: [
        { replica: "R1", boundary: "C", from: 0, to: 1 },
        { replica: "R1", boundary: "A", from: 0, to: 1 },
        { replica: "R1", boundary: "D", from: 0, to: 1 },
      ],
      invariants_ok: true,
      geometry_highlight: "coupling",
    },
  ],
};

// ─── GEOMETRY METADATA ───
const GEOMETRIES = {
  safety: { label: "Safety", color: "#22c55e", icon: "◎", desc: "Quorum intersection — who must confirm" },
  authority: { label: "Authority", color: "#a855f7", icon: "⚑", desc: "Epoch fencing — who may write" },
  coupling: { label: "Coupling", color: "#f59e0b", icon: "⊗", desc: "Sets × Epochs — why both matter" },
  resource: { label: "Resource", color: "#06b6d4", icon: "▤", desc: "Retention & trim — what history is kept" },
  observation: { label: "Observation", color: "#ec4899", icon: "◉", desc: "Read/write contracts — what clients see" },
  failure: { label: "Failure", color: "#ef4444", icon: "⚡", desc: "Fault model — what can break" },
};

const BOUNDARY_META = {
  T: { label: "Trim", color: "#6b7280", desc: "History before this is gone" },
  D: { label: "Durable", color: "#3b82f6", desc: "Persisted to stable storage" },
  A: { label: "Applied", color: "#8b5cf6", desc: "Applied to state machine" },
  C: { label: "Commit", color: "#22c55e", desc: "On the committed trunk" },
  E: { label: "End", color: "#f59e0b", desc: "Last appended (may be wet cement)" },
};

const CERT_COLORS = {
  authority: "#a855f7",
  commit: "#22c55e",
  read: "#ec4899",
  trim: "#06b6d4",
  externalization: "#f97316",
  transaction: "#6366f1",
};

// ─── COMPONENTS ───

function BoundaryLattice({ replica, data, maxIdx }) {
  const scale = maxIdx > 0 ? 100 / (maxIdx + 1) : 100;
  const boundaries = ["T", "D", "A", "C", "E"];
  const crashed = data.crashed;
  const danger = data.danger;
  const partitioned = data.partitioned;

  return (
    <div style={{ position: "relative", marginBottom: 2 }}>
      {/* Replica label */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13, fontWeight: 700, color: "#e2e8f0",
          width: 28,
        }}>{replica}</span>
        {data.leader && <span style={{
          fontSize: 9, background: "#a855f7", color: "#fff",
          padding: "1px 6px", borderRadius: 3, fontWeight: 600,
          letterSpacing: "0.05em",
        }}>LEADER</span>}
        {crashed && <span style={{
          fontSize: 9, background: "#ef4444", color: "#fff",
          padding: "1px 6px", borderRadius: 3, fontWeight: 600,
        }}>CRASHED</span>}
        {data.recovered && <span style={{
          fontSize: 9, background: "#f59e0b", color: "#000",
          padding: "1px 6px", borderRadius: 3, fontWeight: 600,
        }}>RECOVERED</span>}
        {partitioned && <span style={{
          fontSize: 9, background: "#6b7280", color: "#fff",
          padding: "1px 6px", borderRadius: 3, fontWeight: 600,
        }}>PARTITIONED</span>}
        <span style={{
          fontSize: 9, color: "#94a3b8", marginLeft: "auto",
          fontFamily: "'JetBrains Mono', monospace",
        }}>epoch {data.epoch}</span>
      </div>

      {/* The pipeline bar */}
      <div style={{
        position: "relative", height: 32, background: "#1e293b",
        borderRadius: 4, overflow: "hidden",
        border: danger ? "2px solid #ef4444" : crashed ? "1px solid #475569" : "1px solid #334155",
        opacity: crashed ? 0.5 : 1,
      }}>
        {/* Trimmed region */}
        {data.T > 0 && (
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${data.T * scale}%`,
            background: "repeating-linear-gradient(45deg, #1e293b, #1e293b 3px, #0f172a 3px, #0f172a 6px)",
          }} />
        )}
        {/* Committed trunk */}
        {data.C > data.T && (
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${data.T * scale}%`,
            width: `${(data.C - data.T) * scale}%`,
            background: "linear-gradient(90deg, #166534, #22c55e)",
            opacity: 0.7,
          }} />
        )}
        {/* Wet cement */}
        {data.E > data.C && (
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${data.C * scale}%`,
            width: `${(data.E - data.C) * scale}%`,
            background: danger
              ? "repeating-linear-gradient(45deg, #7f1d1d, #7f1d1d 4px, #991b1b 4px, #991b1b 8px)"
              : "linear-gradient(90deg, #a16207, #f59e0b)",
            opacity: 0.6,
          }} />
        )}

        {/* Log entries */}
        {data.log.map((entry, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(entry.idx - 0.4) * scale}%`,
            top: 4, bottom: 4,
            width: `${0.8 * scale}%`,
            minWidth: 22,
            background: entry.epoch === data.epoch ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
            borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#e2e8f0",
            fontFamily: "'JetBrains Mono', monospace",
            border: danger && entry.val === "X" ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)",
          }}>
            {entry.val}
            <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }}>e{entry.epoch}</span>
          </div>
        ))}

        {/* Boundary markers */}
        {boundaries.map((b) => {
          const val = data[b];
          if (val === 0 && b !== "T") return null;
          const meta = BOUNDARY_META[b];
          return (
            <div key={b} style={{
              position: "absolute",
              left: `${val * scale}%`,
              top: b === "D" ? 0 : b === "A" ? 8 : undefined,
              bottom: b === "D" ? 8 : b === "A" ? 0 : 0,
              height: b === "C" ? "100%" : 6,
              width: b === "C" ? 2 : 8,
              background: meta.color,
              borderRadius: b === "C" ? 0 : 2,
              transform: "translateX(-50%)",
              zIndex: b === "C" ? 10 : 5,
              boxShadow: `0 0 4px ${meta.color}66`,
            }}>
              <span style={{
                position: "absolute",
                top: b === "C" ? -14 : -12,
                left: "50%", transform: "translateX(-50%)",
                fontSize: 8, fontWeight: 700, color: meta.color,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: "nowrap",
              }}>{b}={val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CertificateCard({ cert }) {
  const color = CERT_COLORS[cert.type] || "#94a3b8";
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px",
      background: `${color}0d`, border: `1px solid ${color}33`, borderRadius: 6,
      fontSize: 12,
    }}>
      <span style={{
        background: color, color: "#000", fontWeight: 700,
        padding: "1px 6px", borderRadius: 3, fontSize: 10,
        textTransform: "uppercase", whiteSpace: "nowrap", marginTop: 1,
      }}>{cert.type}</span>
      <span style={{ color: "#cbd5e1", lineHeight: 1.4 }}>{cert.detail}</span>
    </div>
  );
}

function MessageArrow({ msg }) {
  const typeColors = {
    request: "#60a5fa",
    replication: "#a78bfa",
    ack: "#34d399",
  };
  const color = typeColors[msg.type] || "#94a3b8";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 11, color: "#94a3b8", padding: "2px 0",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{ color: "#e2e8f0", fontWeight: 600, minWidth: 40, textAlign: "right" }}>{msg.from}</span>
      <span style={{ color, fontSize: 14 }}>→</span>
      <span style={{ color: "#e2e8f0", fontWeight: 600, minWidth: 40 }}>{msg.to}</span>
      <span style={{
        background: `${color}1a`, border: `1px solid ${color}44`,
        padding: "1px 6px", borderRadius: 3, color,
      }}>{msg.label}</span>
    </div>
  );
}

function ViolationBanner({ violation }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
      border: "1px solid #ef4444",
      borderRadius: 8, padding: "12px 16px", marginBottom: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: "#fca5a5",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
      }}>
        ⚠ INVARIANT VIOLATION — {violation.law}
      </div>
      <div style={{ fontSize: 13, color: "#fde8e8", lineHeight: 1.5, marginBottom: 6 }}>
        {violation.detail}
      </div>
      <div style={{
        fontSize: 11, color: "#fca5a5", fontStyle: "italic",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        Framework ref: {violation.framework_ref}
      </div>
    </div>
  );
}

function GeometryBar({ active }) {
  return (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12,
    }}>
      {Object.entries(GEOMETRIES).map(([key, geo]) => {
        const isActive = active === key;
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 4,
            fontSize: 11,
            background: isActive ? `${geo.color}22` : "transparent",
            border: `1px solid ${isActive ? geo.color : "#334155"}`,
            color: isActive ? geo.color : "#64748b",
            fontWeight: isActive ? 700 : 400,
            transition: "all 0.2s",
          }}>
            <span>{geo.icon}</span>
            <span>{geo.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function BoundaryLegend() {
  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
      padding: "8px 12px", background: "#0f172a", borderRadius: 6,
      marginBottom: 12, border: "1px solid #1e293b",
    }}>
      {Object.entries(BOUNDARY_META).map(([key, meta]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2,
            background: meta.color, boxShadow: `0 0 4px ${meta.color}44`,
          }} />
          <span style={{ color: meta.color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{key}</span>
          <span style={{ color: "#64748b" }}>= {meta.desc}</span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 2,
          background: "linear-gradient(90deg, #166534, #22c55e)",
        }} />
        <span style={{ color: "#64748b" }}>Committed trunk</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 2,
          background: "linear-gradient(90deg, #a16207, #f59e0b)",
        }} />
        <span style={{ color: "#64748b" }}>Wet cement</span>
      </div>
    </div>
  );
}

// ─── MAIN APP ───
export default function DistributedSystemsTraceVisualizer() {
  const trace = FIGURE_8_TRACE;
  const [stepIdx, setStepIdx] = useState(0);
  const step = trace.steps[stepIdx];
  const maxIdx = 2; // max log index for scaling

  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, trace.steps.length - 1)), [trace.steps.length]);
  const goPrev = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
  }, [goNext, goPrev]);

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
        background: "#0f172a",
        color: "#e2e8f0",
        minHeight: "100vh",
        padding: "20px 24px",
        outline: "none",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 800, color: "#f8fafc",
          margin: 0, letterSpacing: "-0.02em",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>
          {trace.title}
        </h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.4 }}>
          {trace.description}
        </p>
        <div style={{
          display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#64748b",
        }}>
          <span>Spec: <strong style={{ color: "#94a3b8" }}>{trace.spec.type}</strong></span>
          <span>Fault model: <strong style={{ color: "#94a3b8" }}>{trace.failureModel}</strong></span>
        </div>
      </div>

      {/* Geometry indicator */}
      <GeometryBar active={step.geometry_highlight} />

      {/* Boundary legend */}
      <BoundaryLegend />

      {/* Step navigation */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
      }}>
        <button onClick={goPrev} disabled={stepIdx === 0} style={{
          background: stepIdx === 0 ? "#1e293b" : "#334155",
          color: stepIdx === 0 ? "#475569" : "#e2e8f0",
          border: "1px solid #475569", borderRadius: 6,
          padding: "6px 14px", fontSize: 13, cursor: stepIdx === 0 ? "default" : "pointer",
          fontWeight: 600,
        }}>← Prev</button>

        <div style={{ flex: 1 }}>
          {/* Step progress bar */}
          <div style={{
            display: "flex", gap: 3,
          }}>
            {trace.steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setStepIdx(i)}
                style={{
                  flex: 1, height: 6, borderRadius: 3, border: "none", cursor: "pointer",
                  background: i === stepIdx
                    ? (s.invariants_ok ? "#22c55e" : "#ef4444")
                    : i < stepIdx
                      ? (s.invariants_ok ? "#166534" : "#7f1d1d")
                      : "#1e293b",
                  transition: "background 0.15s",
                }}
              />
            ))}
          </div>
        </div>

        <button onClick={goNext} disabled={stepIdx === trace.steps.length - 1} style={{
          background: stepIdx === trace.steps.length - 1 ? "#1e293b" : "#334155",
          color: stepIdx === trace.steps.length - 1 ? "#475569" : "#e2e8f0",
          border: "1px solid #475569", borderRadius: 6,
          padding: "6px 14px", fontSize: 13,
          cursor: stepIdx === trace.steps.length - 1 ? "default" : "pointer",
          fontWeight: 600,
        }}>Next →</button>

        <span style={{
          fontSize: 12, color: "#64748b", minWidth: 50, textAlign: "right",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {stepIdx + 1}/{trace.steps.length}
        </span>
      </div>

      {/* Event description */}
      <div style={{
        background: "#1e293b", borderRadius: 8, padding: "12px 16px",
        marginBottom: 12, border: step.invariants_ok ? "1px solid #334155" : "1px solid #ef4444",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: step.invariants_ok ? "#f8fafc" : "#fca5a5",
          marginBottom: 4,
        }}>
          Step {step.id}: {step.event}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          {step.narration}
        </div>
      </div>

      {/* Violation banner */}
      {step.violation && <ViolationBanner violation={step.violation} />}

      {/* Pipeline view — the core visual: boundary lattice per replica */}
      <div style={{
        background: "#1e293b", borderRadius: 8, padding: "14px 16px",
        marginBottom: 12, border: "1px solid #334155",
      }}>
        <div style={{
          fontSize: 10, color: "#64748b", textTransform: "uppercase",
          letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10,
        }}>
          History / Boundary Lattice
        </div>
        {Object.entries(step.replicas).map(([name, data]) => (
          <BoundaryLattice key={name} replica={name} data={data} maxIdx={maxIdx} />
        ))}
      </div>

      {/* Two-column: Messages + Certificates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Messages */}
        <div style={{
          background: "#1e293b", borderRadius: 8, padding: "12px 14px",
          border: "1px solid #334155",
        }}>
          <div style={{
            fontSize: 10, color: "#64748b", textTransform: "uppercase",
            letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8,
          }}>
            Messages
          </div>
          {step.messages.length === 0 ? (
            <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>No messages this step</div>
          ) : (
            step.messages.map((msg, i) => <MessageArrow key={i} msg={msg} />)
          )}
        </div>

        {/* Certificates */}
        <div style={{
          background: "#1e293b", borderRadius: 8, padding: "12px 14px",
          border: "1px solid #334155",
        }}>
          <div style={{
            fontSize: 10, color: "#64748b", textTransform: "uppercase",
            letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8,
          }}>
            Certificates Issued
          </div>
          {step.certificates.length === 0 ? (
            <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>No certificates this step</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {step.certificates.map((cert, i) => <CertificateCard key={i} cert={cert} />)}
            </div>
          )}
        </div>
      </div>

      {/* Boundary movements */}
      {step.boundaries_moved.length > 0 && (
        <div style={{
          background: "#1e293b", borderRadius: 8, padding: "12px 14px",
          border: "1px solid #334155", marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10, color: "#64748b", textTransform: "uppercase",
            letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8,
          }}>
            Boundary Movements
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {step.boundaries_moved.map((bm, i) => {
              const meta = BOUNDARY_META[bm.boundary];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 4,
                  background: `${meta.color}11`,
                  border: `1px solid ${meta.color}33`,
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}>
                  <span style={{ color: "#94a3b8" }}>{bm.replica}.</span>
                  <span style={{ color: meta.color, fontWeight: 700 }}>{bm.boundary}</span>
                  <span style={{ color: "#475569" }}>{bm.from}</span>
                  <span style={{ color: "#64748b" }}>→</span>
                  <span style={{ color: meta.color }}>{bm.to}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div style={{
        fontSize: 11, color: "#475569", textAlign: "center",
        marginTop: 8,
      }}>
        Use ← → arrow keys or click the progress bar to navigate • Click to focus
      </div>
    </div>
  );
}
