import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Filter, Search, Terminal } from 'lucide-react';

export default function ScrapeAuditLog({ logs = [] }) {
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [searchLog, setSearchLog] = useState('');

  const filteredLogs = logs.filter((log) => {
    const matchesOutcome = filterOutcome === 'all' || log.outcome === filterOutcome;
    const matchesSearch =
      !searchLog ||
      log.product_name?.toLowerCase().includes(searchLog.toLowerCase()) ||
      String(log.store_product_id).includes(searchLog) ||
      log.selected_option?.toLowerCase().includes(searchLog.toLowerCase());
    return matchesOutcome && matchesSearch;
  });

  const getOutcomeBadge = (outcome) => {
    switch (outcome) {
      case 'success':
        return <span className="badge badge-success"><ShieldCheck size={12} /> Success</span>;
      case 'retried':
        return <span className="badge badge-retried"><AlertTriangle size={12} /> Retried</span>;
      case 'failed':
        return <span className="badge badge-failed"><ShieldAlert size={12} /> Failed</span>;
      default:
        return <span className="badge badge-pending">{outcome}</span>;
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">
            <Terminal size={20} color="var(--accent-secondary)" />
            Scrape Execution & Audit Logs
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Per-product scrape attempts recorded honestly with duration, retry count, and outcomes
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search Logs */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px 6px 30px',
                color: '#ffffff',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          {/* Filter Outcome */}
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="option-select"
            style={{ fontSize: '0.8rem', padding: '6px 10px' }}
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success Only</option>
            <option value="retried">Retried Only</option>
            <option value="failed">Failed Only</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp (UTC)</th>
              <th>Store ID</th>
              <th>Product Name</th>
              <th>Option</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Outcome</th>
              <th>Attempts</th>
              <th>Duration</th>
              <th>Notes / Errors</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No scrape audit records found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => (
                <tr key={log.id || idx}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      #{log.store_product_id}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.product_name}>
                    {log.product_name}
                  </td>
                  <td>
                    <span className="option-badge" style={{ margin: 0, padding: '2px 8px', fontSize: '0.75rem' }}>
                      {log.selected_option}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: log.price ? '#ffffff' : 'var(--text-muted)' }}>
                    {log.price ? `₹${Number(log.price).toLocaleString()}` : '—'}
                  </td>
                  <td>
                    {log.stock !== null && log.stock !== undefined ? (
                      <span style={{ color: log.stock > 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                        {log.stock > 0 ? `${log.stock} units` : 'Out of stock'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{getOutcomeBadge(log.outcome)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {log.attempt_count || 1}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: log.error_message ? 'var(--status-error)' : 'var(--text-muted)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.error_message || ''}>
                    {log.error_message ? log.error_message : 'Scrape completed cleanly'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
