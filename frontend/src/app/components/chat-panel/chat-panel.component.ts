import { Component, OnInit, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MetricsPanelComponent } from '../metrics-panel/metrics-panel.component';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import {
  ChatResponse,
  ConversationMessage,
  CostEstimate,
  TokenUsage,
  ProviderInfo,
  ModelInfo,
  Preset,
  PresetRequest,
  StreamEvent,
  ChatRequest,
} from '../../types/api.types';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { PriceTier, priceTier } from '../../utils/price-tier';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [FormsModule, MetricsPanelComponent, MarkdownPipe],
  templateUrl: './chat-panel.component.html',
})
export class ChatPanelComponent implements OnInit {
  providers = signal<ProviderInfo[]>([]);
  selectedProvider = signal<ProviderInfo | null>(null);
  selectedModel = signal<ModelInfo | null>(null);
  sortedModels = signal<ModelInfo[]>([]);
  systemMessage = signal('');
  tone = signal('');
  context = signal('');
  userMessage = signal('');
  response = signal<ChatResponse | null>(null);
  streamingText = signal('');
  streamingProvider = signal('');
  streamingModel = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  streamingEnabled = input(true);
  multiTurnEnabled = signal(false);
  conversationHistory = signal<ConversationMessage[]>([]);

  conversationTotals = signal<{ usage: TokenUsage; costEstimate: CostEstimate } | null>(null);

  metricsResponse = computed<ChatResponse | null>(() => {
    const r = this.response();
    if (!r) return null;
    if (!this.multiTurnEnabled()) return r;
    const totals = this.conversationTotals();
    if (!totals) return r;
    return { ...r, usage: totals.usage, costEstimate: totals.costEstimate };
  });

  private streamSub: Subscription | null = null;
  private readonly DEFAULTS_KEY = 'ai_lab_defaults';

  defaultProvider = signal<string | null>(null);
  defaultModel = signal<string | null>(null);
  isDefault = computed(
    () =>
      !!this.selectedProvider() &&
      this.selectedProvider()?.name === this.defaultProvider() &&
      this.selectedModel()?.id === this.defaultModel()
  );

  presets = signal<Preset[]>([]);
  selectedPreset = signal<Preset | null>(null);
  presetName = signal('');
  presetSaving = signal(false);
  presetError = signal<string | null>(null);

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadDefaults();

