import React from 'react';
import './TopPerformers.css';

function TopPerformers() {
  const performers = [
    { rank: '🏆', ticker: 'BTC', change: '+8.2%', value: '$85,340' },
    { rank: '#2', ticker: 'TSLA', change: '+5.4%', value: '$42,100' },
    { rank: '#3', ticker: 'ETH', change: '+4.1%', value: '$55,230' }
  ];

  return (
    <div className="top-performers">
      <h2>🏆 Top Performers Today</h2>
      <div className="performers-list">
        {performers.map((performer, index) => (
          <div key={index} className="performer-item">
            <div className="performer-rank">{performer.rank}</div>
            <div className="performer-info">
              <div className="performer-ticker">{performer.ticker}</div>
              <div className="performer-value">{performer.value}</div>
            </div>
            <div className="performer-change">{performer.change}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopPerformers;
