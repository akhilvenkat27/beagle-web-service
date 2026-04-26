import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { matrixAPI } from '../services/api';

const STATUS_CONFIG = {
  'Not Started': {
    dotType: 'outline',
    textColor: '#6B7280',
    label: 'Not Started',
  },
  'In Progress': {
    dotType: 'filled',
    textColor: '#374151',
    label: 'In Progress',
    dotColor: '#22C55E',
  },
  Complete: {
    dotType: 'checkbox',
    textColor: '#374151',
    label: 'Complete',
  },
  Blocked: {
    dotType: 'filled',
    textColor: '#374151',
    label: 'Blocked',
    dotColor: '#F59E0B',
  },
  'At Risk': {
    dotType: 'filled',
    textColor: '#374151',
    label: 'At Risk',
    dotColor: '#EF4444',
  },
};

const HEADER_BAND_BRIGHT = '#1E7FD9';
const HEADER_BAND_DEEP = '#1A3A5C';
const HEADER_BORDER = '1px solid rgba(255,255,255,0.2)';

const PHASE_INCEPTION_LIKE = new Set(['Inception', 'Elaboration', 'Configuration', 'Transition']);

function StatusDot({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Not Started'];

  if (config.dotType === 'checkbox') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }} aria-hidden>
        <rect width="18" height="18" rx="3" fill="#3B82F6" />
        <path
          d="M4 9l4 4 6-6"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  if (config.dotType === 'outline') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }} aria-hidden>
        <circle cx="8" cy="8" r="7" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />
      </svg>
    );
  }

  const fill = config.dotColor || '#9CA3AF';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="8" cy="8" r="8" fill={fill} />
    </svg>
  );
}

function StatusCell({ status, isModuleStatus = false }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Not Started'];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 16px',
        height: '100%',
        minHeight: 52,
        fontWeight: isModuleStatus ? 500 : 400,
      }}
    >
      <StatusDot status={status} />
      <span style={{ fontSize: 13, color: config.textColor }}>{config.label}</span>
    </div>
  );
}

function formatMatrixError(err) {
  const status = err.response?.status;
  const msg = err.response?.data?.message;
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
    return 'Cannot reach the API. Is the backend running? For a production build, set REACT_APP_API_URL to your API base (e.g. http://localhost:5000/api).';
  }
  if (status === 404) {
    return `Module matrix API was not found (404)${msg ? `: ${msg}` : ''}. Restart the Beagle API server so it includes the /api/matrix route, then use Retry.`;
  }
  if (status === 401) {
    return 'Sign in to load the module matrix.';
  }
  if (status === 403) {
    return msg || 'You do not have access to this project’s matrix.';
  }
  if (status && msg) {
    return `${msg} (HTTP ${status})`;
  }
  if (msg) {
    return msg;
  }
  return err?.message || 'Failed to load module matrix.';
}

