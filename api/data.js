// Vercel Serverless Function - Dashboard Data API

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Current data - will be updated by Mikka 2.0
  const data = {
    // Daily Focus - The ONE thing for today
    dailyFocus: {
      id: 1,
      text: "חברות צ'כיות - הכנה לדדליין רביעי",
      area: 'work',
      deadline: '2026-01-28'
    },
    
    // Tasks by priority
    tasks: {
      now: [
        { id: 1, text: 'לדבר עם עידו על Rapid', area: 'work', done: false }
      ],
      today: [
        { id: 2, text: "חברות צ'כיות - עבודה על המסמכים", area: 'work', done: false },
        { id: 3, text: 'ריצה בוקר ✅ 5.2 ק"מ', area: 'health', done: true }
      ],
      later: [
        { id: 4, text: 'Personal Command Center - Supabase integration', area: 'personal', done: false },
        { id: 5, text: 'FLUIDITY/KEEPER - אסטרטגיית אקזיט', area: 'work', done: false },
        { id: 6, text: 'Power BI / Pipedrive API setup', area: 'work', done: false }
      ]
    },
    
    // Morning routine checklist
    morningRoutine: {
      supplements: false,
      workout: true,  // Did the run!
      protein: false,
      meditation: false
    },
    
    // Waiting For - things blocked on others
    waitingFor: [
      { id: 1, text: 'תשובה מעידו על Rapid', person: 'עידו', since: '2026-01-26' },
      { id: 2, text: 'Pipedrive API key', person: 'IT/Admin', since: '2026-01-26' }
    ],
    
    // Active Projects
    activeProjects: [
      { 
        id: 1, 
        name: "חברות צ'כיות", 
        area: 'work', 
        nextStep: 'דדליין רביעי 28/1!',
        urgent: true
      },
      { 
        id: 2, 
        name: 'Personal Command Center', 
        area: 'personal', 
        nextStep: 'Calendar integration'
      },
      { 
        id: 3, 
        name: 'FLUIDITY Exit Strategy', 
        area: 'work', 
        nextStep: 'Prepare buyer deck'
      },
      { 
        id: 4, 
        name: 'KEEPER Exit Strategy', 
        area: 'work', 
        nextStep: 'Patent documentation'
      }
    ],
    
    // Running stats
    running: {
      lastRun: {
        date: '2026-01-26',
        distance: 5.2,
        pace: '7:25/km',
        duration: '39 min',
        improvement: '+48 sec faster than previous'
      },
      goal: '10K באפריל 2026',
      weeklyTarget: '4-5 ריצות'
    },
    
    // Last updated
    lastUpdated: new Date().toISOString()
  };
  
  res.json(data);
};
