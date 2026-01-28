/**
 * Time Awareness Tests
 * 
 * Tests for Command Mode time-based focus switching:
 * 1. Focus item must be future or ongoing
 * 2. Auto-resolve past focus events
 * 3. If no valid focus → Command stays minimal
 */

// Mock Date for consistent testing
const RealDate = Date;

function mockDate(isoString) {
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(isoString);
      } else {
        super(...args);
      }
    }
    static now() {
      return new RealDate(isoString).getTime();
    }
  };
}

function restoreDate() {
  global.Date = RealDate;
}

// Event classification function (from CommandMode.js)
function classifyEventTime(text, startTime, endTime) {
  const now = new Date();
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  if (end && end < now) return 'past';
  if (start && start <= now && (!end || end >= now)) return 'ongoing';
  if (start && start > now) return 'upcoming';
  if (start && start < now) return 'past';
  return 'upcoming';
}

// Focus selector (from CommandMode.js logic)
function selectFocus(items) {
  const classified = items.map(item => ({
    ...item,
    liveStatus: classifyEventTime(item.text, item.startTime, item.endTime)
  }));

  const ongoing = classified.filter(i => i.liveStatus === 'ongoing');
  const upcoming = classified.filter(i => i.liveStatus === 'upcoming');

  // Priority: ongoing > upcoming (tasks without time are included in upcoming)
  if (ongoing.length > 0) return { item: ongoing[0], status: 'ongoing' };
  if (upcoming.length > 0) return { item: upcoming[0], status: 'upcoming' };
  return null;
}

describe('Time Awareness', () => {
  afterEach(() => {
    restoreDate();
  });

  describe('classifyEventTime', () => {
    test('event in the past returns "past"', () => {
      mockDate('2026-01-28T15:00:00Z');
      
      const result = classifyEventTime(
        'Morning meeting',
        '2026-01-28T09:00:00Z',
        '2026-01-28T10:00:00Z'
      );
      
      expect(result).toBe('past');
    });

    test('ongoing event returns "ongoing"', () => {
      mockDate('2026-01-28T14:30:00Z');
      
      const result = classifyEventTime(
        'Afternoon meeting',
        '2026-01-28T14:00:00Z',
        '2026-01-28T15:00:00Z'
      );
      
      expect(result).toBe('ongoing');
    });

    test('future event returns "upcoming"', () => {
      mockDate('2026-01-28T10:00:00Z');
      
      const result = classifyEventTime(
        'Lunch meeting',
        '2026-01-28T12:00:00Z',
        '2026-01-28T13:00:00Z'
      );
      
      expect(result).toBe('upcoming');
    });

    test('event with no end time that started in past is ongoing (safe assumption)', () => {
      mockDate('2026-01-28T15:00:00Z');
      
      const result = classifyEventTime(
        'Quick call',
        '2026-01-28T10:00:00Z',
        null
      );
      
      // With no end time, if start <= now, it's considered ongoing
      // This is safer than assuming it's past
      expect(result).toBe('ongoing');
    });

    test('item with no time defaults to "upcoming"', () => {
      mockDate('2026-01-28T15:00:00Z');
      
      const result = classifyEventTime('Random task', null, null);
      
      expect(result).toBe('upcoming');
    });
  });

  describe('Focus Selection', () => {
    test('ongoing event takes priority over upcoming', () => {
      mockDate('2026-01-28T14:30:00Z');
      
      const items = [
        { text: 'Past event', startTime: '2026-01-28T09:00:00Z', endTime: '2026-01-28T10:00:00Z' },
        { text: 'Current meeting', startTime: '2026-01-28T14:00:00Z', endTime: '2026-01-28T15:00:00Z' },
        { text: 'Future call', startTime: '2026-01-28T16:00:00Z', endTime: '2026-01-28T17:00:00Z' }
      ];
      
      const focus = selectFocus(items);
      
      expect(focus.item.text).toBe('Current meeting');
      expect(focus.status).toBe('ongoing');
    });

    test('upcoming event selected when no ongoing', () => {
      mockDate('2026-01-28T11:00:00Z');
      
      const items = [
        { text: 'Past event', startTime: '2026-01-28T09:00:00Z', endTime: '2026-01-28T10:00:00Z' },
        { text: 'Lunch meeting', startTime: '2026-01-28T12:00:00Z', endTime: '2026-01-28T13:00:00Z' }
      ];
      
      const focus = selectFocus(items);
      
      expect(focus.item.text).toBe('Lunch meeting');
      expect(focus.status).toBe('upcoming');
    });

    test('past events never selected as focus', () => {
      mockDate('2026-01-28T18:00:00Z');
      
      const items = [
        { text: 'Morning event', startTime: '2026-01-28T09:00:00Z', endTime: '2026-01-28T10:00:00Z' },
        { text: 'Noon event', startTime: '2026-01-28T12:00:00Z', endTime: '2026-01-28T13:00:00Z' },
        { text: 'Afternoon event', startTime: '2026-01-28T15:00:00Z', endTime: '2026-01-28T16:00:00Z' }
      ];
      
      const focus = selectFocus(items);
      
      // All events are past, no focus should be selected
      expect(focus).toBeNull();
    });

    test('tasks (no startTime) are classified as upcoming', () => {
      mockDate('2026-01-28T14:00:00Z');
      
      const items = [
        { text: 'Past event', startTime: '2026-01-28T09:00:00Z', endTime: '2026-01-28T10:00:00Z' },
        { text: 'Review document' } // Task with no time
      ];
      
      const focus = selectFocus(items);
      
      // Tasks without startTime are classified as upcoming, not as separate "task" status
      expect(focus.item.text).toBe('Review document');
      expect(focus.status).toBe('upcoming');
    });

    test('no focus when all events past and no tasks', () => {
      mockDate('2026-01-28T20:00:00Z');
      
      const items = [
        { text: 'Event 1', startTime: '2026-01-28T09:00:00Z', endTime: '2026-01-28T10:00:00Z' },
        { text: 'Event 2', startTime: '2026-01-28T14:00:00Z', endTime: '2026-01-28T15:00:00Z' }
      ];
      
      const focus = selectFocus(items);
      
      expect(focus).toBeNull();
    });
  });

  describe('Auto-resolve Past Focus', () => {
    test('focus updates as time passes', () => {
      // At 14:30, meeting is ongoing
      mockDate('2026-01-28T14:30:00Z');
      
      const items = [
        { text: 'Meeting', startTime: '2026-01-28T14:00:00Z', endTime: '2026-01-28T15:00:00Z' },
        { text: 'Next call', startTime: '2026-01-28T16:00:00Z', endTime: '2026-01-28T17:00:00Z' }
      ];
      
      let focus = selectFocus(items);
      expect(focus.item.text).toBe('Meeting');
      expect(focus.status).toBe('ongoing');
      
      // At 15:30, meeting is past, next call is upcoming
      mockDate('2026-01-28T15:30:00Z');
      focus = selectFocus(items);
      expect(focus.item.text).toBe('Next call');
      expect(focus.status).toBe('upcoming');
      
      // At 16:30, next call is ongoing
      mockDate('2026-01-28T16:30:00Z');
      focus = selectFocus(items);
      expect(focus.item.text).toBe('Next call');
      expect(focus.status).toBe('ongoing');
    });
  });

  describe('Minimal Command State', () => {
    test('returns null when no valid focus available', () => {
      mockDate('2026-01-28T22:00:00Z');
      
      const items = [
        { text: 'Event 1', startTime: '2026-01-28T09:00:00Z', endTime: '2026-01-28T10:00:00Z' }
      ];
      
      const focus = selectFocus(items);
      expect(focus).toBeNull();
    });

    test('empty items array returns null', () => {
      mockDate('2026-01-28T14:00:00Z');
      
      const focus = selectFocus([]);
      expect(focus).toBeNull();
    });
  });
});

