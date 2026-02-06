import { useMemo, useState } from 'react';
import type { Message } from '../../types/trace';
import { MESSAGE_COLORS } from '../../types/geometry';

interface AnnotatedMessage extends Message {
  stepId?: number;
  isCurrent: boolean;
}

interface MessageSequenceProps {
  messages: Message[];
  participants: string[];
  /** Messages from prior steps, for cumulative view */
  priorStepMessages?: { stepId: number; messages: Message[] }[];
}

const LANE_WIDTH = 80;
const ARROW_HEIGHT = 36;
const HEADER_HEIGHT = 30;
const MARGIN_LEFT = 20;
const MARGIN_TOP = 10;
const SEPARATOR_HEIGHT = 18;

export function MessageSequence({ messages, participants, priorStepMessages }: MessageSequenceProps) {
  const [cumulative, setCumulative] = useState(false);

  // Build flat annotated message list
  const allMessages: AnnotatedMessage[] = useMemo(() => {
    if (!cumulative || !priorStepMessages || priorStepMessages.length === 0) {
      return messages.map((m) => ({ ...m, isCurrent: true }));
    }
    const result: AnnotatedMessage[] = [];
    for (const group of priorStepMessages) {
      for (const m of group.messages) {
        result.push({ ...m, stepId: group.stepId, isCurrent: false });
      }
    }
    for (const m of messages) {
      result.push({ ...m, isCurrent: true });
    }
    return result;
  }, [messages, priorStepMessages, cumulative]);

  // Build ordered participant list: put "Client" first, then "Admin", "Bank", then replicas alphabetical
  const lanes = useMemo(() => {
    const allParticipants = new Set<string>();
    for (const m of allMessages) {
      allParticipants.add(m.from);
      allParticipants.add(m.to);
    }
    for (const p of participants) {
      allParticipants.add(p);
    }
    const arr = Array.from(allParticipants);
    const specialOrder = ['Client', 'Admin', 'Bank'];
    arr.sort((a, b) => {
      const ai = specialOrder.indexOf(a);
      const bi = specialOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return arr;
  }, [allMessages, participants]);

  // Compute step separators for cumulative view
  const separators = useMemo(() => {
    if (!cumulative) return [];
    const result: { afterIndex: number; stepId: number }[] = [];
    let prevStepId: number | undefined;
    for (let i = 0; i < allMessages.length; i++) {
      const stepId = allMessages[i].isCurrent ? -1 : (allMessages[i].stepId ?? -1);
      if (prevStepId !== undefined && stepId !== prevStepId) {
        result.push({ afterIndex: i, stepId });
      }
      prevStepId = stepId;
    }
    return result;
  }, [allMessages, cumulative]);

  // Early returns AFTER all hooks to satisfy Rules of Hooks
  if (messages.length === 0 && !cumulative) return null;
  if (allMessages.length === 0) return null;

  const laneX = (participant: string) => {
    const idx = lanes.indexOf(participant);
    return MARGIN_LEFT + idx * LANE_WIDTH + LANE_WIDTH / 2;
  };

  const separatorCount = separators.length;
  const svgWidth = MARGIN_LEFT + lanes.length * LANE_WIDTH + 20;
  const svgHeight = MARGIN_TOP + HEADER_HEIGHT + allMessages.length * ARROW_HEIGHT + separatorCount * SEPARATOR_HEIGHT + 20;

  // Compute y position accounting for separators
  const messageY = (msgIndex: number) => {
    const sepsAbove = separators.filter((s) => s.afterIndex <= msgIndex).length;
    return MARGIN_TOP + HEADER_HEIGHT + msgIndex * ARROW_HEIGHT + sepsAbove * SEPARATOR_HEIGHT + ARROW_HEIGHT / 2;
  };

  const hasPrior = priorStepMessages && priorStepMessages.some((g) => g.messages.length > 0);

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
          }}
        >
          Message Sequence
        </div>
        {hasPrior && (
          <button
            onClick={() => setCumulative((c) => !c)}
            style={{
              background: cumulative ? '#334155' : 'transparent',
              border: '1px solid #475569',
              borderRadius: 4,
              color: cumulative ? '#e2e8f0' : '#64748b',
              fontSize: 9,
              padding: '2px 8px',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {cumulative ? 'Cumulative' : 'Current Step'}
          </button>
        )}
      </div>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
          <marker
            id="arrowhead-faded"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#475569" />
          </marker>
        </defs>

        {/* Lane headers */}
        {lanes.map((p) => {
          const x = laneX(p);
          return (
            <g key={`header-${p}`}>
              <text
                x={x}
                y={MARGIN_TOP + 12}
                textAnchor="middle"
                fill={p === 'Client' ? '#60a5fa' : '#e2e8f0'}
                fontSize={11}
                fontWeight={700}
                fontFamily="'JetBrains Mono', monospace"
              >
                {p}
              </text>
              {/* Lifeline */}
              <line
                x1={x}
                y1={MARGIN_TOP + HEADER_HEIGHT - 4}
                x2={x}
                y2={svgHeight - 10}
                stroke="#334155"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            </g>
          );
        })}

        {/* Step separators in cumulative view */}
        {separators.map((sep, si) => {
          const sepY = messageY(sep.afterIndex) - ARROW_HEIGHT / 2 - SEPARATOR_HEIGHT / 2;
          const label = sep.stepId === -1 ? 'current' : `step ${sep.stepId}`;
          return (
            <g key={`sep-${si}`}>
              <line
                x1={MARGIN_LEFT}
                y1={sepY}
                x2={svgWidth - 20}
                y2={sepY}
                stroke="#334155"
                strokeWidth={0.5}
                strokeDasharray="3,3"
              />
              <text
                x={svgWidth - 22}
                y={sepY - 3}
                textAnchor="end"
                fill="#475569"
                fontSize={8}
                fontFamily="'JetBrains Mono', monospace"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Message arrows */}
        {allMessages.map((msg, i) => {
          const fromX = laneX(msg.from);
          const toX = laneX(msg.to);
          const y = messageY(i);
          const baseColor = MESSAGE_COLORS[msg.type] || '#94a3b8';
          const opacity = msg.isCurrent ? 1 : 0.35;
          const color = msg.isCurrent ? baseColor : '#64748b';
          const isSelf = msg.from === msg.to;
          const marker = msg.isCurrent ? 'url(#arrowhead)' : 'url(#arrowhead-faded)';

          if (isSelf) {
            return (
              <g key={i} opacity={opacity}>
                <path
                  d={`M ${fromX} ${y} C ${fromX + 30} ${y - 10}, ${fromX + 30} ${y + 10}, ${fromX} ${y + 8}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  markerEnd={marker}
                />
                <text
                  x={fromX + 34}
                  y={y + 2}
                  fill={color}
                  fontSize={9}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {msg.label}
                </text>
              </g>
            );
          }

          const midX = (fromX + toX) / 2;
          return (
            <g key={i} opacity={opacity}>
              <line
                x1={fromX}
                y1={y}
                x2={toX}
                y2={y}
                stroke={color}
                strokeWidth={1.5}
                markerEnd={marker}
              />
              <text
                x={midX}
                y={y - 6}
                textAnchor="middle"
                fill={color}
                fontSize={9}
                fontFamily="'JetBrains Mono', monospace"
              >
                {msg.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
