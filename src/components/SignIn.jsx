import { useState } from "react";
import { ToasterIcon } from "./Icons.jsx";

export function SignIn({ onSignIn, onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode) {
    setError("");
    setNotice("");
    if (!email.includes("@") || password.length < 6) {
      setError("Use an email address and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const result = mode === "up" ? await onSignUp(email, password) : await onSignIn(email, password);
    setBusy(false);
    if (result?.error) setError(result.error);
    else if (result?.notice) setNotice(result.notice);
  }

  return (
    <div className="pg">
      <div className="in auth">
        <div className="brand">
          <ToasterIcon />
          Uncooked
        </div>
        <form
          className="card auth-card"
          onSubmit={(event) => {
            event.preventDefault();
            submit("in");
          }}
        >
          <p className="lbl">Companion</p>
          <h2>Sign in</h2>
          <p className="sub">One account per person. The toaster reports to whichever account it was paired with.</p>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="err">{error}</p> : null}
          {notice ? <p className="sub">{notice}</p> : null}
          <div className="btns">
            <button type="button" className="btn" disabled={busy} onClick={() => submit("up")}>
              Create account
            </button>
            <button type="submit" className="btn pri" disabled={busy}>
              {busy ? "Working…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
