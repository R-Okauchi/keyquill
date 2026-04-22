package io.keyquill.mobile

/**
 * Runtime configuration for the keyquill-mobile plugin.
 *
 * Populated by [SecureRelayPlugin.load] from the Capacitor plugin config
 * (see apps/mobile/capacitor.config.ts). Defaults are tuned for the
 * standalone `keyquill-mobile` package; downstream apps may override them
 * to preserve existing Keystore entries or brand the biometric prompt.
 */
object KeyquillMobileConfig {

    /**
     * Android Keystore alias for the AES master key used to encrypt API keys.
     * Changing this between releases makes already-stored keys unrecoverable,
     * so downstream apps should pin this value across upgrades.
     */
    var keystoreAlias: String = "keyquill-mobile.master"

    /**
     * Title shown in the BiometricPrompt UI. Should be the downstream app's
     * user-facing name so the prompt is recognisable.
     */
    var biometricPromptTitle: String = "Keyquill Mobile"

    /**
     * HKDF info string used when deriving the AES-GCM session key during
     * Phone Wallet Relay pairing. Must match the PC-side value byte-for-byte.
     * Only applies to the Relay flow.
     */
    var pairingProtocolLabel: String = "keyquill-mobile-relay-v1"
}
