import React from 'react';
import './PortfolioOverview.css';

function PortfolioOverview() {
  return (
    <div className="portfolio-overview">
      <h2>💼 Portfolio Overview</h2>
      <div className="portfolio-total">$847,340</div>
      <div className="portfolio-stats">
        <div className="portfolio-stat">
          <div className="stat-label">📈 DAILY CHANGE</div>
          <div className="stat-value positive">+$12,450 (+1.5%)</div>
        </div>
        <div className="portfolio-stat">
          <div className="stat-label">📊 ALL-TIME RETURN</div>
          <div className="stat-value positive">+$247,340 (+41.2%)</div>
        </div>
      </div>
    </div>
  );
}

export default PortfolioOverview;
