**LLMVault** は LLM API の「BYOK (Bring Your Own Key)」ウォレットです。OpenAI / Anthropic / Gemini などの API キーを拡張機能内に登録し、承認した Web アプリが、あなたのキーを使ってチャットを実行できるようにします。Web アプリ側やそのサーバーはキー本体を一切目にしません。

### 解決する問題

LLM API を使う Web アプリは通常、以下のいずれかを強いてきます:
- アプリのサーバーにキーを預ける（信頼が必要、漏洩リスク）
- `localStorage` にキーを保存する（XSS リスク）
- AI 機能を諦める

LLMVault は第四の選択肢: キーを拡張機能の独立プロセスに隔離し、Web アプリは狭く、ユーザー承認済みチャネルだけから補完を要求する。

### 使い方

1. ツールバーの LLMVault アイコンをクリック。プロバイダー（OpenAI / Anthropic / Gemini / Groq / Mistral / DeepSeek / Together / Fireworks / xAI / Ollama 等、OpenAI 互換なら何でも）を登録。API キーを入力
2. LLMVault SDK を組み込んだ Web アプリを訪問
3. そのアプリが初めてアクセスを要求すると、オリジン名を示す consent popup。承認 / 拒否を選ぶ
4. 承認済みアプリは補完呼び出しが可能。拡張機能の Service Worker が直接プロバイダーへ HTTPS で接続、ページはストリーミング応答だけを受け取る

### セキュリティ特性

- **キーは `browser.storage.session` に保存** — ephemeral（ブラウザ終了で消去）、通常の Web ページ JavaScript からアクセス不可
- **オリジン毎の consent**（MetaMask 方式）。あらゆるオリジンは popup で明示承認が必要。承認は `browser.storage.local` に保存、拡張ポップアップからいつでも取り消し可能
- **キー登録・削除は popup のみ**。Web ページからはキーの登録・削除・抜き出し不可
- **ゼロテレメトリ**。LLMVault が管理するサーバーへの接続はゼロ（そもそもサーバーが存在しない）。ネットワーク送信先はユーザーが選んだ LLM プロバイダーのみ

### 対応プロバイダー

OpenAI Chat Completions 形式を話せるものなら全てそのまま動作。Anthropic Messages API はネイティブ変換で対応。

動作確認済: OpenAI / Anthropic / Google Gemini / Groq / Mistral / DeepSeek / Together AI / Fireworks AI / xAI (Grok) / Ollama（ローカル）、その他 OpenAI 互換エンドポイント。

### 開発者向け

公式 SDK で Web アプリに組み込み:

```
npm install llmvault
```

```js
import { LLMVault } from "llmvault";
const vault = new LLMVault();
if (await vault.isAvailable()) {
  await vault.connect();
  const result = await vault.chat({ messages: [{ role: "user", content: "Hello" }] });
}
```

ドキュメント: https://github.com/R-Okauchi/llmvault

### リンク

- ライブデモ: https://r-okauchi.github.io/llmvault/demo/
- ソースコード (MIT): https://github.com/R-Okauchi/llmvault
- プライバシーポリシー: https://r-okauchi.github.io/llmvault/privacy-policy
- 問題報告: https://github.com/R-Okauchi/llmvault/issues
