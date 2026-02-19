import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import { KeyReference, ProviderInfo } from '../../types/api.types';

interface KeyInputState {
  key: string;
  label: string;
  saving: boolean;
  error: string | null;
}

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-panel.component.html',
})
export class SettingsPanelComponent implements OnInit {
  providers = signal<ProviderInfo[]>([]);
  keys = signal<KeyReference[]>([]);
  loading = signal(false);
  globalError = signal<string | null>(null);

  keyInputs = signal<Record<string, KeyInputState>>({});

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getProviders().subscribe({
      next: (data) => {
        this.providers.set(data.providers);
        const inputs: Record<string, KeyInputState> = {};
        for (const p of data.providers) {
          inputs[p.name] = { key: '', label: '', saving: false, error: null };
        }
        this.keyInputs.set(inputs);
        this.loadKeys();
      },
      error: (err: HttpErrorResponse) => {
        this.globalError.set(`Failed to load providers: ${err.message}`);
        this.loading.set(false);
      },
    });
  }

  private loadKeys(): void {
    this.api.getKeys().subscribe({
      next: (data) => {
        this.keys.set(data.keys);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.globalError.set(`Failed to load keys: ${err.message}`);
        this.loading.set(false);
      },
    });
  }

  getKeyForProvider(providerName: string): KeyReference | undefined {
    return this.keys().find((k) => k.provider === providerName);
  }

  getInputState(providerName: string): KeyInputState {
    return this.keyInputs()[providerName] ?? { key: '', label: '', saving: false, error: null };
  }

  updateKeyInput(providerName: string, field: 'key' | 'label', value: string): void {
    const current = this.keyInputs();
    this.keyInputs.set({
      ...current,
      [providerName]: { ...current[providerName], [field]: value },
    });
  }

  saveKey(providerName: string): void {
    const state = this.getInputState(providerName);
    if (!state.key.trim()) {
      return;
    }

    const current = this.keyInputs();
    this.keyInputs.set({
      ...current,
      [providerName]: { ...state, saving: true, error: null },
    });

    this.api
      .saveKey({
        provider: providerName,
        label: state.label.trim() || providerName,
        key: state.key,
      })
      .subscribe({
        next: (keyRef) => {
          // Clear the raw key immediately after successful save
          const updated = this.keyInputs();
          this.keyInputs.set({
            ...updated,
            [providerName]: { key: '', label: '', saving: false, error: null },
          });
          this.keys.set([...this.keys().filter((k) => k.provider !== providerName), keyRef]);
        },
        error: (err: HttpErrorResponse) => {
          const updated = this.keyInputs();
          this.keyInputs.set({
            ...updated,
            [providerName]: { ...state, saving: false, error: err.message },
          });
        },
      });
  }

  deleteKey(keyId: string): void {
    this.api.deleteKey(keyId).subscribe({
      next: () => {
        this.keys.set(this.keys().filter((k) => k.id !== keyId));
      },
      error: (err: HttpErrorResponse) => {
        this.globalError.set(`Failed to delete key: ${err.message}`);
      },
    });
  }
}
