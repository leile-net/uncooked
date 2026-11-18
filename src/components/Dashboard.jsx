import { formatGoal } from "../lib/goal.js";
import { formatLockedMinutes, formatRemaining, formatSessionDate, formatSessionTime, remainingLabel } from "../lib/format.js";
import { displayRemainingMs, freshUncooking } from "../lib/status.js";
import { buildStreak, historyRows } from "../lib/streak.js";
import { PencilIcon, ToasterIcon } from "./Icons.jsx";

function statusCopy(status) {
  if (status?.tray_down && status?.phone_present) {
    return "Phone is in and the tray is down. Start the timer on the toaster.";
  }
  if (status?.tray_down && !status?.phone_present) {
    return "The tray is down, but no phone is detected. Set the phone in the tray, then start the timer on the toaster.";
  }
  if (!status?.tray_down && status?.phone_present) {
    return "A phone is detected, but the tray is still up. Push the tray down, then start the timer on the toaster.";
  }
  return "Your phone is out of the toaster. Push the tray down with your phone inside, then set the timer on the device to start.";
}

export function Dashboard({
  goalMinutes,
  status,
  sessions,
  timeZone,
  now,
  onEditGoal,
  onSignOut,
}) {
  const uncooking = freshUncooking(status, now);
  const remainingMs = displayRemainingMs(status, now);
  const streak = buildStreak({ sessions, status, goalMinutes, timeZone, now });
  const history = historyRows(sessions, status, now);
  const lockedLabel = formatLockedMinutes(streak.todayMinutes);
  const progress = goalMinutes > 0 ? Math.min(100, (streak.todayMinutes / goalMinutes) * 100) : streak.todayMinutes > 0 ? 100 : 0;
  const progressText = goalMinutes > 0 ? `${lockedLabel} of ${goalMinutes} min` : `${lockedLabel} min locked`;
  const goalText = formatGoal(goalMinutes);

  return (
    <div className="pg">
      <div className="in">
        <header className="hd">
          <div className="brand">
            <ToasterIcon />
            Uncooked
          </div>
          <div className="goal-wrap">
            <button
              type="button"
              className="goal"
              onClick={onEditGoal}
              aria-label={`Edit daily goal, currently ${goalText}`}
            >
              <span>
                <span className="k">Daily goal</span>
                <span className="v">{goalText}</span>
              </span>
              <PencilIcon />
            </button>
            {onSignOut ? (
              <button type="button" className="linkish" onClick={onSignOut}>
                Sign out
              </button>
            ) : null}
          </div>
        </header>

        <div className="row">
          <section className="card st" aria-label="Toaster status">
            <p className="lbl">Toaster status</p>
            {uncooking ? (
              <>
                <h1 className="status-title cooking">Uncooking</h1>
                <div>
                  <div className="big" aria-label={remainingLabel(remainingMs)}>
                    {formatRemaining(remainingMs)}
                  </div>
                  <p className="sub" style={{ marginTop: 6 }}>
                    left on the timer
                  </p>
                </div>
              </>
            ) : (
              <>
                <h1 className="status-title">Not uncooking</h1>
                <p className="sub">{statusCopy(status)}</p>
              </>
            )}
            <div className="chips">
              <span className={status?.tray_down ? "chip on" : "chip off"}>
                <i />
                {status?.tray_down ? "Tray down" : "Tray up"}
              </span>
              <span className={status?.phone_present ? "chip on" : "chip off"}>
                <i />
                {status?.phone_present ? "Phone detected" : "No phone detected"}
              </span>
            </div>
            <div>
              <div
                className="bar"
                role="img"
                aria-label={goalMinutes > 0 ? `${lockedLabel} of ${goalMinutes} minutes locked today` : `${lockedLabel} minutes locked today`}
              >
                <b style={{ width: `${progress}%` }} />
              </div>
              <div className="cap" style={{ marginTop: 8 }}>
                <span>Today</span>
                <span>{progressText}</span>
              </div>
            </div>
          </section>

          <section className="card sk" aria-label="Current streak">
            <p className="lbl">Current streak</p>
            <div className="streak-line">
              <span className="num">{streak.count}</span>
              <span className="sub strong">{streak.count === 1 ? "day in a row" : "days in a row"}</span>
            </div>
            <div className="days" aria-label="Last seven days">
              {streak.days.map((day) => (
                <div className="d" key={day.key}>
                  <span className={day.status === "met" ? "dot" : `dot ${day.status}`} />
                  {day.label}
                </div>
              ))}
            </div>
            <p className="sub">
              Lock your phone away for your daily goal to keep the streak going. Today counts at midnight.
            </p>
          </section>
        </div>

        <section className="card" aria-label="Session history">
          <p className="lbl history-label">History</p>
          {history.length === 0 ? (
            <p className="sub">No sessions yet. They show up here after the toaster runs a timer.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatSessionDate(row.startedAt, timeZone)}</td>
                    <td>{formatSessionTime(row.startedAt, timeZone)}</td>
                    <td className={row.inProgress ? "live" : undefined}>
                      {row.inProgress ? "In progress" : formatSessionTime(row.endedAt, timeZone)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
