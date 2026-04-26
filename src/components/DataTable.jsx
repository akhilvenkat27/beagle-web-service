export default function DataTable({ columns = [], rows = [], renderRow, empty = 'No data' }) {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(16,24,40,0.03)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="rocket-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-tertiary)', height: 72, fontSize: 12 }}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => renderRow(row, idx))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
