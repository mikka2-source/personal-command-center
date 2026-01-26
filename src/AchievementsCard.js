import React from 'react';
import './AchievementsCard.css';

function AchievementsCard() {
  const achievements = [
    { icon: '🏃', title: 'Week Warrior', description: '7 day step streak', unlocked: true, date: 'Unlocked Jan 20' },
    { icon: '😴', title: 'Sleep Master', description: '5 days of 80+ sleep score', unlocked: true, date: 'Unlocked Jan 18' },
    { icon: '👑', title: 'Consistency King', description: '30 day streak', unlocked: false, date: null },
    { icon: '🌅', title: 'Early Bird', description: 'Logged before 7am 5 times', unlocked: false, date: null }
  ];

  return (
    <div className="achievements-card">
      <h2>🏆 Achievements</h2>
      <div className="achievements-grid">
        {achievements.map((achievement, index) => (
          <div key={index} className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">{achievement.icon}</div>
            <div className="achievement-title">{achievement.title}</div>
            <div className="achievement-description">{achievement.description}</div>
            {achievement.date && <div className="achievement-date">{achievement.date}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AchievementsCard;
