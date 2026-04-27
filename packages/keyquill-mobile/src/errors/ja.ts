import type { ErrorCode } from "./codes.js";

/**
 * Japanese messages for every stable mobile error code.
 */
export const ERRORS_JA: Record<ErrorCode, string> = {
  // ── インフラ / 通信 ──
  KEY_NOT_FOUND:
    "このプロバイダのキーが登録されていません。chatStream() を呼ぶ前に registerKey() を実行してください。",
  USER_DENIED:
    "リクエストが拒否されました。再度チャットまたは生体認証プロンプトを発行してください。",
  INVALID_KEY:
    "キーを保存できませんでした。API キーの値と base URL を確認してください。",
  INVALID_REQUEST:
    "プラグインが JS 層から認識できない形式のリクエストを受け取りました。",
  PROVIDER_UNREACHABLE:
    "プロバイダに接続できませんでした。ネットワーク接続と base URL の設定を確認してください。",
  PROVIDER_ERROR:
    "プロバイダがエラーを返しました。詳細を確認してください。",
  EMPTY_BODY: "プロバイダからのレスポンスが空でした。",
  INTERNAL: "Keyquill プラグイン内部で予期しないエラーが発生しました。",
  STREAM_NOT_FOUND:
    "指定された stream id は有効ではありません。すでに終了済みか、キャンセルされた可能性があります。",

  // ── モバイル固有 ──
  NOT_NATIVE:
    "Keyquill は iOS / Android のネイティブビルドでのみ利用できます。Capacitor 経由で実機・シミュレータ・エミュレータで実行してください。",
  BIOMETRIC_DENIED:
    "生体認証が拒否されました。もう一度試すか、ポリシーの auto-approve 時間を延ばしてください。",
  BIOMETRIC_UNAVAILABLE:
    "この端末では生体認証が設定されていません。Face ID / Touch ID / 指紋を登録してから再度お試しください。",
  KEYCHAIN_ERROR:
    "セキュアストレージへのアクセスに失敗しました（iOS Keychain または Android Keystore）。キーは保存・読み取りされていません。",

  // ── ポリシー違反 ──
  POLICY_HTTPS_REQUIRED:
    "設定されている base URL が HTTPS ではありません。キーを修正するか、localhost テスト用にポリシーを緩めてください。",
  POLICY_PROVIDER_BLOCKED:
    "このプロバイダはポリシーの許可リストに含まれていません。許可リストに追加するか、別のキーを選択してください。",
  POLICY_BUDGET_REQUEST_OVER_LIMIT:
    "このリクエストの推定コストが 1 回あたりの上限を超えます。maxOutput を下げるか、予算を緩めてください。",
  POLICY_BUDGET_DAILY_EXCEEDED:
    "本日の利用額が日次予算の上限に達しました。日付が変わるのを待つか、上限を引き上げてください。",
  POLICY_BUDGET_MONTHLY_EXCEEDED:
    "今月の利用額が月次予算の上限に達しました。月が変わるのを待つか、上限を引き上げてください。",
  POLICY_MODEL_DENIED_BY_POLICY:
    "選択されたモデルはこのキーの拒否リストにあります。拒否リストから外すか、別のキーを選択してください。",
  POLICY_MODEL_OUTSIDE_ALLOWLIST:
    "選択されたモデルはこのキーの許可リストにありません。ポリシーエディタで追加するか、別のキーを選択してください。",
  POLICY_NO_MODEL_MATCHES_CAPABILITIES:
    "登録されたキーの中に、要求された capabilities を満たすデフォルトモデルを持つものがありません。対応モデルをデフォルトにしたキーを登録するか、requires[] を緩めてください。",
  POLICY_UNKNOWN_MODEL:
    "要求されたモデルがローカルカタログにありません。keyquill-mobile を更新するか、既知のモデルを選択してください。",
};