describe('Data Confidence', () => {
  // Import would be: import { analyzeSleepConfidence } from '../utils/dataConfidence';
  // Inline for test purposes:
  
  function analyzeSleepConfidence(healthData) {
    if (!healthData) {
      return { state: 'missing_data', showWarning: false };
    }
    
    const { sleep_hours, steps } = healthData;
    
    if (sleep_hours == null) {
      const deviceWorn = steps && steps > 100;
      if (!deviceWorn) {
        return { state: 'missing_data', showWarning: false };
      }
      return { state: 'low_confidence', showWarning: false };
    }
    
    const hours = parseFloat(sleep_hours) || 0;
    
    if (hours < 1) {
      return { state: 'missing_data', showWarning: false };
    }
    
    if (hours < 5) {
      return { state: 'negative_signal', showWarning: true, severity: 'high' };
    }
    
    if (hours < 6) {
      return { state: 'negative_signal', showWarning: true, severity: 'low' };
    }
    
    return { state: 'high', showWarning: false };
  }

  test('missing health data does not trigger warning', () => {
    const result = analyzeSleepConfidence(null);
    expect(result.state).toBe('missing_data');
    expect(result.showWarning).toBe(false);
  });

  test('no sleep data without device worn does not warn', () => {
    const result = analyzeSleepConfidence({ steps: 50 });
    expect(result.state).toBe('missing_data');
    expect(result.showWarning).toBe(false);
  });

  test('very short sleep (device not worn) does not warn', () => {
    const result = analyzeSleepConfidence({ sleep_hours: 0.5 });
    expect(result.state).toBe('missing_data');
    expect(result.showWarning).toBe(false);
  });

  test('bad sleep with confidence shows warning', () => {
    const result = analyzeSleepConfidence({ sleep_hours: 4.5 });
    expect(result.state).toBe('negative_signal');
    expect(result.showWarning).toBe(true);
    expect(result.severity).toBe('high');
  });

  test('good sleep does not warn', () => {
    const result = analyzeSleepConfidence({ sleep_hours: 7.5 });
    expect(result.state).toBe('high');
    expect(result.showWarning).toBe(false);
  });
});
