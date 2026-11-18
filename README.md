# Uncooked

Companion site for a phone toaster. The phone locks on the device. This Next.js page shows whether it is uncooking, how long is left, the daily goal, the streak, and past sessions.

The Arduino Uno R4 WiFi posts sensor and timer state to Supabase. The site reads that. It does not start the timer. You set the time on the toaster.

Without Supabase credentials the page runs on sample data so the layout can be checked. Add `?demo=uncooking` to see a live countdown.

## Page

One screen:

- **Daily goal**, top right. Click it to set hours (0–24) and minutes (0–59). The default is 15 minutes. 24 hours only saves with 0 minutes.
- **Toaster status.** **Uncooking** when the tray is down, a phone is detected, and the timer is running. Anything else is **Not uncooking**. The countdown is the time left on the device.
- **Today** is how many minutes have been locked since midnight, against the goal.
- **Streak.** A finished day counts when the locked time is at least the goal. Today stays pending until midnight. A missed day breaks the streak. Days are evaluated in `America/New_York` unless the profile says otherwise.
- **History.** Date, start, and end of each session. An open lock says “In progress”.

## Run the site

```bash
npm install
npm test
npm run dev
```

Open http://127.0.0.1:3000.

## Supabase

1. Create a project.
2. Run `supabase/migrations/001_init.sql` in the SQL editor.
3. Deploy the ingest function:

```bash
supabase functions deploy ingest
```

The sketch sends the anon key as the bearer token, which is what the function’s JWT check expects. The device secret in `X-Device-Secret` is what actually authorizes a toaster.

4. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. In Authentication, turn off “Confirm email” while you are the only user, or the sign-up screen will wait on a confirmation mail.
6. Create an account on the site. The signup trigger makes a profile (goal 15 minutes), a toaster row, and an empty status row.
7. In the SQL editor, `select secret from public.devices;` and put that value in the Arduino secrets file. The same secret is shown at the bottom of the goal dialog after you sign in.

The browser can read its own rows. Only the ingest function, using the service role, writes status and sessions.

A session opens on the first report where both sensors are true and `timer_running` is true. It closes on the next report where that is no longer true. If the toaster goes quiet, the page stops the countdown after 20 seconds and stops adding time to the open session.

## Arduino

Board: Arduino Uno R4 WiFi. Sketch: `arduino/uncooked_toaster/uncooked_toaster.ino`.

Copy `arduino_secrets.h.example` to `arduino_secrets.h` in the same folder. Library: WiFiS3, which ships with the Uno R4 board package.

| Pin | Connection |
| --- | --- |
| D2 | Tray switch, closed to ground when the tray is down |
| D3 | Phone sensor, closed to ground when a phone is in the tray |
| D4 | Start button |
| D5 | Cancel button |
| A0 | Time dial, 5 minutes to 2 hours |
| D9 | MOSFET gate for the electromagnet |

Put a flyback diode across the coil. The magnet is on only while the timer is running, both sensors still see the phone, and cancel has not been pressed. Unplugging the board releases the phone.

Active-high sensor modules need the `LOW` check in `updateDebounced()` flipped.
