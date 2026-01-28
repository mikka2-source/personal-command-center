/**
 * Decision Engine Core Rules
 * 
 * This module contains the core logic for:
 * - Family Override: Family always wins
 * - Priority Derivation: Priority is calculated, not set
 * - Conflict Resolution: Smart handling of overlapping items
 * - Conservation Mode: Reduced load when sleep is bad
 */

import { analyzeSleepTrend, generateHealthWarnings } from './dataConfidence';

// Domain hierarchy for conflict resolution
const DOMAIN_PRIORITY = {
  family: 100,    // Always wins
  health: 90,     // Almost always wins
  immutable: 85,  // Can't be moved (locked events)
  urgent: 80,     // Time-sensitive
  work: 50,       // Default work priority
  personal: 40,   // Personal but not urgent
  parking: 0      // שממה — no priority
};

/**
 * Calculate derived priority for an item
 * Priority is NOT user-set — it's computed from context
 */
export function calculatePriority(item, context = {}) {
  let priority = DOMAIN_PRIORITY[item.domain] || 50;

  // Family override — bumps to max
  if (item.family_override || item.labels?.includes('family')) {
    priority = 100;
  }

  // Immutable events can't be moved
  if (item.immutable) {
    priority = Math.max(priority, 85);
  }

  // Time sensitivity boost
  if (item.due_date) {
    const hoursUntilDue = (new Date(item.due_date) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilDue < 2) priority += 30;
    else if (hoursUntilDue < 24) priority += 15;
    else if (hoursUntilDue < 48) priority += 5;
  }

  // Energy level consideration in conservation mode
  if (context.conservationMode && item.energy_level === 'high') {
    priority -= 20; // Defer high-energy tasks when tired
  }

  // Dependency boost — if others are waiting on you
  if (item.has_waiting_dependency) {
    priority += 15;
  }

  return Math.min(100, Math.max(0, priority));
}

/**
 * Check if two items conflict (time overlap)
 */
export function checkConflict(itemA, itemB) {
  if (!itemA.start_time || !itemB.start_time) return false;

  const aStart = new Date(itemA.start_time);
  const aEnd = new Date(itemA.end_time || aStart.getTime() + 60 * 60 * 1000);
  const bStart = new Date(itemB.start_time);
  const bEnd = new Date(itemB.end_time || bStart.getTime() + 60 * 60 * 1000);

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Resolve conflicts between items
 * Returns: { winner, loser, action }
 */
export function resolveConflict(itemA, itemB, context = {}) {
  const priorityA = calculatePriority(itemA, context);
  const priorityB = calculatePriority(itemB, context);

  // Family always wins — no auto-reschedule
  if (itemA.family_override && !itemB.family_override) {
    return {
      winner: itemA,
      loser: itemB,
      action: 'defer',
      reason: 'family_override'
    };
  }
  if (itemB.family_override && !itemA.family_override) {
    return {
      winner: itemB,
      loser: itemA,
      action: 'defer',
      reason: 'family_override'
    };
  }

  // Immutable events can't be moved
  if (itemA.immutable && !itemB.immutable) {
    return {
      winner: itemA,
      loser: itemB,
      action: 'reschedule',
      reason: 'immutable_event'
    };
  }
  if (itemB.immutable && !itemA.immutable) {
    return {
      winner: itemB,
      loser: itemA,
      action: 'reschedule',
      reason: 'immutable_event'
    };
  }

  // Priority-based resolution
  if (priorityA > priorityB) {
    return {
      winner: itemA,
      loser: itemB,
      action: priorityB < 40 ? 'parking' : 'defer',
      reason: 'priority'
    };
  }

  return {
    winner: itemB,
    loser: itemA,
    action: priorityA < 40 ? 'parking' : 'defer',
    reason: 'priority'
  };
}

/**
 * Generate daily brief with smart prioritization
 */
export function generateDailyBrief(items, healthData, healthHistory) {
  const context = {
    conservationMode: false,
    warnings: []
  };

  // Check for conservation mode
  if (healthHistory?.length >= 3) {
    const trend = analyzeSleepTrend(healthHistory);
    if (trend.conservationMode) {
      context.conservationMode = true;
      context.warnings.push({
        type: 'conservation',
        message: trend.message,
        severity: 'high'
      });
    }
  }

  // Generate health warnings
  const healthWarnings = generateHealthWarnings(healthData, healthHistory);
  context.warnings.push(...healthWarnings);

  // Sort items by derived priority
  const sortedItems = [...items]
    .map(item => ({
      ...item,
      derivedPriority: calculatePriority(item, context)
    }))
    .sort((a, b) => b.derivedPriority - a.derivedPriority);

  // Split into doing/not doing
  const doing = [];
  const notDoing = [];
  let currentLoad = 0;
  const maxLoad = context.conservationMode ? 60 : 80;

  for (const item of sortedItems) {
    const itemLoad = item.estimated_load || 10;

    // Family items always make the cut
    if (item.family_override) {
      doing.push(item);
      currentLoad += itemLoad;
      continue;
    }

    // High-energy tasks deferred in conservation mode
    if (context.conservationMode && item.energy_level === 'high') {
      notDoing.push({ ...item, reason: 'conservation_mode' });
      continue;
    }

    // Check load capacity
    if (currentLoad + itemLoad <= maxLoad) {
      doing.push(item);
      currentLoad += itemLoad;
    } else {
      notDoing.push({ ...item, reason: 'load_limit' });
    }
  }

  // Calculate load score
  const loadScore = Math.min(100, Math.round((currentLoad / maxLoad) * 100));

  return {
    doing_today: doing.map(i => i.text || i.title),
    doing_today_structured: doing,
    not_doing_today: notDoing.map(i => i.text || i.title),
    not_doing_today_structured: notDoing,
    load_score: loadScore,
    warnings: context.warnings,
    conservation_mode: context.conservationMode,
    generated_at: new Date().toISOString()
  };
}

/**
 * Check if task can be assigned to PA
 */
export function canAssignToPA(task) {
  // PA can't be assigned family or personal tasks
  if (task.family_override || task.labels?.includes('family')) return false;
  if (task.labels?.includes('personal')) return false;
  if (task.domain === 'parking') return false;

  // PA can handle work tasks, coordination, research
  return true;
}

/**
 * Get PA permissions for a task
 */
export function getPAPermissions(task) {
  return {
    canView: true,
    canMarkDone: true,
    canEdit: false,
    canReschedule: false,
    canDelete: false,
    canReassign: false
  };
}
