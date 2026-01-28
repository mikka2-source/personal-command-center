/**
 * Data Confidence Layer
 * 
 * States:
 * - missing_data: No data available (device not worn, sync failed)
 * - low_confidence: Data exists but may be incomplete/unreliable
 * - negative_signal: Data exists and indicates a real issue
 * - high: Data is reliable and complete
 */

// Confidence thresholds
const SLEEP_MIN_HOURS = 1; // Below this = likely didn't wear device
const SLEEP_MAX_HOURS = 14; // Above this = data error
const STEPS_MIN_FOR_WORN = 100; // Need some steps to confirm device was worn
const BODY_BATTERY_MIN = 1;
const BODY_BATTERY_MAX = 100;

/**
 * Analyze sleep data and return confidence assessment
 */
export function analyzeSleepConfidence(healthData) {
  if (!healthData) {
    return {
      state: 'missing_data',
      confidence: 0,
      message: 'אין נתוני שינה',
      showWarning: false // Don't warn on missing data
    };
  }

  const { sleep_hours, sleep_score, body_battery, steps } = healthData;

  // No sleep data recorded
  if (sleep_hours == null && sleep_score == null) {
    // Check if device was worn (has steps or body battery)
    const deviceWorn = (steps && steps > STEPS_MIN_FOR_WORN) || body_battery;
    
    if (!deviceWorn) {
      return {
        state: 'missing_data',
        confidence: 0,
        message: 'לא נמדדה שינה — נראה שהמכשיר לא היה על היד',
        showWarning: false
      };
    }
    
    return {
      state: 'low_confidence',
      confidence: 30,
      message: 'נתוני שינה חלקיים',
      showWarning: false
    };
  }

  const hours = parseFloat(sleep_hours) || 0;

  // Sanity checks
  if (hours < SLEEP_MIN_HOURS) {
    return {
      state: 'missing_data',
      confidence: 10,
      message: 'שינה קצרה מדי — כנראה המכשיר לא היה על היד',
      showWarning: false
    };
  }

  if (hours > SLEEP_MAX_HOURS) {
    return {
      state: 'low_confidence',
      confidence: 20,
      message: 'נתון שינה לא סביר — בדוק סנכרון',
      showWarning: false
    };
  }

  // Real negative signal: bad sleep with high confidence
  if (hours < 5) {
    return {
      state: 'negative_signal',
      confidence: 90,
      message: `${hours.toFixed(1)} שעות שינה — לילה קצר`,
      showWarning: true,
      severity: hours < 4 ? 'high' : 'medium'
    };
  }

  if (hours < 6) {
    return {
      state: 'negative_signal',
      confidence: 85,
      message: `${hours.toFixed(1)} שעות — פחות מהמומלץ`,
      showWarning: true,
      severity: 'low'
    };
  }

  // Good sleep
  return {
    state: 'high',
    confidence: 95,
    message: null,
    showWarning: false
  };
}

/**
 * Analyze sleep trend over multiple days
 */
export function analyzeSleepTrend(healthDataArray, daysToAnalyze = 5) {
  if (!healthDataArray || healthDataArray.length === 0) {
    return {
      trend: 'unknown',
      confidence: 0,
      badNights: 0,
      conservationMode: false,
      message: 'אין מספיק נתונים לניתוח'
    };
  }

  const recentData = healthDataArray.slice(0, daysToAnalyze);
  let badNights = 0;
  let missingNights = 0;
  let validNights = 0;

  for (const day of recentData) {
    const analysis = analyzeSleepConfidence(day);
    
    if (analysis.state === 'missing_data') {
      missingNights++;
    } else if (analysis.state === 'negative_signal') {
      badNights++;
      validNights++;
    } else {
      validNights++;
    }
  }

  // Not enough valid data to make a trend assessment
  if (validNights < 3) {
    return {
      trend: 'insufficient_data',
      confidence: 30,
      badNights,
      missingNights,
      conservationMode: false,
      message: 'לא מספיק נתונים לניתוח מגמה'
    };
  }

  // Conservation mode: 3 or more bad nights out of last 5
  const conservationMode = badNights >= 3;

  if (conservationMode) {
    return {
      trend: 'conservation',
      confidence: 85,
      badNights,
      missingNights,
      conservationMode: true,
      message: `${badNights} לילות קשים מתוך ${validNights} — מצב שימור מופעל`
    };
  }

  if (badNights >= 2) {
    return {
      trend: 'declining',
      confidence: 75,
      badNights,
      missingNights,
      conservationMode: false,
      message: 'מגמת שינה יורדת'
    };
  }

  return {
    trend: 'good',
    confidence: 90,
    badNights,
    missingNights,
    conservationMode: false,
    message: null
  };
}

