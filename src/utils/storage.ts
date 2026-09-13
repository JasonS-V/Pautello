import { Score } from '../types/music';
import { TEMPLATES } from '../constants/templates';

const STORAGE_KEY = 'sonata_active_score';
const THEME_KEY = 'sonata_theme';
const NAMING_KEY = 'sonata_naming_convention';

export function saveScoreToStorage(score: Score): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(score));
  } catch (e) {
    console.warn('Failed to save score to local storage:', e);
  }
}

export function loadScoreFromStorage(): Score {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as Score;
    }
  } catch (e) {
    console.warn('Failed to load score from storage:', e);
  }
  // Default to Ode to Joy
  return TEMPLATES[0].score;
}

export function saveThemePreference(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.warn(e);
  }
}

export function loadThemePreference(): 'dark' | 'light' {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    // fallback
  }
  return 'dark';
}

export function saveNamingPreference(naming: 'latin' | 'english'): void {
  try {
    localStorage.setItem(NAMING_KEY, naming);
  } catch (e) {
    console.warn(e);
  }
}

export function loadNamingPreference(): 'latin' | 'english' {
  try {
    const n = localStorage.getItem(NAMING_KEY);
    if (n === 'latin' || n === 'english') return n;
  } catch {
    // fallback
  }
  return 'latin'; // Do-Re-Mi by default for Spanish / Latin music students
}
