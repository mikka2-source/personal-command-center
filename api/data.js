// Vercel Serverless Function - Dashboard Seed Data API
// Serves initial data on first load when localStorage is empty.
// After first load, all edits are persisted locally (and optionally to Supabase).

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  
  const data = {
    // Daily Focus - The ONE thing for today
    dailyFocus: {
      id: 1,
      text: "חברות צ'כיות - הכנה לדדליין רביעי",
      area: 'work',
      completed: false
    },
    
    // Tasks by priority
    tasks: {
      now: [
        { id: 101, text: 'לדבר עם רגי על Rapyd', area: 'work', done: false, completed: false },
        { id: 102, text: 'לדבר עם עידו על Rapyd', area: 'work', done: false, completed: false }
      ],
      today: [
        { id: 201, text: "חברות צ'כיות - עבודה על המסמכים", area: 'work', done: false, completed: false },
        { id: 202, text: 'Online banking - CTYA + מים + חשמל', area: 'personal', done: false, completed: false },
        { id: 203, text: 'לבדוק ביטוח לאומי בחשבון אישי', area: 'personal', done: false, completed: false }
      ],
      later: [
        { id: 301, text: 'IG Longevity - תוכנית מלאה לחשבון חדש', area: 'personal', done: false, completed: false },
        { id: 302, text: 'Bitwarden - להוסיף סיסמאות (FB, IG, GitHub, Canva)', area: 'personal', done: false, completed: false },
        { id: 303, text: 'Graph API / Power Automate - גישה למשתתפי פגישות', area: 'work', done: false, completed: false },
        { id: 304, text: 'Supabase - הגדרת ענן ל-Command Center', area: 'personal', done: false, completed: false }
      ]
    },
    
    // Morning routine checklist
    morningRoutine: {
      supplements: false,
      workout: false,
      protein: false,
      meditation: false
    },
    
    // Waiting For - things blocked on others
    waitingFor: [
      { id: 1, text: 'Bitwarden הזמנה - dann.mizrahi@gmail.com', person: 'Bitwarden', since: '2026-01-25' },
      { id: 2, text: 'אסי 2000 - follow up', person: 'אסי', since: '2026-01-24' }
    ],
    
    // Active Projects
    activeProjects: [
      { id: 1, name: 'Rapyd Research', area: 'work', nextStep: 'לדבר עם רגי ועידו' },
      { id: 2, name: 'Personal Command Center', area: 'personal', nextStep: 'Supabase integration' },
      { id: 3, name: 'IG Longevity Account', area: 'personal', nextStep: 'תוכנית מלאה' },
      { id: 4, name: "חברות צ'כיות", area: 'work', nextStep: 'דדליין רביעי!', urgent: true }
    ],
    
    lastUpdated: new Date().toISOString()
  };
  
  res.json(data);
};
