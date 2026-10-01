import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login } from "../api";
import { useAuth } from "../AuthContext";

interface Props {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
  onTwoFactorRequired: (twoFactorToken: string) => void;
}

export function LoginForm({ onSwitchToRegister, onSwitchToForgot, onTwoFactorRequired }: Props) {
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
      const result = await login(email, password);
      if (result.twoFactorRequired) {
        onTwoFactorRequired(result.twoFactorToken);
      } else {
        await setSession(result.accessToken);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>Log in</h1>

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Logging in..." : "Log in"}
      </button>

      <div className="links">
        <button type="button" className="link" onClick={onSwitchToForgot}>
          Forgot password?
        </button>
        <button type="button" className="link" onClick={onSwitchToRegister}>
          Need an account? Register
        </button>
      </div>
    </form>
  );
}
