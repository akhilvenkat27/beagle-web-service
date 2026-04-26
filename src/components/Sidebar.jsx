import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import LogoMark from './LogoMark';

const ROLE = {
  home: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'],
  dashboard: ['admin', 'pmo', 'dh', 'pm', 'exec'],
  reports: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'],
  projects: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'],
  tasks: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'],
  docs: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'],
  people: ['admin', 'pmo', 'dh', 'pm', 'exec'],
  templates: ['admin', 'pmo', 'dh', 'pm', 'exec'],
  settings: ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'],
};

const ICONS = [
  {
    id: 'bell',
    title: 'Notifications',
    to: '/settings/notifications',
    roles: ROLE.settings,
    glyph: (
      <path
        d="M15 17h5l-1.4-1.4c-.4-.4-.6-.9-.6-1.4V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h11Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'home',
    title: 'Home',
    to: '/home',
    roles: ROLE.home,
    glyph: <path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4v-8.5Z" strokeWidth="1.8" strokeLinejoin="round" />,
  },
  {
    id: 'dashboard',
    title: 'Dashboards',
    to: '/dashboard/pmo',
    roles: ROLE.dashboard,
    glyph: (
      <path
        d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM13 10h7v10h-7V10ZM4 13h7v7H4v-7Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'reports',
    title: 'Reports',
    to: '/reports/hub',
    roles: ROLE.reports,
    glyph: (
      <path d="M5 19V5m0 14h14M9 16v-4m4 4V8m4 8v-2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    id: 'projects',
    title: 'Projects',
    to: '/projects',
    roles: ROLE.projects,
    glyph: <path d="M7 4h10l3 3v13H4V4h3Zm0 0v3h7V4" strokeWidth="1.8" strokeLinejoin="round" />,
  },
  {
    id: 'tasks',
    title: 'All tasks',
    to: '/execution/all-tasks',
    roles: ROLE.tasks,
    glyph: <path d="M4 7h3m5 0h8M4 12h3m5 0h8M4 17h3m5 0h8M6 6v2m0 3v2m0 3v2" strokeWidth="1.8" strokeLinecap="round" />,
  },
  {
    id: 'docs',
    title: 'Report Builder',
    to: '/reports/builder',
    roles: ROLE.docs,
    glyph: <path d="M7 3h7l4 4v14H7V3Zm7 0v4h4" strokeWidth="1.8" strokeLinejoin="round" />,
  },
  {
    id: 'people',
    title: 'Resource management',
    to: '/execution/resource-planning',
    roles: ROLE.people,
    glyph: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19a5 5 0 0 1 9 0m2.5 0a4 4 0 0 1 6 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'templates',
    title: 'Templates',
    to: '/execution/templates',
    roles: ROLE.templates,
    glyph: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 5h7" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />,
  },
];

function resolveDashboard(role) {
  if (role === 'admin' || role === 'pmo') return '/dashboard/pmo';
  if (role === 'dh') return '/dashboard/dh';
  if (role === 'pm') return '/dashboard/pm';
  if (role === 'exec') return '/dashboard/exec';
  return '/home';
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user || user.role === 'client') return null;

  const icons = ICONS.map((i) => {
    let to = i.to;
    if (i.id === 'dashboard') to = resolveDashboard(user.role);
    if (i.id === 'projects' && user.role === 'member') to = '/projects';
    return { ...i, to };
  }).filter((i) => i.roles.includes(user.role));

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/home')}
        title="Beagle"
        style={{
          width: '100%',
          height: 48,
          border: 0,
          background: '#fff',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        <LogoMark size={18} />
      </button>

      <nav style={{ flex: 1, width: '100%', overflowY: 'auto' }}>
        {icons.map((item) => {
          const active =
            item.id === 'dashboard'
              ? pathname.startsWith('/dashboard')
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.id}
              to={item.to}
              title={item.title}
              className={`sidebar-icon-link${active ? ' active' : ''}`}
              style={{
                width: '100%',
                height: 44,
                display: 'grid',
                placeItems: 'center',
                color: active ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon-color)',
                background: active ? 'var(--color-primary-light)' : 'transparent',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ flexShrink: 0 }}>
                {item.glyph}
              </svg>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/login');
        }}
        title="Logout"
        style={{
          width: '100%',
          height: 44,
          border: 0,
          background: '#fff',
          color: '#4b5563',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          borderTop: '1px solid var(--sidebar-border)',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>⎋</span>
      </button>

      <div
        style={{
          height: 44,
          display: 'grid',
          placeItems: 'center',
          borderTop: '1px solid var(--sidebar-border)',
        }}
      >
        <Avatar name={user.name || user.email || 'User'} size={24} />
      </div>
    </aside>
  );
}
