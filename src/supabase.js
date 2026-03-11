// src/supabase.js
// Supabase integration with localStorage fallback when offline

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// If env vars not set yet, supabase will be null and we fall back to localStorage
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ─── LOCAL STORAGE FALLBACK ───────────────────────────────────────────────────
const local = {
  get: (key) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch {}
  }
};

// ─── DB TABLES → LOCAL KEYS MAP ───────────────────────────────────────────────
const TABLE_KEY = {
  workouts:   'apx5_w',
  goals:      'apx5_g',
  cardio:     'apx5_c',
  bball:      'apx5_b',
  checkins:   'apx5_ci',
  body_log:   'apx5_body',
  prs:        'apx5_prs',
  injuries:   'apx5_inj',
  programs:   'apx5_prog',
};

// ─── DEVICE ID (anonymous user identifier) ────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem('apx_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('apx_device_id', id);
  }
  return id;
}

// ─── CORE API ─────────────────────────────────────────────────────────────────

// Load a collection (returns array)
export async function loadCollection(table) {
  const localKey = TABLE_KEY[table];

  if (!supabase) {
    // No Supabase configured — use localStorage only
    return local.get(localKey) || [];
  }

  try {
    const deviceId = getDeviceId();
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Also cache locally for offline
    const records = data.map(r => r.payload);
    local.set(localKey, records);
    return records;
  } catch (err) {
    console.warn(`Supabase load failed for ${table}, using local:`, err.message);
    return local.get(localKey) || [];
  }
}

// Save entire collection (replaces all records for this device+table)
export async function saveCollection(table, data) {
  const localKey = TABLE_KEY[table];

  // Always save locally first (instant, works offline)
  local.set(localKey, data);

  if (!supabase) return;

  try {
    const deviceId = getDeviceId();

    // Delete existing records for this device+table, then re-insert
    await supabase.from(table).delete().eq('device_id', deviceId);

    if (data.length > 0) {
      const rows = data.map(item => ({
        device_id: deviceId,
        record_id: String(item.id || Math.random()),
        payload: item,
      }));
      const { error } = await supabase.from(table).insert(rows);
      if (error) throw error;
    }
  } catch (err) {
    console.warn(`Supabase save failed for ${table}:`, err.message);
    // Data is still safe in localStorage
  }
}

// Check if Supabase is configured and reachable
export async function checkSupabaseStatus() {
  if (!supabase) return { connected: false, reason: 'not_configured' };
  try {
    const { error } = await supabase.from('workouts').select('count').limit(1);
    if (error) return { connected: false, reason: error.message };
    return { connected: true };
  } catch {
    return { connected: false, reason: 'network_error' };
  }
}

export { supabase, getDeviceId };
