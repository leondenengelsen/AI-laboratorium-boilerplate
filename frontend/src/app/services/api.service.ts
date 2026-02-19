import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ChatRequest,
  ChatResponse,
  ProvidersResponse,
  KeyReference,
  KeySaveRequest,
  KeysResponse,
  Preset,
  PresetRequest,
  PresetsResponse,
  StreamEvent,
} from '../types/api.types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getProviders(): Observable<ProvidersResponse> {
    return this.http.get<ProvidersResponse>(`${this.baseUrl}/providers`);
  }

  complete(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat/complete`, request);
  }

  stream(request: ChatRequest): Observable<StreamEvent> {
    return new Observable<StreamEvent>((subscriber) => {
      const controller = new AbortController();

      fetch(`${this.baseUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const message = body?.error?.message ?? `HTTP ${response.status}`;
            subscriber.error(new Error(message));
            return;
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop()!;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const json = trimmed.slice(6);
              const event: StreamEvent = JSON.parse(json);
              subscriber.next(event);
            }
          }

          subscriber.complete();
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            subscriber.complete();
          } else {
            subscriber.error(err);
          }
        });

      return () => {
        controller.abort();
      };
    });
  }

  saveKey(request: KeySaveRequest): Observable<KeyReference> {
    return this.http.post<KeyReference>(`${this.baseUrl}/keys`, request);
  }

  getKeys(): Observable<KeysResponse> {
    return this.http.get<KeysResponse>(`${this.baseUrl}/keys`);
  }

  deleteKey(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/keys/${id}`);
  }

  getPresets(): Observable<PresetsResponse> {
    return this.http.get<PresetsResponse>(`${this.baseUrl}/presets`);
  }

  savePreset(request: PresetRequest): Observable<Preset> {
    return this.http.post<Preset>(`${this.baseUrl}/presets`, request);
  }

  updatePreset(id: string, request: PresetRequest): Observable<Preset> {
    return this.http.put<Preset>(`${this.baseUrl}/presets/${id}`, request);
  }

  deletePreset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/presets/${id}`);
  }
}
