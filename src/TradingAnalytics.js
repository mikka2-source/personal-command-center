import React, { useState } from 'react';
import './TradingAnalytics.css';

const MONTHS = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'];
const MONTH_LABELS = ['Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26'];

const monthlyData = {
  '2025-08': { volume: 29547920, trades: 27, btc: 10816109, eth: 847007, usdt: 16724449, usdc: 968728, trx: 191627, other: 0 },
  '2025-09': { volume: 44289020, trades: 40, btc: 13852835, eth: 1365844, usdt: 28166290, usdc: 787701, trx: 116350, other: 0 },
  '2025-10': { volume: 33925131, trades: 45, btc: 10225948, eth: 954004, usdt: 21099664, usdc: 1545932, trx: 99582, other: 0 },
  '2025-11': { volume: 30806384, trades: 65, btc: 9893545, eth: 784505, usdt: 18937352, usdc: 1139647, trx: 71441, other: 0 },
  '2025-12': { volume: 45668496, trades: 69, btc: 14801972, eth: 1457043, usdt: 27682012, usdc: 1671968, trx: 55897, other: 0 },
  '2026-01': { volume: 32184791, trades: 105, btc: 5230581, eth: 574410, usdt: 25033298, usdc: 821840, trx: 524898, other: 89 },
};

const topSymbols = [
  { symbol: 'USDT/EUR', total: 137984891, pct: 63.8 },
  { symbol: 'BTC/EUR', total: 64852526, pct: 30.0 },
  { symbol: 'USDC/EUR', total: 5860500, pct: 2.7 },
  { symbol: 'ETH/EUR', total: 5974861, pct: 2.8 },
  { symbol: 'TRX/EUR', total: 1057467, pct: 0.5 },
  { symbol: 'USDT/USD', total: 636176, pct: 0.3 },
];

const sourceData = [
  { source: 'OTC', volume: 188949166, trades: 50, avgSize: 3778983 },
  { source: 'Convert', volume: 27469594, trades: 255, avgSize: 107724 },
  { source: 'XBO Pay', volume: 2982, trades: 46, avgSize: 65 },
];

const customerData = [
  { name: 'Christoforou Costantinos', account: 'ACC6920', volume: 215458443, trades: 198 },
  { name: 'Christoforou Constantinos', account: 'ACC6636', volume: 960318, trades: 107 },
  { name: 'Konstantin Konstantin', account: 'ACC70395', volume: 2982, trades: 46 },
];

function formatUSD(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatFull(n) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const COIN_COLORS = {
  btc: '#F7931A',
  eth: '#627EEA',
  usdt: '#26A17B',
  usdc: '#2775CA',
  trx: '#FF0013',
  other: '#8884d8',
};

function BarChart({ data, maxVal, label, color }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${(data / maxVal) * 100}%`, background: color || 'var(--accent)' }} />
      </div>
      <span className="bar-value">{formatUSD(data)}</span>
    </div>
  );
}

function StackedBar({ month, data, maxVol }) {
  const coins = ['usdt', 'btc', 'usdc', 'eth', 'trx'];
  const total = data.volume;
  return (
    <div className="stacked-row">
      <span className="bar-label">{month}</span>
      <div className="stacked-track" style={{ width: `${(total / maxVol) * 100}%` }}>
        {coins.map(c => {
          const pct = (data[c] / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={c}
              className="stacked-segment"
              style={{ width: `${pct}%`, background: COIN_COLORS[c] }}
              title={`${c.toUpperCase()}: ${formatUSD(data[c])} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <span className="bar-value">{formatUSD(total)}</span>
    </div>
  );
}

