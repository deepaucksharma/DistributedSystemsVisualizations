import { useMemo } from 'react';
import type { Step, HistoryTree as HistoryTreeType, LogEntry } from '../../types/trace';

interface HistoryTreeProps {
  step: Step;
}

interface TreeNode {
  idx: number;
  val: string;
  epoch: number;
  committed: boolean;
  branch?: string;
  pruned?: boolean;
}

/**
 * Synthesize a history tree from per-replica logs when step.history_tree is absent.
 * Groups entries by (idx, epoch) to find branches.
 */
function synthesizeTree(step: Step): { trunk: TreeNode[]; branches: Map<string, TreeNode[]> } {
  const commitC = Math.max(...Object.values(step.replicas).map((r) => r.C));

  // Collect all unique entries across replicas
  const entryMap = new Map<string, { entry: LogEntry; replicas: string[] }>();
  for (const [rid, state] of Object.entries(step.replicas)) {
    for (const entry of state.log) {
      const key = `${entry.idx}:${entry.val}:${entry.epoch}`;
      const existing = entryMap.get(key);
      if (existing) {
        existing.replicas.push(rid);
      } else {
        entryMap.set(key, { entry, replicas: [rid] });
      }
    }
  }

  // Determine which entries are on trunk vs branches
  // Trunk: committed entries (idx ≤ C) with highest epoch at each index
  const byIdx = new Map<number, { entry: LogEntry; replicas: string[] }[]>();
  for (const item of entryMap.values()) {
    const arr = byIdx.get(item.entry.idx) || [];
    arr.push(item);
    byIdx.set(item.entry.idx, arr);
  }

  const trunk: TreeNode[] = [];
  const branches = new Map<string, TreeNode[]>();

  for (const [idx, items] of byIdx.entries()) {
    // Sort by epoch descending to find the "winning" entry
    items.sort((a, b) => b.entry.epoch - a.entry.epoch);
    const winner = items[0];

    trunk.push({
      idx,
      val: winner.entry.val,
      epoch: winner.entry.epoch,
      committed: idx <= commitC,
    });

    // Other entries at this index are branches
    for (let i = 1; i < items.length; i++) {
      const branchEntry = items[i].entry;
      const branchId = `e${branchEntry.epoch}`;
      const arr = branches.get(branchId) || [];
      arr.push({
        idx: branchEntry.idx,
        val: branchEntry.val,
        epoch: branchEntry.epoch,
        committed: false,
        branch: branchId,
        pruned: true,
      });
      branches.set(branchId, arr);
    }
  }

  trunk.sort((a, b) => a.idx - b.idx);
  return { trunk, branches };
}

function fromExplicitTree(tree: HistoryTreeType): { trunk: TreeNode[]; branches: Map<string, TreeNode[]> } {
  const trunk = tree.committed_trunk.map((e) => ({
    idx: e.idx,
    val: e.val,
    epoch: e.epoch,
    committed: true,
  }));

  const branches = new Map<string, TreeNode[]>();
  for (const branch of tree.branches) {
    branches.set(
      branch.branch_id,
      branch.entries.map((e) => ({
        idx: e.idx,
        val: e.val,
        epoch: e.epoch,
        committed: false,
        branch: branch.branch_id,
        pruned: branch.status === 'pruned',
      }))
    );
  }

  return { trunk, branches };
}

const BOX_W = 52;
const BOX_H = 28;
const GAP_X = 12;
const MARGIN_LEFT = 20;
const MARGIN_TOP = 40;
const BRANCH_OFFSET_Y = 44;

