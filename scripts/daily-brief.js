#!/usr/bin/env node
/**
 * Daily Brief Generator
 * Formats decision engine output into a WhatsApp-ready Hebrew message
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Config
const SUPABASE_URL = 'https://frbdzhddqbkuzwaqwvwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYmR6aGRkcWJrdXp3YXF3dndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTYxNzEsImV4cCI6MjA4NTA5MjE3MX0.yLOrB38FQ3F_6r7wpVq2z8aVdOjSFuea9nyqP6xzkKE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TODAY = new Date().toISOString().split('T')[0];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב דן 🌅';
  if (hour < 18) return 'צהריים טובים דן ☀️';
  return 'ערב טוב דן 🌙';
}

function buildLoadBar(score) {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getSleepEmoji(trend) {
  switch (trend) {
    case 'good': return '✅ תקין';
    case 'declining': return '⚠️ ירידה';
    case 'conservation': return '🔴 מצב שימור';
    default: return '❓ לא ידוע';
  }
}

function formatBrief(brief) {
  const lines = [];
  
  lines.push(getGreeting());
  lines.push('');
  
  // Doing today
  if (brief.doing_today && brief.doing_today.length > 0) {
    lines.push('📋 עושים היום:');
    brief.doing_today.forEach(item => {
      lines.push(`• ${item}`);
    });
    lines.push('');
  }
  
  // Not doing today
  if (brief.not_doing_today && brief.not_doing_today.length > 0) {
    lines.push('🚫 לא עושים היום:');
    brief.not_doing_today.forEach(item => {
      lines.push(`• ${item}`);
    });
    lines.push('');
  }
  
  // Warning
  if (brief.warning) {
    lines.push(`⚠️ ${brief.warning}`);
    lines.push('');
  }
  
  // Small action
  if (brief.small_action) {
    lines.push(`✨ ${brief.small_action}`);
    lines.push('');
  }
  
  // Load & Sleep
  const loadScore = brief.load_score || 0;
  lines.push(`עומס: ${buildLoadBar(loadScore)} ${loadScore}/100`);
  lines.push(`שינה: ${getSleepEmoji(brief.sleep_trend)}`);
  
  return lines.join('\n');
}

async function main() {
  console.log('📝 Daily Brief Generator\n');
  
  // Try to load from file first (decision engine output)
  const briefPath = path.join(__dirname, '..', 'data', 'daily-brief.json');
  let brief;
  
  if (fs.existsSync(briefPath)) {
    brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
    console.log('  📄 Loaded brief from file');
  } else {
    // Fetch from Supabase
    const { data, error } = await supabase
      .from('daily_briefs')
      .select('*')
      .eq('user_id', 'dan')
      .eq('date', TODAY)
      .single();
    
    if (error || !data) {
      console.log('  ⚠️ No brief found for today. Run decision-engine.js first.');
      
      // Try running decision engine
      console.log('  🧠 Running decision engine...\n');
      const engine = require('./decision-engine');
      brief = await engine.main();
    } else {
      brief = data;
      console.log('  📊 Loaded brief from Supabase');
    }
  }
  
  if (!brief) {
    console.error('❌ Could not generate brief');
    process.exit(1);
  }
  
  // Format the message
  const message = formatBrief(brief);
  
  console.log('\n' + '='.repeat(50));
  console.log('WHATSAPP MESSAGE:');
  console.log('='.repeat(50));
  console.log(message);
  console.log('='.repeat(50));
  
  // Save formatted message
  const messagePath = path.join(__dirname, '..', 'data', 'daily-brief-message.txt');
  fs.writeFileSync(messagePath, message);
  console.log(`\n💾 Message saved to ${messagePath}`);
  
  // NOT sending to WhatsApp (it's late night)
  console.log('\n⏰ Message NOT sent — saved for morning delivery.');
  
  return message;
}

module.exports = { formatBrief, main };

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
