import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { TwoFactorChallenge } from "./components/TwoFactorChallenge";
import { ForgotPasswordForm } from "./components/ForgotPasswordForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { Dashboard } from "./components/Dashboard";

type View = "login" | "register" | "two-factor" | "forgot-password" | "reset-password";

function initialView(): View {
  return new URLSearchParams(window.location.search).has("token") ? "reset-password" : "login";
}

function initialResetToken(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [resetToken] = useState(initialResetToken);

  if (loading) {
    return (
      <div className="card">
        <p>Loading...</p>
      </div>
    );
  }

  if (user) {
    return (
      <Dashboard
        onSignOut={async () => {
          await signOut();
          setView("login");
        }}
      />
    );
  }

  switch (view) {
    case "register":
      return <RegisterForm onSwitchToLogin={() => setView("login")} />;
    case "two-factor":
      return (
        <TwoFactorChallenge twoFactorToken={twoFactorToken} onBack={() => setView("login")} />
      );
    case "forgot-password":
      return (
        <ForgotPasswordForm
          onSwitchToLogin={() => setView("login")}
          onSwitchToReset={() => setView("reset-password")}
        />
      );
    case "reset-password":
      return <ResetPasswordForm initialToken={resetToken} onDone={() => setView("login")} />;
    default:
      return (
        <LoginForm
          onSwitchToRegister={() => setView("register")}
          onSwitchToForgot={() => setView("forgot-password")}
          onTwoFactorRequired={(token) => {
            setTwoFactorToken(token);
            setView("two-factor");
          }}
        />
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <div className="page">
        <AuthenticatedApp />
      </div>
    </AuthProvider>
  );
}
