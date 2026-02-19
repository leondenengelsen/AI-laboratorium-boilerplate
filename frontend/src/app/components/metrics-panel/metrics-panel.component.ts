import { Component, Input } from '@angular/core';
import { ChatResponse } from '../../types/api.types';

@Component({
  selector: 'app-metrics-panel',
  standalone: true,
  templateUrl: './metrics-panel.component.html',
})
export class MetricsPanelComponent {
  @Input() response: ChatResponse | null = null;
  @Input() compact = false;
}
