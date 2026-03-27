import { Page } from '@playwright/test';

export interface WsEvent {
  event: string;
  query_id?: string;
  [key: string]: unknown;
}

export class WebSocketCapture {
  private events: WsEvent[] = [];
  private resolvers: Array<{ eventType: string; resolve: (e: WsEvent) => void }> = [];

  get all(): WsEvent[] {
    return [...this.events];
  }

  push(event: WsEvent): void {
    this.events.push(event);
    // Resolve any pending waitForEvent calls
    for (let i = this.resolvers.length - 1; i >= 0; i--) {
      if (this.resolvers[i].eventType === event.event) {
        this.resolvers[i].resolve(event);
        this.resolvers.splice(i, 1);
      }
    }
  }

  has(eventType: string): boolean {
    return this.events.some(e => e.event === eventType);
  }

  get(eventType: string): WsEvent | undefined {
    return this.events.find(e => e.event === eventType);
  }

  getAll(eventType: string): WsEvent[] {
    return this.events.filter(e => e.event === eventType);
  }

  waitForEvent(eventType: string, timeoutMs = 60_000): Promise<WsEvent> {
    // Check if already received
    const existing = this.get(eventType);
    if (existing) return Promise.resolve(existing);

    return new Promise<WsEvent>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for WS event "${eventType}" after ${timeoutMs}ms`)),
        timeoutMs,
      );
      this.resolvers.push({
        eventType,
        resolve: (e) => {
          clearTimeout(timer);
          resolve(e);
        },
      });
    });
  }
}

export function captureWebSocketEvents(page: Page, filterQueryId?: string): WebSocketCapture {
  const capture = new WebSocketCapture();

  page.on('websocket', (ws) => {
    ws.on('framereceived', (frame) => {
      try {
        const data = JSON.parse(frame.payload as string) as WsEvent;
        if (filterQueryId && data.query_id !== filterQueryId) return;
        capture.push(data);
      } catch {
        // Ignore non-JSON frames
      }
    });
  });

  return capture;
}
