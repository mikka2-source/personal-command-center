import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './RapydResearch.css';
import data from './data/rapydCompanies.json';

const PRIORITY_CONFIG = {
  high: { label: 'גבוה', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  medium: { label: 'בינוני', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  confirmed: { label: 'מאושר', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  skip: { label: 'דלג', color: '#64748b', bg: 'rgba(100,116,139,0.12)' }
};

const STATUS_LABELS = {
  confirmed: 'מאושר',
  researched: 'נחקר',
  unknown: 'לא ידוע',
  not_prospect: 'לא רלוונטי'
};

function formatVolume(v) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v}`;
}

function RapydResearch() {
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { companies, summary, industryBreakdown } = data;

  const filtered = companies.filter(c => {
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.legalName.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const maxIndustryPercent = Math.max(...industryBreakdown.map(i => i.percent));

  return (
    <div className="rapyd-page">
      {/* Header */}
      <header className="rapyd-header">
        <div className="rapyd-header-left">
          <Link to="/" className="rapyd-back">← חזרה</Link>
          <h1>🔍 מחקר Rapyd — Mass Payout</h1>
          <p className="rapyd-subtitle">ניתוח חברות מתוך דוח תשלומים</p>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="rapyd-stats-row">
        <div className="rapyd-stat-card">
          <div className="rapyd-stat-value">{formatVolume(summary.totalVolume)}</div>
          <div className="rapyd-stat-label">סה״כ נפח</div>
        </div>
        <div className="rapyd-stat-card">
          <div className="rapyd-stat-value">{summary.totalCompanies}</div>
          <div className="rapyd-stat-label">חברות</div>
        </div>
        <div className="rapyd-stat-card confirmed">
          <div className="rapyd-stat-value">{summary.confirmed}</div>
          <div className="rapyd-stat-label">מאושרות</div>
        </div>
        <div className="rapyd-stat-card research">
          <div className="rapyd-stat-value">{summary.needsResearch}</div>
          <div className="rapyd-stat-label">לחקור</div>
        </div>
        <div className="rapyd-stat-card skip-stat">
          <div className="rapyd-stat-value">{summary.skip}</div>
          <div className="rapyd-stat-label">דלג</div>
        </div>
      </div>

      {/* Industry Breakdown */}
      <div className="rapyd-section">
        <h2 className="rapyd-section-title">📊 חלוקה לפי תעשייה</h2>
        <div className="industry-bars">
          {industryBreakdown.map((ind, i) => (
            <div key={i} className="industry-bar-row">
              <div className="industry-bar-label">
                <span className="industry-name">{ind.name}</span>
                <span className="industry-value">{formatVolume(ind.volume)} ({ind.percent}%)</span>
              </div>
              <div className="industry-bar-track">
                <div
                  className="industry-bar-fill"
                  style={{ width: `${(ind.percent / maxIndustryPercent) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="rapyd-filters">
        <input
          type="text"
          className="rapyd-search"
          placeholder="חיפוש חברה..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="rapyd-filter-group">
          <label>עדיפות:</label>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">הכל</option>
            <option value="high">גבוה</option>
            <option value="medium">בינוני</option>
            <option value="confirmed">מאושר</option>
            <option value="skip">דלג</option>
          </select>
        </div>
        <div className="rapyd-filter-group">
          <label>סטטוס:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">הכל</option>
            <option value="confirmed">מאושר</option>
            <option value="researched">נחקר</option>
            <option value="unknown">לא ידוע</option>
            <option value="not_prospect">לא רלוונטי</option>
          </select>
        </div>
      </div>

      {/* Companies List */}
      <div className="rapyd-companies">
        {filtered.map(company => {
          const pri = PRIORITY_CONFIG[company.priority] || PRIORITY_CONFIG.skip;
          return (
            <div
              key={company.id}
              className={`rapyd-company-card priority-${company.priority}`}
            >
              <div className="company-card-top">
                <span
                  className="priority-badge"
                  style={{ color: pri.color, background: pri.bg }}
                >
                  {pri.label}
                </span>
                <span className="company-volume">{formatVolume(company.volume)}</span>
              </div>

              <div className="company-card-body">
                <h3 className="company-name">{company.name}</h3>
                {company.legalName !== company.name && (
                  <p className="company-legal">{company.legalName}</p>
                )}
                <div className="company-meta">
                  <span className="meta-pill country">{company.country}</span>
                  <span className="meta-pill industry">{company.industry}</span>
                  <span className="meta-pill status">{STATUS_LABELS[company.status] || company.status}</span>
                </div>
                {company.website && (
                  <a
                    href={`https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="company-website"
                  >
                    🔗 {company.website}
                  </a>
                )}
                {company.notes && (
                  <p className="company-notes">{company.notes}</p>
                )}
              </div>

              {company.outreach && (
                <div className="company-card-footer">
                  <span className="outreach-status">
                    📬 {company.outreach === 'pending' ? 'ממתין לפנייה' : company.outreach}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rapyd-empty">אין תוצאות</div>
        )}
      </div>
    </div>
  );
}

export default RapydResearch;
