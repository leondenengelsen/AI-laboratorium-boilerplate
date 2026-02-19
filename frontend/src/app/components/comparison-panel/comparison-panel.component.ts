import { Component, OnInit, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MetricsPanelComponent } from '../metrics-panel/metrics-panel.component';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import {
  ChatRequest,
  ChatResponse,
  ConversationMessage,
  ProviderInfo,
  ModelInfo,
  Preset,
  PresetRequest,
  StreamEvent,
} from '../../types/api.types';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

interface ComparisonSlot {
  id: string;
  provider: ProviderInfo | null;
  model: ModelInfo | null;
  sortedModels: ModelInfo[];
  conversationHistory: ConversationMessage[];
  streamingText: string;
  response: ChatResponse | null;
  loading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-comparison-panel',
  standalone: true,
  imports: [FormsModule, MetricsPanelComponent, MarkdownPipe],
  templateUrl: './comparison-panel.component.html',
})
export class ComparisonPanelComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly streamingEnabled = input(true);

  readonly providers = signal<ProviderInfo[]>([]);
  readonly slots = signal<ComparisonSlot[]>([]);
  readonly initError = signal<string | null>(null);

  readonly systemMessage = signal('');
  readonly tone = signal('');
  readonly context = signal('');
  readonly userMessage = signal('');

  readonly presets = signal<Preset[]>([]);
  readonly selectedPreset = signal<Preset | null>(null);
  readonly presetName = signal('');
  readonly presetSaving = signal(false);
  readonly presetError = signal<string | null>(null);

  readonly multiTurnEnabled = signal(false);

  readonly comparing = computed(() => this.slots().some(s => s.loading));
  readonly hasStarted = computed(() => this.slots().some(s => s.loading || !!s.response || !!s.error || s.conversationHistory.length > 0));

  private readonly streamSubs = new Map<string, Subscription>();
  private slotCounter = 0;
  private readonly DEFAULTS_KEY = 'ai_lab_comparison_defaults';

  readonly defaultSlots = signal<Array<{ provider: string; model: string } | null>>([null, null]);
  readonly slotDefaults = computed(() => {
    const slots = this.slots();
    const defaults = this.defaultSlots();
    return slots.map((slot, i) => {
      const d = defaults[i] ?? null;
      return !!d && slot.provider?.name === d.provider && slot.model?.id === d.model;
    });
  });

  ngOnInit(): void {
    this.loadDefaults();

    this.api.getProviders().subscribe({
      next: (data) => {
        this.providers.set(data.providers);
        const saved = this.defaultSlots();

        const resolveSlot = (index: number, fallbackProvider: ProviderInfo | null): ComparisonSlot => {
          const d = saved[index] ?? null;
          if (!d) return this.createSlot(fallbackProvider);
          const provider = data.providers.find((p) => p.name === d.provider) ?? fallbackProvider;
          const slot = this.createSlot(provider);
          if (provider && d.model) {
            const model = slot.sortedModels.find((m) => m.id === d.model);
            if (model) slot.model = model;
          }
          return slot;
        };

        this.slots.set([
          resolveSlot(0, data.providers[0] ?? null),
          resolveSlot(1, data.providers[1] ?? data.providers[0] ?? null),
        ]);
      },
      error: (err: HttpErrorResponse) => {
        this.initError.set(`Failed to load providers: ${err.message}`);
        this.slots.set([this.createSlot(null), this.createSlot(null)]);
      },
    });

    this.api.getPresets().subscribe({
      next: (data) => this.presets.set(data.presets),
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.streamSubs.forEach(sub => sub.unsubscribe());
  }

  private createSlot(provider: ProviderInfo | null): ComparisonSlot {
    const id = `slot_${++this.slotCounter}`;
    const sortedModels = provider
      ? [...provider.models].sort(
          (a, b) => a.inputPerMillion + a.outputPerMillion - (b.inputPerMillion + b.outputPerMillion)
        )
      : [];
    return {
      id,
      provider,
      model: sortedModels[0] ?? null,
      sortedModels,
      conversationHistory: [],
      streamingText: '',
      response: null,
      loading: false,
      error: null,
    };
  }

  private updateSlot(id: string, changes: Partial<ComparisonSlot>): void {
    this.slots.update(slots => slots.map(s => (s.id === id ? { ...s, ...changes } : s)));
  }

  selectSlotProvider(slotId: string, provider: ProviderInfo): void {
    const sortedModels = [...provider.models].sort(
      (a, b) => a.inputPerMillion + a.outputPerMillion - (b.inputPerMillion + b.outputPerMillion)
    );
    this.updateSlot(slotId, { provider, sortedModels, model: sortedModels[0] ?? null });
  }

  selectSlotModel(slotId: string, model: ModelInfo): void {
    this.updateSlot(slotId, { model });
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  compare(): void {
    const message = this.userMessage();
    if (!message.trim()) return;

    const contextText = this.context().trim();
    const systemParts: string[] = [];
    if (this.systemMessage().trim()) {
      systemParts.push(this.systemMessage().trim());
    }
    if (contextText) {
      systemParts.push(`Context:\n${contextText}`);
    }
    const systemMessage = systemParts.join('\n\n');
    const toneText = this.tone().trim();

    this.userMessage.set('');

    for (const slot of this.slots()) {
      if (!slot.provider || !slot.model) continue;

      this.streamSubs.get(slot.id)?.unsubscribe();

      const newHistory: ConversationMessage[] = this.multiTurnEnabled()
        ? [...slot.conversationHistory, { role: 'user' as const, content: message }]
        : [{ role: 'user' as const, content: message }];

      this.updateSlot(slot.id, {
        loading: true,
        error: null,
        response: null,
        streamingText: '',
        conversationHistory: newHistory,
      });

      const request: ChatRequest = {
        provider: slot.provider.name,
        model: slot.model.id,
        systemMessage,
        tone: toneText ? `Tone: ${toneText}` : '',
        userMessage: message,
        ...(this.multiTurnEnabled() && { messages: newHistory }),
        config: { temperature: 0.7, maxTokens: 1024 },
      };

      if (this.streamingEnabled()) {
        this.streamSlot(slot.id, slot.provider.name, slot.model.id, request);
      } else {
        this.completeSlot(slot.id, request);
      }
    }
  }

  clearComparison(): void {
    this.slots.update(slots => slots.map(s => ({
      ...s,
      conversationHistory: [],
      response: null,
      streamingText: '',
      error: null,
    })));
  }

  private streamSlot(
    slotId: string,
    providerName: string,
    modelId: string,
    request: ChatRequest
  ): void {
    let accumulated = '';
    const sub = this.api.stream(request).subscribe({
      next: (event: StreamEvent) => {
        if (event.type === 'delta') {
          accumulated += event.text;
          this.updateSlot(slotId, { streamingText: accumulated });
        } else if (event.type === 'done') {
          const currentSlot = this.slots().find(s => s.id === slotId);
          const updatedHistory = this.multiTurnEnabled()
            ? [...(currentSlot?.conversationHistory ?? []), { role: 'assistant' as const, content: accumulated }]
            : (currentSlot?.conversationHistory ?? []);
          this.updateSlot(slotId, {
            response: {
              text: accumulated,
              provider: providerName,
              model: modelId,
              usage: event.usage,
              costEstimate: event.costEstimate,
              latencyMs: event.latencyMs,
            },
            conversationHistory: updatedHistory,
            streamingText: '',
            loading: false,
          });
        } else if (event.type === 'error') {
          this.updateSlot(slotId, { error: event.message, loading: false });
        }
      },
      error: (err: Error) => {
        this.updateSlot(slotId, { error: err.message, loading: false });
      },
    });
    this.streamSubs.set(slotId, sub);
  }

  private completeSlot(slotId: string, request: ChatRequest): void {
    const sub = this.api.complete(request).subscribe({
      next: (result: ChatResponse) => {
        const currentSlot = this.slots().find(s => s.id === slotId);
        const updatedHistory = this.multiTurnEnabled()
          ? [...(currentSlot?.conversationHistory ?? []), { role: 'assistant' as const, content: result.text }]
          : (currentSlot?.conversationHistory ?? []);
        this.updateSlot(slotId, { response: result, conversationHistory: updatedHistory, loading: false });
      },
      error: (err: HttpErrorResponse) => {
        this.updateSlot(slotId, {
          error: err.error?.error?.message ?? err.message,
          loading: false,
        });
      },
    });
    this.streamSubs.set(slotId, sub);
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
    if (!existing) return;

    this.presetSaving.set(true);
    const request: PresetRequest = {
      name: existing.name,
      systemMessage: this.systemMessage(),
      tone: this.tone(),
      context: this.context(),
    };

    this.api.updatePreset(existing.id, request).subscribe({
      next: (updated) => {
        this.presets.set(this.presets().map(p => (p.id === updated.id ? updated : p)));
        this.selectedPreset.set(updated);
        this.presetSaving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.presetError.set(`Failed to save preset: ${err.message}`);
        this.presetSaving.set(false);
      },
    });
  }

  saveAsNewPreset(): void {
    const name = this.presetName().trim();
    if (!name) return;

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
        this.closeModal('cmp_save_preset_modal');
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
        this.presets.set(this.presets().filter(p => p.id !== id));
        if (this.selectedPreset()?.id === id) {
          this.selectedPreset.set(null);
          this.presetName.set('');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.presetError.set(`Failed to delete preset: ${err.message}`);
      },
    });
  }

  openSaveAsModal(): void {
    this.presetName.set('');
    this.presetError.set(null);
    const modal = document.getElementById('cmp_save_preset_modal') as HTMLDialogElement | null;
    modal?.showModal();
  }

  private loadDefaults(): void {
    try {
      const stored = localStorage.getItem(this.DEFAULTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{ provider: string; model: string } | null>;
        this.defaultSlots.set(parsed);
      }
    } catch {
      // ignore malformed data
    }
  }

  setSlotDefault(index: number, checked: boolean): void {
    const slot = this.slots()[index];
    const current = [...this.defaultSlots()];

    if (checked && slot?.provider && slot.model) {
      current[index] = { provider: slot.provider.name, model: slot.model.id };
    } else {
      current[index] = null;
    }

    this.defaultSlots.set(current);
    localStorage.setItem(this.DEFAULTS_KEY, JSON.stringify(current));
  }

  comparePresetById(a: Preset | null, b: Preset | null): boolean {
    return a?.id === b?.id;
  }

  compareByName(a: ProviderInfo, b: ProviderInfo): boolean {
    return a?.name === b?.name;
  }

  private closeModal(id: string): void {
    const modal = document.getElementById(id) as HTMLDialogElement | null;
    modal?.close();
  }
}
