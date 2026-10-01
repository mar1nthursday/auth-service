import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, requestPasswordReset } from "../api";

interface Props {
  onSwitchToLogin: () => void;
  onSwitchToReset: () => void;
}

export function ForgotPasswordForm({ onSwitchToLogin, onSwitchToReset }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="card">
        <h1>Check the server console</h1>
        <p className="hint">
          This demo has no real email provider — if that address is registered, the reset link
          was printed to the API server's console output.
        </p>
        <button type="button" onClick={onSwitchToReset}>
          I have my reset token
        </button>
        <div className="links">
          <button type="button" className="link" onClick={onSwitchToLogin}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Reset password</h1>

      <label htmlFor="forgot-email">Email</label>
      <input
        id="forgot-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : "Send reset link"}
      </button>

      <div className="links">
        <button type="button" className="link" onClick={onSwitchToLogin}>
          Back to login
        </button>
      </div>
    </form>
  );
}
