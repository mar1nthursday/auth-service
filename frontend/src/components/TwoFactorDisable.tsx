import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, disableTwoFactor } from "../api";
import { useAuth } from "../AuthContext";

interface Props {
  onDone: () => void;
}

export function TwoFactorDisable({ onDone }: Props) {
  const { accessToken, refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSubmitting(true);

    try {
      await disableTwoFactor(accessToken, code);
      await refreshUser();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Disable two-factor auth</h1>
      <p className="hint">Enter a current code from your authenticator app to confirm.</p>

      <label htmlFor="disable-code">Code</label>
      <input
        id="disable-code"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Disabling..." : "Disable"}
      </button>

      <div className="links">
        <button type="button" className="link" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
