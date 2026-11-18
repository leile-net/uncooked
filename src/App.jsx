"use client";

import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard.jsx";
import { GoalDialog } from "./components/GoalDialog.jsx";
import { SignIn } from "./components/SignIn.jsx";
import { DEMO_TIME_ZONE, buildDemo, demoModeFromLocation, loadDemoGoal, saveDemoGoal } from "./lib/demo.js";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase.js";

const EMPTY_STATUS = {
  tray_down: false,
  phone_present: false,
  timer_running: false,
  remaining_ms: 0,
  updated_at: null,
};

export default function App() {
  const configured = isSupabaseConfigured();
  const [now, setNow] = useState(() => new Date());
  const [authReady, setAuthReady] = useState(!configured);
  const [session, setSession] = useState(null);
  const [loadingData, setLoadingData] = useState(configured);
  const [loadError, setLoadError] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [demoReady, setDemoReady] = useState(configured);

  const [goalMinutes, setGoalMinutes] = useState(15);
  const [timeZone, setTimeZone] = useState(DEMO_TIME_ZONE);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [sessions, setSessions] = useState([]);
  const [deviceSecret, setDeviceSecret] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (configured) return;
    const demo = buildDemo(demoModeFromLocation());
    setGoalMinutes(loadDemoGoal());
    setStatus(demo.status);
    setSessions(demo.sessions);
    setDemoReady(true);
  }, [configured]);

  useEffect(() => {
    if (!configured) return undefined;
    const supabase = getSupabase();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [configured]);

  const loadAccount = useCallback(async (userId) => {
    const supabase = getSupabase();
    setLoadError("");
    const [profileResult, statusResult, sessionResult, deviceResult] = await Promise.all([
      supabase.from("profiles").select("daily_goal_minutes, timezone").eq("id", userId).maybeSingle(),
      supabase.from("device_status").select("tray_down, phone_present, timer_running, remaining_ms, updated_at").eq("user_id", userId).maybeSingle(),
      supabase.from("sessions").select("id, started_at, ended_at").eq("user_id", userId).order("started_at", { ascending: false }).limit(2000),
      supabase.from("devices").select("secret").eq("user_id", userId).maybeSingle(),
    ]);
    const error = profileResult.error || statusResult.error || sessionResult.error || deviceResult.error;
    if (error) {
      setLoadError(error.message);
      setLoadingData(false);
      return;
    }
    if (profileResult.data) {
      setGoalMinutes(profileResult.data.daily_goal_minutes);
      setTimeZone(profileResult.data.timezone || DEMO_TIME_ZONE);
    }
    setStatus(statusResult.data ?? { ...EMPTY_STATUS });
    setSessions(sessionResult.data ?? []);
    setDeviceSecret(deviceResult.data?.secret ?? "");
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!configured || !session?.user?.id) return undefined;
    const userId = session.user.id;
    const supabase = getSupabase();
    setLoadingData(true);
    setSessions([]);
    setStatus({ ...EMPTY_STATUS });
    setDeviceSecret("");
    loadAccount(userId);
    const channel = supabase
      .channel(`toaster-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_status", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new) setStatus(payload.new);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from("sessions")
            .select("id, started_at, ended_at")
            .eq("user_id", userId)
            .order("started_at", { ascending: false })
            .limit(2000)
            .then(({ data, error }) => {
              if (!error && data) setSessions(data);
            });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, session?.user?.id, loadAccount]);

  const closeGoal = useCallback(() => {
    if (savingGoal) return;
    setGoalOpen(false);
    setGoalError("");
  }, [savingGoal]);

  async function saveGoal(minutes) {
    if (!configured) {
      saveDemoGoal(minutes);
      setGoalMinutes(minutes);
      setGoalOpen(false);
      return;
    }
    setSavingGoal(true);
    setGoalError("");
    const { error } = await getSupabase().from("profiles").update({ daily_goal_minutes: minutes }).eq("id", session.user.id);
    setSavingGoal(false);
    if (error) {
      setGoalError(error.message);
      return;
    }
    setGoalMinutes(minutes);
    setGoalOpen(false);
  }

  async function signIn(email, password) {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }

  async function signUp(email, password) {
    const { data, error } = await getSupabase().auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) {
      return { notice: "Check your email to confirm the account, then sign in." };
    }
    return {};
  }

  if (!demoReady || !authReady || (session && loadingData && sessions.length === 0 && !loadError)) {
    return (
      <div className="pg">
        <div className="in">
          <p className="sub">Loading…</p>
        </div>
      </div>
    );
  }

  if (configured && !session) {
    return <SignIn onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <>
      {loadError ? (
        <div className="pg">
          <div className="in">
            <p className="err">{loadError}</p>
          </div>
        </div>
      ) : (
        <Dashboard
          goalMinutes={goalMinutes}
          status={status}
          sessions={sessions}
          timeZone={timeZone}
          now={now}
          onEditGoal={() => setGoalOpen(true)}
          onSignOut={
            configured
              ? () => {
                  getSupabase().auth.signOut();
                }
              : null
          }
        />
      )}
      <GoalDialog
        open={goalOpen}
        goalMinutes={goalMinutes}
        deviceSecret={configured ? deviceSecret : ""}
        saving={savingGoal}
        onCancel={closeGoal}
        onSave={saveGoal}
      />
      {goalOpen && goalError ? <p className="toast">{goalError}</p> : null}
    </>
  );
}