    this.api.getProviders().subscribe({
      next: (data) => {
        this.providers.set(data.providers);
        if (data.providers.length > 0) {
          const savedProvider = this.defaultProvider();
          const providerToSelect = savedProvider
            ? (data.providers.find((p) => p.name === savedProvider) ?? data.providers[0])
            : data.providers[0];
          this.selectProvider(providerToSelect);

          const savedModel = this.defaultModel();
          if (savedModel) {
            const model = this.sortedModels().find((m) => m.id === savedModel);
            if (model) this.selectedModel.set(model);
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(`Failed to load providers: ${err.message}`);
      },
    });

    this.api.getPresets().subscribe({
      next: (data) => {
        this.presets.set(data.presets);
      },
      error: () => {
        // Non-fatal: presets are optional
      },
    });
  }

  private loadDefaults(): void {
    try {
      const stored = localStorage.getItem(this.DEFAULTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { provider: string; model: string };
        this.defaultProvider.set(parsed.provider);
        this.defaultModel.set(parsed.model);
      }
    } catch {
      // ignore malformed data
    }
  }

  setAsDefault(checked: boolean): void {
    const provider = this.selectedProvider();
    const model = this.selectedModel();
    if (checked && provider && model) {
      localStorage.setItem(this.DEFAULTS_KEY, JSON.stringify({ provider: provider.name, model: model.id }));
      this.defaultProvider.set(provider.name);
      this.defaultModel.set(model.id);
    } else {
      localStorage.removeItem(this.DEFAULTS_KEY);
      this.defaultProvider.set(null);
      this.defaultModel.set(null);
    }
  }

  compareByName(a: ProviderInfo, b: ProviderInfo): boolean {
    return a?.name === b?.name;
  }

  compareById(a: ModelInfo, b: ModelInfo): boolean {
    return a?.id === b?.id;
  }

  comparePresetById(a: Preset | null, b: Preset | null): boolean {
    return a?.id === b?.id;
  }

  selectProvider(provider: ProviderInfo): void {
    this.selectedProvider.set(provider);
    const sorted = [...provider.models].sort(
      (a, b) => a.inputPerMillion + a.outputPerMillion - (b.inputPerMillion + b.outputPerMillion)
    );
    this.sortedModels.set(sorted);
    this.selectedModel.set(sorted.length > 0 ? sorted[0] : null);
  }

  selectModel(model: ModelInfo): void {
    this.selectedModel.set(model);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  getModelTier(model: ModelInfo): PriceTier {
    return priceTier(model.outputPerMillion);
  }


  loadPreset(preset: Preset | null): void {
    if (!preset) {
      this.selectedPreset.set(null);
      return;
    }
    this.selectedPreset.set(preset);
    this.systemMessage.set(preset.systemMessage);
    this.tone.set(preset.tone);
    this.context.set(preset.context);
    this.presetName.set(preset.name);
  }

  saveCurrentPreset(): void {
    const existing = this.selectedPreset();
    if (!existing) {
      return;
    }

    this.presetSaving.set(true);

    const request: PresetRequest = {
      name: existing.name,
      systemMessage: this.systemMessage(),
      tone: this.tone(),
      context: this.context(),
    };

    this.api.updatePreset(existing.id, request).subscribe({
      next: (updated) => {
        this.presets.set(this.presets().map((p) => (p.id === updated.id ? updated : p)));
        this.selectedPreset.set(updated);
        this.presetSaving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(`Failed to save preset: ${err.message}`);
        this.presetSaving.set(false);
      },
    });
  }

  saveAsNewPreset(): void {
    const name = this.presetName().trim();
    if (!name) {
      return;
    }

    this.presetSaving.set(true);
    this.presetError.set(null);

    const request: PresetRequest = {
      name,
      systemMessage: this.systemMessage(),
      tone: this.tone(),
      context: this.context(),
    };

    this.api.savePreset(request).subscribe({
      next: (created) => {
        this.presets.set([...this.presets(), created]);
        this.selectedPreset.set(created);
        this.presetSaving.set(false);
        this.closeModal('save_preset_modal');
      },
      error: (err: HttpErrorResponse) => {
        this.presetError.set(err.message);
        this.presetSaving.set(false);
      },
    });
  }

  deletePreset(id: string): void {
    this.api.deletePreset(id).subscribe({
      next: () => {
        this.presets.set(this.presets().filter((p) => p.id !== id));
        if (this.selectedPreset()?.id === id) {
          this.selectedPreset.set(null);
          this.presetName.set('');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(`Failed to delete preset: ${err.message}`);
      },
    });
  }

  openSaveAsModal(): void {
    this.presetName.set('');
    this.presetError.set(null);
    const modal = document.getElementById('save_preset_modal') as HTMLDialogElement | null;
    modal?.showModal();
  }

  private closeModal(id: string): void {
    const modal = document.getElementById(id) as HTMLDialogElement | null;
    modal?.close();
  }

  clearConversation(): void {
    this.conversationHistory.set([]);
    this.response.set(null);
    this.streamingText.set('');
    this.error.set(null);
    this.conversationTotals.set(null);
  }

  send(): void {
    const provider = this.selectedProvider();
    const model = this.selectedModel();
    const message = this.userMessage();

    if (!provider || !model || !message.trim()) {
      return;
    }

    this.streamSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.response.set(null);
    this.streamingText.set('');
    this.streamingProvider.set(provider.displayName);
    this.streamingModel.set(model.displayName);
    this.userMessage.set('');

    if (!this.multiTurnEnabled()) {
      this.conversationHistory.set([{ role: 'user' as const, content: message }]);
    } else {
      this.conversationHistory.update((h) => [...h, { role: 'user' as const, content: message }]);
    }

    const contextText = this.context().trim();
    const systemParts: string[] = [];
    if (this.systemMessage().trim()) {
      systemParts.push(this.systemMessage().trim());
    }
    if (contextText) {
      systemParts.push(`Context:\n${contextText}`);
    }

    const toneText = this.tone().trim();

    const request: ChatRequest = {
      provider: provider.name,
      model: model.id,
      systemMessage: systemParts.join('\n\n'),
      tone: toneText ? `Tone: ${toneText}` : '',
      userMessage: message,
      ...(this.multiTurnEnabled() && { messages: this.conversationHistory() }),
      config: {
        temperature: 0.7,
        maxTokens: 1024,
      },
    };

    if (this.streamingEnabled()) {
      this.sendStream(request, provider, model);
    } else {
      this.sendComplete(request);
    }
  }

  private accumulateTotals(usage: TokenUsage, costEstimate: CostEstimate): void {
    const prev = this.conversationTotals();
    if (!prev) {
      this.conversationTotals.set({ usage: { ...usage }, costEstimate: { ...costEstimate } });
    } else {
      this.conversationTotals.set({
        usage: {
          inputTokens: prev.usage.inputTokens + usage.inputTokens,
          outputTokens: prev.usage.outputTokens + usage.outputTokens,
          totalTokens: prev.usage.totalTokens + usage.totalTokens,
        },
        costEstimate: {
          inputCost: prev.costEstimate.inputCost + costEstimate.inputCost,
          outputCost: prev.costEstimate.outputCost + costEstimate.outputCost,
          totalCost: prev.costEstimate.totalCost + costEstimate.totalCost,
          currency: costEstimate.currency,
        },
      });
    }
  }

  private sendStream(request: ChatRequest, provider: ProviderInfo, model: ModelInfo): void {
    let accumulated = '';

    this.streamSub = this.api.stream(request).subscribe({
      next: (event: StreamEvent) => {
        if (event.type === 'delta') {
          accumulated += event.text;
          this.streamingText.set(accumulated);
        } else if (event.type === 'done') {
          this.conversationHistory.update((h) => [...h, { role: 'assistant' as const, content: accumulated }]);
          if (this.multiTurnEnabled()) {
            this.accumulateTotals(event.usage, event.costEstimate);
          }
          this.response.set({
            text: accumulated,
            provider: provider.name,
            model: model.id,
            usage: event.usage,
            costEstimate: event.costEstimate,
            latencyMs: event.latencyMs,
          });
          this.streamingText.set('');
          this.loading.set(false);
        } else if (event.type === 'error') {
          this.error.set(event.message);
          this.loading.set(false);
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  private sendComplete(request: ChatRequest): void {
    this.api.complete(request).subscribe({
      next: (result: ChatResponse) => {
        this.conversationHistory.update((h) => [...h, { role: 'assistant' as const, content: result.text }]);
        if (this.multiTurnEnabled()) {
          this.accumulateTotals(result.usage, result.costEstimate);
        }
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error?.message ?? err.message);
        this.loading.set(false);
      },
    });
  }
}
