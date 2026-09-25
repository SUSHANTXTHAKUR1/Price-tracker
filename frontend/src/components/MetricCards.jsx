import React from 'react';
import { Package, Clock, ShieldCheck, Database } from 'lucide-react';

export default function MetricCards({ products = [], logs = [] }) {
  const activeCount = products.filter(p => p.is_active).length;
  const totalScrapes = logs.length;
  
  const successfulScrapes = logs.filter(l => l.outcome === 'success' || l.outcome === 'retried').length;
  const successRate = totalScrapes > 0 ? Math.round((successfulScrapes / totalScrapes) * 100) : 100;

  const lastLog = logs[0];
  const lastScrapeTime = lastLog ? new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending';

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-header">
          <span>Active Trackers</span>
          <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Package size={18} />
          </div>
        </div>
        <div className="metric-value">{activeCount}</div>
        <div className="metric-caption">Monitored store products & variants</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span>Scrape Schedule</span>
          <div className="metric-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <Clock size={18} />
          </div>
        </div>
        <div className="metric-value">Every 2 Hrs</div>
        <div className="metric-caption">Last executed: {lastScrapeTime}</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span>Reliability Rate</span>
          <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <ShieldCheck size={18} />
          </div>
        </div>
        <div className="metric-value">{successRate}%</div>
        <div className="metric-caption">Resilient with auto-retries & backoff</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span>Total Scrape Audit Records</span>
          <div className="metric-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <Database size={18} />
          </div>
        </div>
        <div className="metric-value">{totalScrapes}</div>
        <div className="metric-caption">Exportable to CSV anytime</div>
      </div>
    </div>
  );
}
