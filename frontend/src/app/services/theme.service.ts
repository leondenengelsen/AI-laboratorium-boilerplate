import { Injectable, signal, computed } from '@angular/core';

type ThemeName = 'arcade' | 'carbon' | 'lab';
type ThemeMode = 'light' | 'dark';

interface ThemeConfig {
  readonly name: ThemeName;
  readonly label: string;
  readonly swatches: readonly [string, string, string];
}

const STORAGE_KEY_THEME = 'ai-lab-theme';
const STORAGE_KEY_MODE = 'ai-lab-mode';
const DEFAULT_THEME: ThemeName = 'lab';
const DEFAULT_MODE: ThemeMode = 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes: readonly ThemeConfig[] = [
    { name: 'arcade', label: 'Faded Arcade', swatches: ['#EDE8DC', '#7B6FA0', '#E07B54'] },
    { name: 'carbon', label: 'Carbon', swatches: ['#F4F4F5', '#2563EB', '#7C3AED'] },
    { name: 'lab', label: 'Pastel Lab', swatches: ['#EDE8F4', '#9B7FC4', '#78C4B0'] },
  ] as const;

  readonly currentTheme = signal<ThemeName>(DEFAULT_THEME);
  readonly currentMode = signal<ThemeMode>(DEFAULT_MODE);

  readonly dataTheme = computed(() => `${this.currentTheme()}-${this.currentMode()}`);

  constructor() {
    this.restoreFromStorage();
  }

  setTheme(name: ThemeName): void {
    this.currentTheme.set(name);
    this.applyTheme();
    localStorage.setItem(STORAGE_KEY_THEME, name);
  }

  setMode(mode: ThemeMode): void {
    this.currentMode.set(mode);
    this.applyTheme();
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }

  toggleMode(): void {
    this.setMode(this.currentMode() === 'light' ? 'dark' : 'light');
  }

  private restoreFromStorage(): void {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeName | null;
    const savedMode = localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;

    if (savedTheme && this.isValidTheme(savedTheme)) {
      this.currentTheme.set(savedTheme);
    }
    if (savedMode && this.isValidMode(savedMode)) {
      this.currentMode.set(savedMode);
    }

    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.dataTheme());
  }

  private isValidTheme(value: string): value is ThemeName {
    return ['arcade', 'carbon', 'lab'].includes(value);
  }

  private isValidMode(value: string): value is ThemeMode {
    return value === 'light' || value === 'dark';
  }
}
