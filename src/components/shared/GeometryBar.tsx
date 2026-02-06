import type { GeometryKey } from '../../types/trace';
import { GEOMETRIES } from '../../types/geometry';

interface GeometryBarProps {
  active: GeometryKey | null;
}

export function GeometryBar({ active }: GeometryBarProps) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {Object.entries(GEOMETRIES).map(([key, geo]) => {
        const isActive = active === key;
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              background: isActive ? `${geo.color}22` : 'transparent',
              border: `1px solid ${isActive ? geo.color : '#334155'}`,
              color: isActive ? geo.color : '#64748b',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.2s',
            }}
            title={geo.desc}
          >
            <span>{geo.icon}</span>
            <span>{geo.label}</span>
          </div>
        );
      })}
    </div>
  );
}
