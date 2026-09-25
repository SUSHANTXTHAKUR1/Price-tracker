import React from 'react';
import { Activity, Plus, RefreshCw, Download, ExternalLink } from 'lucide-react';
import api from '../services/api';

export default function Header({ onOpenSearch, onTriggerScrapeAll, isScrapingAll }) {
  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl(), '_blank');
  };

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon">
          <Activity size={24} color="#ffffff" />
        </div>
        <div>
          <h1 className="brand-title">PricePulse Tracker</h1>
          <p className="brand-subtitle">
            Autonomous Scheduled Price & Stock Monitor for Mock Storefront
          </p>
        </div>
      </div>

      <div className="header-actions">
        <a
          href="https://demo.inelabteamdev.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
          title="Open Mock Storefront in new tab"
        >
          <ExternalLink size={15} />
          Storefront
        </a>

        <button
          onClick={handleExportCsv}
          className="btn btn-secondary btn-sm"
          title="Download Full Scrape Audit History as CSV"
        >
          <Download size={15} />
          Export CSV
        </button>

        <button
          onClick={onTriggerScrapeAll}
          disabled={isScrapingAll}
          className="btn btn-secondary btn-sm"
          title="Run Scheduled Cron Scrape for All Tracked Products"
        >
          <RefreshCw size={15} className={isScrapingAll ? 'animate-spin' : ''} />
          {isScrapingAll ? 'Scraping All...' : 'Scrape All Now'}
        </button>

        <button
          onClick={onOpenSearch}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Track New Product
        </button>
      </div>
    </header>
  );
}
