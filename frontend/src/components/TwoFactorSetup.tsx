import { useState } from "react";
import type { FormEvent } from "react";
import QRCode from "qrcode";
import { ApiError, enableTwoFactor, setupTwoFactor } from "../api";
import { useAuth } from "../AuthContext";

interface Props {
  onDone: () => void;
}

export function TwoFactorSetup({ onDone }: Props) {
  const { accessToken, refreshUser } = useAuth();
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    if (!accessToken) return;
    setError(null);
    setGenerating(true);

    try {
      const { secret: newSecret, otpauthUrl } = await setupTwoFactor(accessToken);
      const dataUrl = await QRCode.toDataURL(otpauthUrl);
      setSecret(newSecret);
      setQrDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSubmitting(true);

    try {
      await enableTwoFactor(accessToken, code);
      await refreshUser();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!secret) {
    return (
      <div className="card">
        <h1>Enable two-factor auth</h1>
        <p className="hint">
          Generates a new TOTP secret for your account, scannable by Google Authenticator, Authy,
          or any compatible app.
        </p>

        {error && <p className="error">{error}</p>}

        <button type="button" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate setup code"}
        </button>

        <div className="links">
          <button type="button" className="link" onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Scan to finish setup</h1>
      <p className="hint">Scan this with your authenticator app, then enter the code it shows.</p>

      {qrDataUrl && <img className="qr" src={qrDataUrl} alt="TOTP QR code" width={200} height={200} />}
      <p className="hint">
        Can't scan? Enter this secret manually: <code>{secret}</code>
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="enable-code">Confirm with a code</label>
        <input
          id="enable-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Enabling..." : "Enable"}
        </button>
      </form>

      <div className="links">
        <button type="button" className="link" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
