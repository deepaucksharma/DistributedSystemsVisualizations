import type { ReactNode, CSSProperties } from 'react';

interface DiffHighlightProps {
  active: boolean;
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function DiffHighlight({
  active,
  children,
  color = '#f59e0b',
  style,
}: DiffHighlightProps) {
  return (
    <div
      style={{
        ...style,
        ...(active
          ? {
              boxShadow: `0 0 8px ${color}44, 0 0 2px ${color}66`,
              outline: `1px solid ${color}66`,
              borderRadius: 4,
              transition: 'box-shadow 0.3s, outline 0.3s',
            }
          : {
              transition: 'box-shadow 0.3s, outline 0.3s',
            }),
      }}
    >
      {children}
    </div>
  );
}
