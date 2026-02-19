import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { ComparisonPanelComponent } from './components/comparison-panel/comparison-panel.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { ThemeSwitcherComponent } from './components/theme-switcher/theme-switcher.component';
import { ApiService } from './services/api.service';

interface PricingRow {
  provider: string;
  model: string;
  apiId: string;
  input: number;
  output: number;
  description: string;
}

type SortField = 'provider' | 'model' | 'input' | 'output';

type AppMode = 'chat' | 'compare';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatPanelComponent, ComparisonPanelComponent, SettingsPanelComponent, ThemeSwitcherComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  title = 'AI Lab';

  private readonly api = inject(ApiService);

  readonly mode = signal<AppMode>('chat');
  readonly streamingEnabled = signal(true);
  readonly pricingSortField = signal<SortField>('provider');
  readonly pricingSortAsc = signal<boolean>(true);
  private readonly pricingRows = signal<PricingRow[]>([]);

  readonly sortedPricing = computed(() => {
    const field = this.pricingSortField();
    const asc = this.pricingSortAsc();
    const rows = [...this.pricingRows()];

    rows.sort((a, b) => {
      let cmp: number;
      if (field === 'input' || field === 'output') {
        cmp = a[field] - b[field];
      } else {
        cmp = a[field].localeCompare(b[field]);
      }
      return asc ? cmp : -cmp;
    });

    return rows;
  });

  ngOnInit(): void {
    this.api.getProviders().subscribe({
      next: (data) => {
        const rows: PricingRow[] = [];
        for (const provider of data.providers) {
          for (const model of provider.models) {
            rows.push({
              provider: provider.displayName,
              model: model.displayName,
              apiId: model.id,
              input: model.inputPerMillion,
              output: model.outputPerMillion,
              description: model.description,
            });
          }
        }
        this.pricingRows.set(rows);
      },
    });
  }

  sortPricing(field: SortField): void {
    if (this.pricingSortField() === field) {
      this.pricingSortAsc.update((v) => !v);
    } else {
      this.pricingSortField.set(field);
      this.pricingSortAsc.set(true);
    }
  }

}