export function HistoryTree({ step }: HistoryTreeProps) {
  const { trunk, branches } = useMemo(() => {
    if (step.history_tree) return fromExplicitTree(step.history_tree);
    return synthesizeTree(step);
  }, [step]);

  // Don't render if there's nothing interesting
  if (trunk.length === 0 && branches.size === 0) return null;

  const hasBranches = branches.size > 0;
  const branchArray = Array.from(branches.entries());

  const svgWidth = Math.max(
    MARGIN_LEFT + (trunk.length + 1) * (BOX_W + GAP_X) + 20,
    300
  );
  const svgHeight = MARGIN_TOP + BOX_H + (hasBranches ? BRANCH_OFFSET_Y * branchArray.length + 20 : 20);

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '12px 14px',
        border: '1px solid #334155',
        marginBottom: 12,
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        History Tree
      </div>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: 'block' }}
      >
        {/* Trunk line */}
        {trunk.length > 1 && (
          <line
            x1={MARGIN_LEFT + BOX_W / 2}
            y1={MARGIN_TOP + BOX_H / 2}
            x2={MARGIN_LEFT + (trunk.length - 1) * (BOX_W + GAP_X) + BOX_W / 2}
            y2={MARGIN_TOP + BOX_H / 2}
            stroke="#22c55e"
            strokeWidth={2}
            opacity={0.5}
          />
        )}

        {/* Trunk entries */}
        {trunk.map((node, i) => {
          const x = MARGIN_LEFT + i * (BOX_W + GAP_X);
          const y = MARGIN_TOP;
          return (
            <g key={`trunk-${node.idx}`}>
              <rect
                x={x}
                y={y}
                width={BOX_W}
                height={BOX_H}
                rx={4}
                fill={node.committed ? '#16653444' : '#a1620744'}
                stroke={node.committed ? '#22c55e' : '#f59e0b'}
                strokeWidth={1.5}
              />
              <text
                x={x + BOX_W / 2}
                y={y + BOX_H / 2 - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#e2e8f0"
                fontSize={12}
                fontWeight={700}
                fontFamily="'JetBrains Mono', monospace"
              >
                {node.val}
              </text>
              <text
                x={x + BOX_W / 2}
                y={y + BOX_H / 2 + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#64748b"
                fontSize={8}
                fontFamily="'JetBrains Mono', monospace"
              >
                e{node.epoch} i{node.idx}
              </text>
            </g>
          );
        })}

        {/* Branches */}
        {branchArray.map(([branchId, nodes], branchIdx) => {
          // Find where this branch diverges from the trunk
          const firstNode = nodes[0];
          if (!firstNode) return null;
          const trunkIdx = trunk.findIndex((t) => t.idx === firstNode.idx);
          const forkX = trunkIdx >= 0
            ? MARGIN_LEFT + trunkIdx * (BOX_W + GAP_X) + BOX_W / 2
            : MARGIN_LEFT + BOX_W / 2;
          const forkY = MARGIN_TOP + BOX_H / 2;
          const branchY = MARGIN_TOP + BOX_H + 16 + branchIdx * BRANCH_OFFSET_Y;

          return (
            <g key={branchId}>
              {/* Fork line */}
              <line
                x1={forkX}
                y1={forkY}
                x2={forkX + 20}
                y2={branchY + BOX_H / 2}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4,3"
                opacity={0.6}
              />

              {/* Branch entries */}
              {nodes.map((node, ni) => {
                const x = forkX + 20 + ni * (BOX_W + GAP_X);
                const y = branchY;
                return (
                  <g key={`${branchId}-${node.idx}`}>
                    <rect
                      x={x}
                      y={y}
                      width={BOX_W}
                      height={BOX_H}
                      rx={4}
                      fill="#7f1d1d22"
                      stroke="#ef4444"
                      strokeWidth={1}
                      strokeDasharray={node.pruned ? '4,3' : 'none'}
                      opacity={node.pruned ? 0.5 : 0.8}
                    />
                    <text
                      x={x + BOX_W / 2}
                      y={y + BOX_H / 2 - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={node.pruned ? '#ef4444' : '#fca5a5'}
                      fontSize={12}
                      fontWeight={700}
                      fontFamily="'JetBrains Mono', monospace"
                      textDecoration={node.pruned ? 'line-through' : 'none'}
                    >
                      {node.val}
                    </text>
                    <text
                      x={x + BOX_W / 2}
                      y={y + BOX_H / 2 + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#64748b"
                      fontSize={8}
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      e{node.epoch} i{node.idx}
                    </text>
                  </g>
                );
              })}

              {/* Branch label */}
              <text
                x={forkX + 20}
                y={branchY - 4}
                fill="#ef4444"
                fontSize={9}
                fontFamily="'JetBrains Mono', monospace"
                opacity={0.7}
              >
                {branchId} {nodes[0]?.pruned ? '(pruned)' : ''}
              </text>
            </g>
          );
        })}

        {/* Trunk label */}
        <text
          x={MARGIN_LEFT}
          y={MARGIN_TOP - 8}
          fill="#22c55e"
          fontSize={9}
          fontWeight={600}
          fontFamily="'JetBrains Mono', monospace"
        >
          committed trunk
        </text>
      </svg>
    </div>
  );
}
