import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import TabBar from '../../components/TabBar';

const CARDS = [
  { title: 'CSAT report', desc: "Measure and analyze your customer's reviews.", to: '/reports/builder', roles: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'] },
  { title: 'Time tracking report', desc: 'Analyze how your team spends their time where.', to: '/execution/resource-planning', roles: ['admin', 'pmo', 'dh', 'pm', 'exec'] },
  { title: 'Projects Performance', desc: 'Insights on project timelines and task completion.', to: '/reports/portfolio-drilldown', roles: ['admin', 'pmo', 'dh', 'pm', 'exec'] },
  { title: 'People Performance', desc: "Analyze your team's efficiency and utilization.", to: '/execution/resource-planning', roles: ['admin', 'pmo', 'dh', 'pm', 'exec'] },
  { title: 'Operations Insights', desc: "Know what you're doing well and what needs improvement.", to: '/execution/all-tasks', roles: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'] },
  { title: 'Interval IQ', desc: 'Get insights into your projects performance by key events.', to: '/reports/leaderboard', roles: ['admin', 'pmo', 'dh', 'pm'] },
];

const BUILDER_ROLES = ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'];

export default function ReportsHubPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'custom' ? 'custom' : 'default';
  const cards = CARDS.filter((c) => c.roles.includes(user?.role));
  const canOpenBuilder = BUILDER_ROLES.includes(user?.role);

  const onTabChange = (id) => {
    if (id === 'custom') {
      setSearchParams({ tab: 'custom' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <PageHeader title="Reports" icon="📈" />
        <TabBar
          tabs={[
            { id: 'default', label: 'Default Reports' },
            { id: 'custom', label: 'Custom Reports' },
          ]}
          activeTab={activeTab}
          onChange={onTabChange}
        />

        {activeTab === 'default' ? (
          <>
            <h2 style={{ margin: '8px 0 12px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
              Default Reports ({cards.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
              {cards.map((r) => (
                <Link
                  key={r.title}
                  to={r.to}
                  style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 20, background: '#fff' }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: 'inline-grid',
                      placeItems: 'center',
                      background: 'var(--tag-spot-bg)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    ✦
                  </span>
                  <h3 style={{ margin: '12px 0 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{r.desc}</p>
                </Link>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Time analytics reports (5)</h3>
              <p style={{ marginTop: 4, color: '#ef4444', fontSize: 12 }}>Timesheet feature is disabled ⓘ</p>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 8 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Custom reports</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', maxWidth: 640, lineHeight: 1.5 }}>
              Build ad-hoc tables from portfolio-scoped projects, modules, tasks, and people fields. Preview live data,
              save definitions, export CSV, and (for PM+) schedule recurring delivery.
            </p>
            {canOpenBuilder ? (
              <Link
                to="/reports/builder"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  background: 'var(--color-primary, #5B4ED4)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Open Report Builder
              </Link>
            ) : (
              <p style={{ fontSize: 13, color: '#6b7280' }}>You do not have access to the report builder.</p>
            )}
            <ul style={{ margin: '20px 0 0', paddingLeft: 18, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
              <li>Choose columns (project, financials, task, assignee, utilization, …)</li>
              <li>Stack filters (status, tier, dates, text contains)</li>
              <li>Save named reports and re-run or export later</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
