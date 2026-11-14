"use client";

import {
  PREVIEW_PROTOCOL_VERSION,
  PREVIEW_HANDSHAKE_TIMEOUT_MS,
  PREVIEW_HEARTBEAT_INTERVAL_MS,
  PREVIEW_CIRCUIT_BREAKER_MAX_FAILURES,
  type PreviewIncomingMessage,
  type PreviewOutgoingMessage,
  type JsonPatchOperation,
} from "./protocol";

export interface PreviewBridgeState {
  status: "idle" | "handshaking" | "connected" | "disconnected" | "crashed";
  lastError: string | null;
  latencyMs: number;
}

export class PreviewBridge {
  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private allowedOrigin: string = "*";
  private handshakeTimer: any = null;
  private heartbeatInterval: any = null;
  private failureCount: number = 0;
  private pingStartTime: number = 0;
  private stateChangeListeners: Array<(state: PreviewBridgeState) => void> = [];
  private domClickListeners: Array<(targetPath?: string) => void> = [];

  private currentState: PreviewBridgeState = {
    status: "idle",
    lastError: null,
    latencyMs: 0,
  };

  constructor(allowedOrigin?: string) {
    if (allowedOrigin) {
      this.allowedOrigin = allowedOrigin;
    } else if (typeof window !== "undefined") {
      this.allowedOrigin = window.location.origin;
    }
  }

  public subscribeState(listener: (state: PreviewBridgeState) => void): () => void {
    this.stateChangeListeners.push(listener);
    listener(this.currentState);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  public onDomClick(listener: (targetPath?: string) => void): () => void {
    this.domClickListeners.push(listener);
    return () => {
      this.domClickListeners = this.domClickListeners.filter((l) => l !== listener);
    };
  }

  private updateState(partial: Partial<PreviewBridgeState>): void {
    this.currentState = { ...this.currentState, ...partial };
    for (const listener of this.stateChangeListeners) {
      listener(this.currentState);
    }
  }

  public attach(iframe: HTMLIFrameElement, tenantSlug: string): void {
    this.detach();
    this.iframe = iframe;
    this.updateState({ status: "handshaking", lastError: null });

    const handleWindowMessage = (event: MessageEvent) => {
      // Validate origin if not wildcard
      if (this.allowedOrigin !== "*" && event.origin !== this.allowedOrigin) {
        return;
      }

      const data = event.data as PreviewIncomingMessage;
      if (data?.type === "SANDBOX_READY") {
        this.completeHandshake(tenantSlug);
        window.removeEventListener("message", handleWindowMessage);
      }
    };

    window.addEventListener("message", handleWindowMessage);

    // Handshake timeout
    this.handshakeTimer = setTimeout(() => {
      if (this.currentState.status === "handshaking") {
        this.updateState({
          status: "disconnected",
          lastError: "انتهت مهلة مصافحة الأمان مع إطار المعاينة. سيتم التحديث تلقائياً.",
        });
      }
    }, PREVIEW_HANDSHAKE_TIMEOUT_MS);
  }

  private completeHandshake(tenantSlug: string): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }

    if (!this.iframe?.contentWindow) return;

    const channel = new MessageChannel();
    this.port = channel.port1;

    // Listen on Port1
    this.port.onmessage = (event: MessageEvent) => {
      this.handlePortMessage(event.data as PreviewIncomingMessage);
    };

    // Send Port2 to iframe
    const handshakeMsg: PreviewOutgoingMessage = {
      type: "ESTABLISH_CHANNEL",
      version: PREVIEW_PROTOCOL_VERSION,
      tenantSlug,
      previewMode: true,
    };

    this.iframe.contentWindow.postMessage(handshakeMsg, "*", [channel.port2]);

    this.failureCount = 0;
    this.updateState({ status: "connected", lastError: null });
    this.startHeartbeat();
  }

  private handlePortMessage(data: PreviewIncomingMessage): void {
    if (!data || typeof data !== "object") return;

    switch (data.type) {
      case "PONG": {
        const latency = Date.now() - this.pingStartTime;
        this.failureCount = 0;
        this.updateState({ latencyMs: Math.max(1, latency) });
        break;
      }
      case "CLIENT_DOM_CLICK": {
        for (const listener of this.domClickListeners) {
          listener(data.targetPath);
        }
        break;
      }
      case "SANDBOX_ERROR": {
        this.failureCount++;
        this.updateState({ lastError: data.error });
        if (data.fatal || this.failureCount >= PREVIEW_CIRCUIT_BREAKER_MAX_FAILURES) {
          this.triggerCircuitBreaker(data.error);
        }
        break;
      }
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.currentState.status !== "connected" || !this.port) return;

      this.pingStartTime = Date.now();
      try {
        this.port.postMessage({ type: "PING", timestamp: this.pingStartTime });
      } catch (e) {
        this.failureCount++;
        if (this.failureCount >= PREVIEW_CIRCUIT_BREAKER_MAX_FAILURES) {
          this.triggerCircuitBreaker("انقطع الاتصال بالقناة المباشرة.");
        }
      }
    }, PREVIEW_HEARTBEAT_INTERVAL_MS);
  }

  private triggerCircuitBreaker(reason: string): void {
    this.updateState({
      status: "crashed",
      lastError: `قاطع الأمان: ${reason}. تم إيقاف المزامنة لحماية المتصفح.`,
    });
    this.detach();
  }

  public applyStyleTokens(tokens: Record<string, string>): void {
    if (this.currentState.status !== "connected" || !this.port) return;
    this.port.postMessage({
      type: "APPLY_STYLE_TOKEN",
      tokens,
    } as PreviewOutgoingMessage);
  }

  public applyDomPatch(patches: JsonPatchOperation[]): void {
    if (this.currentState.status !== "connected" || !this.port) return;
    this.port.postMessage({
      type: "APPLY_DOM_PATCH",
      patches,
    } as PreviewOutgoingMessage);
  }

  public replaceFullState(state: Record<string, any>): void {
    if (this.currentState.status !== "connected" || !this.port) return;
    this.port.postMessage({
      type: "REPLACE_FULL_STATE",
      state,
    } as PreviewOutgoingMessage);
  }

  public resetState(reason?: string): void {
    if (this.currentState.status !== "connected" || !this.port) return;
    this.port.postMessage({
      type: "RESET_STATE",
      reason,
    } as PreviewOutgoingMessage);
  }

  public detach(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.port) {
      try {
        this.port.close();
      } catch {}
      this.port = null;
    }
    this.iframe = null;
  }
}
