import { useState } from "react";
import { useAuth } from "../AuthContext";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { TwoFactorDisable } from "./TwoFactorDisable";

type Panel = "none" | "enable-2fa" | "disable-2fa";

interface Props {
  onSignOut: () => Promise<void>;
}

export function Dashboard({ onSignOut }: Props) {
  const { user } = useAuth();
  const [panel, setPanel] = useState<Panel>("none");

  if (!user) return null;

  if (panel === "enable-2fa") {
    return <TwoFactorSetup onDone={() => setPanel("none")} />;
  }
  if (panel === "disable-2fa") {
    return <TwoFactorDisable onDone={() => setPanel("none")} />;
  }

  return (
    <div className="card">
      <h1>Welcome</h1>
      <p>
        Logged in as <strong>{user.email}</strong>
      </p>
      <p className="hint">Account created {new Date(user.createdAt).toLocaleString()}</p>
      <p className="hint">
        Two-factor auth: <strong>{user.totpEnabled ? "enabled" : "disabled"}</strong>
      </p>

      {user.totpEnabled ? (
        <button type="button" onClick={() => setPanel("disable-2fa")}>
          Disable 2FA
        </button>
      ) : (
        <button type="button" onClick={() => setPanel("enable-2fa")}>
          Enable 2FA
        </button>
      )}

      <div className="links">
        <button type="button" className="link" onClick={() => onSignOut()}>
          Log out
        </button>
      </div>
    </div>
  );
}
