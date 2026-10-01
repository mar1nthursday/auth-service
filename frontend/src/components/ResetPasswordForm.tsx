import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, confirmPasswordReset } from "../api";

interface Props {
  initialToken: string;
  onDone: () => void;
}

export function ResetPasswordForm({ initialToken, onDone }: Props) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card">
        <h1>Password updated</h1>
        <p className="hint">All existing sessions were signed out. Log in with your new password.</p>
        <button type="button" onClick={onDone}>
          Back to login
        </button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Set a new password</h1>

      <label htmlFor="reset-token">Reset token</label>
      <input
        id="reset-token"
        required
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />

      <label htmlFor="new-password">New password</label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Set new password"}
      </button>

      <div className="links">
        <button type="button" className="link" onClick={onDone}>
          Back to login
        </button>
      </div>
    </form>
  );
}
