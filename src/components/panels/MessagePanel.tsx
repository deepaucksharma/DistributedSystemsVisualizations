import type { Message } from '../../types/trace';
import { MESSAGE_COLORS } from '../../types/geometry';

interface MessageArrowProps {
  msg: Message;
}

function MessageArrow({ msg }: MessageArrowProps) {
  const color = MESSAGE_COLORS[msg.type] || '#94a3b8';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: '#94a3b8',
        padding: '2px 0',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span style={{ color: '#e2e8f0', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
        {msg.from}
      </span>
      <span style={{ color, fontSize: 14 }}>&rarr;</span>
      <span style={{ color: '#e2e8f0', fontWeight: 600, minWidth: 40 }}>{msg.to}</span>
      <span
        style={{
          background: `${color}1a`,
          border: `1px solid ${color}44`,
          padding: '1px 6px',
          borderRadius: 3,
          color,
        }}
      >
        {msg.label}
      </span>
    </div>
  );
}

interface MessagePanelProps {
  messages: Message[];
}

export function MessagePanel({ messages }: MessagePanelProps) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '12px 14px',
        border: '1px solid #334155',
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
        Messages
      </div>
      {messages.length === 0 ? (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
          No messages this step
        </div>
      ) : (
        messages.map((msg, i) => <MessageArrow key={i} msg={msg} />)
      )}
    </div>
  );
}
