import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  templateUrl: './theme-switcher.component.html',
})
export class ThemeSwitcherComponent {
  protected readonly themeService = inject(ThemeService);

  protected readonly currentThemeConfig = computed(() =>
    this.themeService.themes.find((t) => t.name === this.themeService.currentTheme()),
  );
}
