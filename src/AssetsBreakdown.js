import React from 'react';
import './AssetsBreakdown.css';

function AssetsBreakdown() {
  const assets = [
    { icon: '📈', label: 'Stocks', value: '$450,000', holdings: '12 holdings', change: '+2.1%', positive: true },
    { icon: '₿', label: 'Crypto', value: '$185,340', holdings: '5 holdings', change: '+4.8%', positive: true },
    { icon: '🏠', label: 'Real Estate', value: '$212,000', holdings: '2 properties', change: '+0.3%', positive: true }
  ];

  return (
    <div className="assets-breakdown">
      <h2>Asset Breakdown</h2>
      <div className="assets-grid">
        {assets.map((asset, index) => (
          <div key={index} className="asset-card">
            <div className="asset-icon">{asset.icon}</div>
            <div className="asset-label">{asset.label}</div>
            <div className="asset-value">{asset.value}</div>
            <div className="asset-holdings">{asset.holdings}</div>
            <div className={`asset-change ${asset.positive ? 'positive' : 'negative'}`}>
              {asset.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AssetsBreakdown;
