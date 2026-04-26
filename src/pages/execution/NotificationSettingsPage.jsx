import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Button from '../../components/Button';

const EVENTS = [
  { id: 'followed', event: 'New messages in followed tasks' },
  { id: 'mentions', event: 'Messages mentioning me' },
  { id: 'replies', event: 'Replies to my comments' },
  { id: 'newTasks', event: 'New tasks created in my projects' },
  { id: 'status', event: 'Status changed on assigned tasks' },
  { id: 'dueDate', event: 'Due date shifted' },
];

const channelCell = (checked, onChange) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onChange}
    style={{ width: 14, height: 14, accentColor: 'var(--color-primary)' }}
  />
);

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState(
    EVENTS.reduce((acc, row) => {
      acc[row.id] = { email: row.id === 'mentions', inApp: true, slack: false };
      return acc;
    }, {})
  );

  const setVal = (id, k, v) => setPrefs((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const rows = EVENTS.map((e) => ({ ...e, ...prefs[e.id] }));

  const columns = [
    { key: 'event', label: 'EVENT', width: '1fr' },
    { key: 'email', label: 'EMAIL', width: '100px' },
    { key: 'inApp', label: 'IN-APP', width: '100px' },
    { key: 'slack', label: 'SLACK', width: '100px' },
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <PageHeader title="Notification settings" subtitle="Control which updates are sent through each channel." />
        <DataTable
          columns={columns}
          rows={rows}
          renderRow={(r) => (
            <tr key={r.id}>
              <td style={{ fontSize: 13 }}>{r.event}</td>
              <td>{channelCell(r.email, (e) => setVal(r.id, 'email', e.target.checked))}</td>
              <td>{channelCell(r.inApp, (e) => setVal(r.id, 'inApp', e.target.checked))}</td>
              <td>{channelCell(r.slack, (e) => setVal(r.id, 'slack', e.target.checked))}</td>
            </tr>
          )}
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Button>Save preferences</Button>
        </div>
      </div>
    </div>
  );
}