function MatrixSkeleton() {
  return (
    <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      <div
        style={{
          height: 44,
          background: 'linear-gradient(90deg, #1A3A5C 0% 20%, #1E7FD9 20% 80%, #1A3A5C 80% 100%)',
          opacity: 0.95,
        }}
      />
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            height: 52,
            background: i % 2 === 0 ? '#F8F9FA' : '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 16,
          }}
        >
          <div style={{ width: 120, height: 14, background: '#E5E7EB', borderRadius: 4 }} />
          {[1, 2, 3, 4, 5, 6].map((j) => (
            <div key={j} style={{ flex: 1, height: 14, background: '#E5E7EB', borderRadius: 4, maxWidth: 100 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ModuleStatusMatrix({ projectId }) {
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMatrix = useCallback(
    async (isBackground = false) => {
      if (!projectId) return;
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }
      try {
        const { data } = await matrixAPI.getByProject(projectId);
        setMatrix(data);
        if (!isBackground) setError(null);
      } catch (err) {
        if (!isBackground) {
          setError(formatMatrixError(err));
        }
        console.error('[ModuleStatusMatrix]', err);
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!projectId) return;
    setMatrix(null);
    setError(null);
    fetchMatrix(false);
  }, [projectId, fetchMatrix]);

  useEffect(() => {
    const onRefresh = (e) => {
      const id = e.detail?.projectId;
      if (id && String(id) === String(projectId)) fetchMatrix(true);
    };
    window.addEventListener('beagle-matrix-refresh', onRefresh);
    return () => window.removeEventListener('beagle-matrix-refresh', onRefresh);
  }, [projectId, fetchMatrix]);

  useEffect(() => {
    if (!projectId) return;
    const t = setInterval(() => fetchMatrix(true), 30000);
    return () => clearInterval(t);
  }, [projectId, fetchMatrix]);

  if (loading && !matrix) return <MatrixSkeleton />;
  if (error)
    return (
      <div
        style={{
          color: '#b91c1c',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: 16,
          fontSize: 13,
          lineHeight: 1.45,
          maxWidth: 720,
        }}
      >
        {error}{' '}
        <button
          type="button"
          onClick={() => fetchMatrix(false)}
          style={{ color: '#5B4ED4', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Retry
        </button>
      </div>
    );
  if (!matrix || !matrix.phases) {
    return (
      <div style={{ color: '#9CA3AF', padding: 24, textAlign: 'center', fontSize: 13 }}>
        No matrix data.
      </div>
    );
  }
  if (matrix.rows.length === 0) {
    return (
      <div style={{ color: '#9CA3AF', padding: 24, textAlign: 'center', fontSize: 13 }}>
        No modules found. Add modules to see the status matrix.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E5E7EB' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 800,
          fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        }}
      >
        <thead>
          <tr style={{ height: 44 }}>
            <th
              style={{
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 4,
                background: HEADER_BAND_DEEP,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                padding: '12px 20px',
                textAlign: 'left',
                width: 200,
                minWidth: 180,
                borderRight: HEADER_BORDER,
                boxShadow: '1px 0 0 #E5E7EB',
              }}
            >
              HCM MODULE
            </th>
            {matrix.phases.map((phase) => {
              const bg = PHASE_INCEPTION_LIKE.has(phase) ? HEADER_BAND_BRIGHT : HEADER_BAND_DEEP;
              return (
                <th
                  key={phase}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    background: bg,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '12px 16px',
                    textAlign: 'center',
                    minWidth: 130,
                    borderRight: HEADER_BORDER,
                  }}
                >
                  {phase}
                </th>
              );
            })}
            <th
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: HEADER_BAND_DEEP,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                padding: '12px 16px',
                textAlign: 'center',
                minWidth: 150,
              }}
            >
              MODULE STATUS
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIdx) => (
            <tr
              key={row.moduleId}
              className="matrix-data-row"
              style={{
                background: rowIdx % 2 === 0 ? '#FFFFFF' : '#F8F9FA',
                borderBottom: '1px solid #E5E7EB',
                height: 52,
              }}
            >
              <td
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  padding: '0 20px',
                  borderRight: '1px solid #E5E7EB',
                  background: rowIdx % 2 === 0 ? '#FFFFFF' : '#F8F9FA',
                  height: 52,
                  boxShadow: '1px 0 0 #E5E7EB',
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${projectId}/modules/${row.moduleId}`)}
                  className="module-matrix-name"
                  style={{
                    color: '#1E5FA8',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  {row.moduleName}
                </button>
              </td>
              {matrix.phases.map((phase) => (
                <td
                  key={phase}
                  style={{
                    borderRight: '1px solid #E5E7EB',
                    height: 52,
                    padding: 0,
                    verticalAlign: 'middle',
                    background: rowIdx % 2 === 0 ? '#FFFFFF' : '#F8F9FA',
                  }}
                >
                  <StatusCell status={row.workstreamStatuses?.[phase] || 'Not Started'} />
                </td>
              ))}
              <td
                style={{
                  height: 52,
                  padding: 0,
                  verticalAlign: 'middle',
                  background: rowIdx % 2 === 0 ? '#FFFFFF' : '#F8F9FA',
                }}
              >
                <StatusCell status={row.moduleStatus} isModuleStatus />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          padding: '8px 16px',
          fontSize: 11,
          color: '#9CA3AF',
          borderTop: '1px solid #F3F4F6',
          background: '#FAFAFA',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {loading && matrix ? 'Updating… ' : null}
          Last updated:{' '}
          {matrix.generatedAt
            ? new Date(matrix.generatedAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            fetchMatrix(false);
          }}
          disabled={loading}
          style={{
            fontSize: 11,
            color: loading ? '#9ca3af' : '#5B4ED4',
            background: 'none',
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            padding: '2px 4px',
          }}
        >
          {loading ? '… Refreshing' : '↻ Refresh'}
        </button>
      </div>
      <style>{`
        .module-matrix-name:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
