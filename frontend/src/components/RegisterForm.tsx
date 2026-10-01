import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, register } from "../api";
import { useAuth } from "../AuthContext";

interface Props {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: Props) {
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { accessToken } = await register(email, password);
      await setSession(accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Create account</h1>

      <label htmlFor="reg-email">Email</label>
      <input
        id="reg-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="reg-password">Password</label>
      <input
        id="reg-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="hint">At least 12 characters.</p>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Creating account..." : "Create account"}
      </button>

      <div className="links">
        <button type="button" className="link" onClick={onSwitchToLogin}>
          Already have an account? Log in
        </button>
      </div>
    </form>
  );
}
