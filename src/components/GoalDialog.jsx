import { useEffect, useId, useRef, useState } from "react";
import { parseGoal, splitGoal } from "../lib/goal.js";

export function GoalDialog({ open, goalMinutes, deviceSecret, saving, onCancel, onSave }) {
  const titleId = useId();
  const hoursRef = useRef(null);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("15");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const split = splitGoal(goalMinutes);
    setHours(String(split.hours));
    setMinutes(String(split.minutes));
    setError("");
    const frame = requestAnimationFrame(() => hoursRef.current?.focus());
    function onKey(event) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, goalMinutes, onCancel]);

  if (!open) return null;

  function submit(event) {
    event.preventDefault();
    const parsed = parseGoal(hours === "" ? NaN : Number(hours), minutes === "" ? NaN : Number(minutes));
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onSave(parsed.minutes);
  }

  return (
    <div className="ov" onMouseDown={onCancel}>
      <form
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id={titleId}>Set daily goal</h2>
        <p className="sub">How long do you want to lock your phone away each day?</p>
        <div className="f">
          <div>
            <label htmlFor="goal-hours">Hours</label>
            <input
              id="goal-hours"
              ref={hoursRef}
              type="number"
              inputMode="numeric"
              min="0"
              max="24"
              step="1"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
            <small>0 to 24</small>
          </div>
          <div>
            <label htmlFor="goal-minutes">Minutes</label>
            <input
              id="goal-minutes"
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              step="1"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
            <small>0 to 59</small>
          </div>
        </div>
        {error ? <p className="err">{error}</p> : null}
        <div className="btns">
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn pri" disabled={saving}>
            {saving ? "Saving…" : "Save goal"}
          </button>
        </div>
        {deviceSecret ? (
          <p className="secret">
            Toaster secret
            <code>{deviceSecret}</code>
          </p>
        ) : null}
      </form>
    </div>
  );
}