/**
 * Analyze body battery data
 */
export function analyzeBodyBattery(healthData) {
  if (!healthData?.body_battery) {
    return {
      state: 'missing_data',
      confidence: 0,
      value: null,
      showWarning: false
    };
  }

  const battery = parseInt(healthData.body_battery);

  if (battery < BODY_BATTERY_MIN || battery > BODY_BATTERY_MAX) {
    return {
      state: 'low_confidence',
      confidence: 20,
      value: battery,
      message: 'ערך Body Battery לא תקין',
      showWarning: false
    };
  }

  if (battery < 25) {
    return {
      state: 'negative_signal',
      confidence: 90,
      value: battery,
      message: 'אנרגיה נמוכה מאוד',
      showWarning: true,
      severity: 'high'
    };
  }

  if (battery < 50) {
    return {
      state: 'negative_signal',
      confidence: 85,
      value: battery,
      message: 'אנרגיה בינונית-נמוכה',
      showWarning: true,
      severity: 'low'
    };
  }

  return {
    state: 'high',
    confidence: 95,
    value: battery,
    showWarning: false
  };
}

/**
 * Generate health warnings only when confidence is high enough
 */
export function generateHealthWarnings(healthData, healthHistory) {
  const warnings = [];

  // Analyze sleep
  const sleepAnalysis = analyzeSleepConfidence(healthData);
  if (sleepAnalysis.showWarning && sleepAnalysis.confidence >= 75) {
    warnings.push({
      type: 'sleep',
      message: sleepAnalysis.message,
      severity: sleepAnalysis.severity || 'medium',
      confidence: sleepAnalysis.confidence
    });
  }

  // Analyze sleep trend
  if (healthHistory?.length >= 3) {
    const trendAnalysis = analyzeSleepTrend(healthHistory);
    if (trendAnalysis.conservationMode) {
      warnings.push({
        type: 'conservation',
        message: trendAnalysis.message,
        severity: 'high',
        confidence: trendAnalysis.confidence
      });
    }
  }

  // Analyze body battery
  const batteryAnalysis = analyzeBodyBattery(healthData);
  if (batteryAnalysis.showWarning && batteryAnalysis.confidence >= 75) {
    warnings.push({
      type: 'energy',
      message: batteryAnalysis.message,
      severity: batteryAnalysis.severity || 'medium',
      confidence: batteryAnalysis.confidence
    });
  }

  return warnings;
}

/**
 * Format confidence state for display
 */
export function getConfidenceLabel(state) {
  switch (state) {
    case 'missing_data':
      return { text: 'אין נתונים', icon: '❓', color: '#64748b' };
    case 'low_confidence':
      return { text: 'נתונים חלקיים', icon: '⚠️', color: '#f59e0b' };
    case 'negative_signal':
      return { text: 'בעיה זוהתה', icon: '🔴', color: '#ef4444' };
    case 'high':
      return { text: 'תקין', icon: '✅', color: '#22c55e' };
    default:
      return { text: 'לא ידוע', icon: '❓', color: '#64748b' };
  }
}
