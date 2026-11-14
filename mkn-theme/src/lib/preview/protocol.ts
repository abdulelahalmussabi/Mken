/**
 * Safe Magic Preview Protocol (Enterprise Standard)
 * Bi-directional Point-to-Point MessageChannel contract between Parent Editor and Sandboxed Iframe.
 * Zero-latency DOM reconciliation and CSS Custom Properties injection.
 */

export const PREVIEW_PROTOCOL_VERSION = "2.0.0";
export const PREVIEW_HANDSHAKE_TIMEOUT_MS = 6000;
export const PREVIEW_HEARTBEAT_INTERVAL_MS = 5000;
export const PREVIEW_CIRCUIT_BREAKER_MAX_FAILURES = 3;

export type ViewportDevice = "mobile-iphone" | "mobile-android" | "tablet-ipad" | "desktop";

export interface DeviceConfig {
  id: ViewportDevice;
  label: string;
  width: number;
  height: number;
  isMobile: boolean;
  scale?: number;
}

export const DEVICE_PRESETS: Record<ViewportDevice, DeviceConfig> = {
  "mobile-iphone": {
    id: "mobile-iphone",
    label: "آيفون 15 برو (iPhone)",
    width: 393,
    height: 852,
    isMobile: true,
  },
  "mobile-android": {
    id: "mobile-android",
    label: "سامسونج جالاكسي (Galaxy S24)",
    width: 412,
    height: 915,
    isMobile: true,
  },
  "tablet-ipad": {
    id: "tablet-ipad",
    label: "آيباد إير (iPad Air)",
    width: 820,
    height: 1180,
    isMobile: false,
  },
  desktop: {
    id: "desktop",
    label: "شاشة كمبيوتر (Full HD)",
    width: 1440,
    height: 900,
    isMobile: false,
  },
};

export type JsonPatchOperation =
  | { op: "replace"; path: string; value: any }
  | { op: "add"; path: string; value: any }
  | { op: "remove"; path: string };

export type PreviewIncomingMessage =
  | { type: "SANDBOX_READY"; version: string; timestamp: number }
  | { type: "PONG"; timestamp: number }
  | { type: "SANDBOX_ERROR"; error: string; fatal?: boolean }
  | { type: "CLIENT_DOM_CLICK"; targetPath?: string };

export type PreviewOutgoingMessage =
  | { type: "ESTABLISH_CHANNEL"; version: string; tenantSlug: string; previewMode: boolean }
  | { type: "APPLY_STYLE_TOKEN"; tokens: Record<string, string> }
  | { type: "APPLY_DOM_PATCH"; patches: JsonPatchOperation[] }
  | { type: "REPLACE_FULL_STATE"; state: Record<string, any> }
  | { type: "SET_DEVICE_VIEWPORT"; device: ViewportDevice }
  | { type: "PING"; timestamp: number }
  | { type: "RESET_STATE"; reason?: string };

export type PreviewMessage = PreviewIncomingMessage | PreviewOutgoingMessage;
