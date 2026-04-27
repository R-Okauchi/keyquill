import { WebPlugin } from "@capacitor/core";
import type { SecureRelayPlugin } from "./definitions.js";
import type { RelayPolicy, RelayProviderInfo } from "./types.js";
import { getErrorMessage } from "./errors/index.js";

/**
 * Web fallback for SecureRelay.
 * All methods throw — secure relay is only available on native platforms.
 * This aligns with ADR-003 Option A (web = deterministic-only).
 *
 * The error message uses the localized `NOT_NATIVE` code so callers
 * see the message in the device's UI language (en / ja today).
 */
export class SecureRelayWeb extends WebPlugin implements SecureRelayPlugin {
  private unsupported(): never {
    const message =
      getErrorMessage("NOT_NATIVE") ??
      "Keyquill is only available on native iOS and Android builds.";
    const err = new Error(message);
    (err as Error & { code?: string }).code = "NOT_NATIVE";
    throw err;
  }

  async registerKey(): Promise<void> {
    this.unsupported();
  }

  async deleteKey(): Promise<void> {
    this.unsupported();
  }

  async listProviders(): Promise<{ providers: RelayProviderInfo[] }> {
    this.unsupported();
  }

  async testKey(): Promise<{ reachable: boolean }> {
    this.unsupported();
  }

  async chatStream(): Promise<{ streamId: string }> {
    this.unsupported();
  }

  async cancelStream(): Promise<void> {
    this.unsupported();
  }

  async updatePolicy(): Promise<void> {
    this.unsupported();
  }

  async getPolicy(): Promise<{ policy: RelayPolicy }> {
    this.unsupported();
  }

  async checkBiometricAvailability(): Promise<{
    available: boolean;
    biometryType: string;
  }> {
    return { available: false, biometryType: "none" };
  }

  async setScreenSecure(): Promise<void> {
    // No-op on the web. Browsers do not offer a per-page screenshot block
    // and the native API is only meaningful inside the Capacitor shell.
  }

  async acceptPairing(): Promise<{
    sessionId: string;
    localPublicKey: string;
    shortCode: string;
  }> {
    this.unsupported();
  }

  async disconnectRelay(): Promise<void> {
    this.unsupported();
  }

  async getRelayStatus(): Promise<{
    connected: boolean;
    sessionId?: string;
    peerDescription?: string;
    connectedSince?: string;
    idleTimeoutSec: number;
  }> {
    return { connected: false, idleTimeoutSec: 0 };
  }
}
