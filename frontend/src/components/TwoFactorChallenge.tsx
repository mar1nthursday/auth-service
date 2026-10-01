import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, verifyTwoFactor } from "../api";
import { useAuth } from "../AuthContext";

interface Props {
  twoFactorToken: string;
  onBack: () => void;
}

export function TwoFactorChallenge({ twoFactorToken, onBack }: Props) {
  const { setSession } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { accessToken } = await verifyTwoFactor(twoFactorToken, code);
      await setSession(accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Two-factor code</h1>
      <p className="hint">Enter the 6-digit code from your authenticator app.</p>

      <label htmlFor="totp-code">Code</label>
      <input
        id="totp-code"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Verifying..." : "Verify"}
      </button>

      <div className="links">
        <button type="button" className="link" onClick={onBack}>
          Back to login
        </button>
      </div>
    </form>
  );
}