export default function TradingAnalytics() {
  const [tab, setTab] = useState('overview');
  const maxVol = Math.max(...MONTHS.map(m => monthlyData[m].volume));

  const totalVolume = Object.values(monthlyData).reduce((s, d) => s + d.volume, 0);
  const totalTrades = Object.values(monthlyData).reduce((s, d) => s + d.trades, 0);
  const totalBTC = Object.values(monthlyData).reduce((s, d) => s + d.btc, 0);

  const janBTCpct = (monthlyData['2026-01'].btc / monthlyData['2026-01'].volume * 100);
  const avgBTCpct = MONTHS.slice(0, 5).reduce((s, m) => s + (monthlyData[m].btc / monthlyData[m].volume * 100), 0) / 5;

  return (
    <div className="trading-analytics">
      <div className="ta-header">
        <div>
          <h1>📊 XBO Trading Analytics</h1>
          <p className="ta-subtitle">Last 6 Months · Aug 2025 – Jan 2026</p>
        </div>
        <div className="ta-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
          <button className={tab === 'coins' ? 'active' : ''} onClick={() => setTab('coins')}>Coins</button>
          <button className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}>Sources</button>
          <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>Customers</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Volume</span>
          <span className="kpi-value">{formatUSD(totalVolume)}</span>
          <span className="kpi-sub">{totalTrades} trades</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Avg Monthly</span>
          <span className="kpi-value">{formatUSD(totalVolume / 6)}</span>
          <span className="kpi-sub">{Math.round(totalTrades / 6)} trades/mo</span>
        </div>
        <div className="kpi-card highlight-warn">
          <span className="kpi-label">BTC Share (Jan)</span>
          <span className="kpi-value">{janBTCpct.toFixed(1)}%</span>
          <span className="kpi-sub kpi-down">↓ from {avgBTCpct.toFixed(1)}% avg</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total BTC Volume</span>
          <span className="kpi-value">{formatUSD(totalBTC)}</span>
          <span className="kpi-sub">{(totalBTC / totalVolume * 100).toFixed(1)}% of total</span>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          {/* Monthly Volume */}
          <div className="ta-card">
            <h2>Monthly Volume</h2>
            <div className="chart-area">
              {MONTHS.map((m, i) => (
                <BarChart key={m} data={monthlyData[m].volume} maxVal={maxVol} label={MONTH_LABELS[i]} color="var(--accent)" />
              ))}
            </div>
          </div>

          {/* Stacked Coin Breakdown */}
          <div className="ta-card">
            <h2>Coin Mix by Month</h2>
            <div className="legend-row">
              {Object.entries(COIN_COLORS).filter(([k]) => k !== 'other').map(([k, c]) => (
                <span key={k} className="legend-item"><span className="legend-dot" style={{ background: c }} />{k.toUpperCase()}</span>
              ))}
            </div>
            <div className="chart-area">
              {MONTHS.map((m, i) => (
                <StackedBar key={m} month={MONTH_LABELS[i]} data={monthlyData[m]} maxVol={maxVol} />
              ))}
            </div>
          </div>

          {/* BTC Trend */}
          <div className="ta-card highlight-card">
            <h2>🔻 BTC Share Declining</h2>
            <div className="btc-trend">
              {MONTHS.map((m, i) => {
                const pct = (monthlyData[m].btc / monthlyData[m].volume * 100);
                const isJan = m === '2026-01';
                return (
                  <div key={m} className="btc-bar-col">
                    <span className={`btc-pct ${isJan ? 'alert' : ''}`}>{pct.toFixed(0)}%</span>
                    <div className="btc-bar-outer">
                      <div className="btc-bar-inner" style={{
                        height: `${pct * 2.5}px`,
                        background: isJan ? '#ef4444' : COIN_COLORS.btc
                      }} />
                    </div>
                    <span className="btc-month">{MONTH_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>
            <p className="btc-insight">
              BTC dropped from ~32% average to just <strong>16.3%</strong> in January.
              USDT/EUR jumped to <strong>77.3%</strong> — clients shifting to stablecoin conversions.
            </p>
          </div>
        </>
      )}

      {tab === 'coins' && (
        <div className="ta-card">
          <h2>Top Trading Pairs (6-Month Total)</h2>
          <table className="ta-table">
            <thead>
              <tr><th>Symbol</th><th>Volume</th><th>Share</th><th></th></tr>
            </thead>
            <tbody>
              {topSymbols.map(s => (
                <tr key={s.symbol}>
                  <td className="sym-cell">{s.symbol}</td>
                  <td>{formatFull(s.total)}</td>
                  <td>{s.pct}%</td>
                  <td><div className="mini-bar"><div style={{ width: `${s.pct * 1.3}%`, background: 'var(--accent)' }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 32 }}>Monthly Coin Breakdown</h2>
          {MONTHS.map((m, i) => {
            const d = monthlyData[m];
            const coins = [
              { name: 'USDT', val: d.usdt, color: COIN_COLORS.usdt },
              { name: 'BTC', val: d.btc, color: COIN_COLORS.btc },
              { name: 'USDC', val: d.usdc, color: COIN_COLORS.usdc },
              { name: 'ETH', val: d.eth, color: COIN_COLORS.eth },
              { name: 'TRX', val: d.trx, color: COIN_COLORS.trx },
            ];
            return (
              <div key={m} className="month-breakdown">
                <h3>{MONTH_LABELS[i]} — {formatUSD(d.volume)}</h3>
                {coins.map(c => (
                  <div key={c.name} className="coin-row">
                    <span className="coin-dot" style={{ background: c.color }} />
                    <span className="coin-name">{c.name}</span>
                    <span className="coin-pct">{(c.val / d.volume * 100).toFixed(1)}%</span>
                    <span className="coin-vol">{formatUSD(c.val)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sources' && (
        <div className="ta-card">
          <h2>Volume by Source</h2>
          <div className="source-cards">
            {sourceData.map(s => (
              <div key={s.source} className="source-card">
                <h3>{s.source}</h3>
                <div className="source-vol">{formatUSD(s.volume)}</div>
                <div className="source-meta">
                  <span>{s.trades} trades</span>
                  <span>Avg: {formatUSD(s.avgSize)}</span>
                </div>
                <div className="source-pct-bar">
                  <div style={{ width: `${(s.volume / 188949166) * 100}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
          <p className="ta-note">OTC dominates with 87% of volume in only 50 trades (avg $3.8M per trade)</p>
        </div>
      )}

      {tab === 'customers' && (
        <div className="ta-card">
          <h2>Customer Activity</h2>
          <table className="ta-table">
            <thead>
              <tr><th>Customer</th><th>Account</th><th>Volume</th><th>Trades</th><th>Avg Trade</th></tr>
            </thead>
            <tbody>
              {customerData.map(c => (
                <tr key={c.account}>
                  <td>{c.name}</td>
                  <td className="mono">{c.account}</td>
                  <td>{formatFull(c.volume)}</td>
                  <td>{c.trades}</td>
                  <td>{formatUSD(c.volume / c.trades)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ta-note">
            ACC6920 accounts for 99.6% of total volume.
            All customers are Cyprus-based.
          </p>
        </div>
      )}
    </div>
  );
}
