/*
  Uncooked toaster — Arduino Uno R4 WiFi

  The lock runs on the board. This sketch tells Supabase whether the tray
  is down, whether a phone is in it, and how long is left on the timer.
  The Next.js companion reads that and shows "Uncooking" only when both
  sensors see something and the timer is running.

  Wiring, active-low with INPUT_PULLUP (a closed switch reads LOW):
    D2  tray switch      closed when the tray is fully in
    D3  phone sensor     closed when a phone is in the tray
    D4  start button     starts the timer
    D5  cancel button    releases the lock
    A0  time dial        5 minutes at one end, 2 hours at the other
    D9  MOSFET gate      low-side switch for the electromagnet
    Flyback diode across the coil, cathode toward +V.

  If a sensor module is active-high, flip the LOW checks in readAsserted().

  Copy arduino_secrets.h.example to arduino_secrets.h before compiling.
  The magnet still releases on a timer, a cancel press, or a sensor opening
  even when Wi-Fi is down.
*/

#include <WiFiS3.h>
#include "arduino_secrets.h"

const uint8_t PIN_TRAY = 2;
const uint8_t PIN_PHONE = 3;
const uint8_t PIN_START = 4;
const uint8_t PIN_CANCEL = 5;
const uint8_t PIN_POT = A0;
const uint8_t PIN_MAGNET = 9;

const unsigned long MIN_MS = 5UL * 60UL * 1000UL;
const unsigned long MAX_MS = 2UL * 60UL * 60UL * 1000UL;
const unsigned long REPORT_MS = 5000;
const unsigned long DEBOUNCE_MS = 40;

struct Debounced {
  uint8_t pin;
  bool stable;
  bool lastReading;
  unsigned long lastChange;
};

Debounced tray = { PIN_TRAY, false, false, 0 };
Debounced phone = { PIN_PHONE, false, false, 0 };
Debounced startBtn = { PIN_START, false, false, 0 };
Debounced cancelBtn = { PIN_CANCEL, false, false, 0 };

enum RunState { IDLE, LOCKED };
RunState state = IDLE;
unsigned long lockStart = 0;
unsigned long lockMs = 0;
unsigned long lastReport = 0;
bool startWasDown = false;

bool updateDebounced(Debounced &input) {
  bool reading = digitalRead(input.pin) == LOW;
  if (reading != input.lastReading) {
    input.lastChange = millis();
    input.lastReading = reading;
  }
  if (millis() - input.lastChange > DEBOUNCE_MS) input.stable = reading;
  return input.stable;
}

unsigned long dialDuration() {
  int raw = analogRead(PIN_POT);
  if (raw < 0) raw = 0;
  if (raw > 1023) raw = 1023;
  return MIN_MS + (unsigned long)((MAX_MS - MIN_MS) * (raw / 1023.0));
}

unsigned long remainingMs() {
  if (state != LOCKED) return 0;
  unsigned long elapsed = millis() - lockStart;
  return elapsed >= lockMs ? 0 : lockMs - elapsed;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(SECRET_SSID, SECRET_PASS);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 8000) delay(200);
  if (WiFi.status() == WL_CONNECTED) Serial.println("Wi-Fi connected");
  else Serial.println("Wi-Fi unavailable, lock still runs locally");
}

bool report(bool trayDown, bool phonePresent, bool timerRunning) {
  lastReport = millis();
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiSSLClient client;
  client.setTimeout(2000);
  if (!client.connect(SECRET_HOST, 443)) {
    Serial.println("Could not reach Supabase");
    return false;
  }

  char body[180];
  snprintf(body, sizeof(body),
           "{\"tray_down\":%s,\"phone_present\":%s,\"timer_running\":%s,\"remaining_ms\":%lu}",
           trayDown ? "true" : "false",
           phonePresent ? "true" : "false",
           timerRunning ? "true" : "false",
           remainingMs());

  client.print("POST /functions/v1/ingest HTTP/1.1\r\n");
  client.print("Host: ");
  client.print(SECRET_HOST);
  client.print("\r\nContent-Type: application/json\r\n");
  client.print("apikey: ");
  client.print(SECRET_ANON_KEY);
  client.print("\r\nAuthorization: Bearer ");
  client.print(SECRET_ANON_KEY);
  client.print("\r\nX-Device-Secret: ");
  client.print(SECRET_DEVICE_SECRET);
  client.print("\r\nContent-Length: ");
  client.print(strlen(body));
  client.print("\r\nConnection: close\r\n\r\n");
  client.print(body);

  unsigned long waitStarted = millis();
  while (!client.available() && client.connected() && millis() - waitStarted < 2000) delay(10);
  if (client.available()) {
    String statusLine = client.readStringUntil('\n');
    Serial.println(statusLine);
  }
  client.stop();
  return true;
}

void release(bool trayDown, bool phonePresent) {
  digitalWrite(PIN_MAGNET, LOW);
  state = IDLE;
  report(trayDown, phonePresent, false);
}

void setup() {
  pinMode(PIN_TRAY, INPUT_PULLUP);
  pinMode(PIN_PHONE, INPUT_PULLUP);
  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_CANCEL, INPUT_PULLUP);
  pinMode(PIN_MAGNET, OUTPUT);
  digitalWrite(PIN_MAGNET, LOW);
  analogReadResolution(10);
  Serial.begin(115200);
  connectWifi();
}

void loop() {
  bool trayDown = updateDebounced(tray);
  bool phonePresent = updateDebounced(phone);
  bool startDown = updateDebounced(startBtn);
  bool cancelDown = updateDebounced(cancelBtn);
  bool startEdge = startDown && !startWasDown;
  startWasDown = startDown;

  if (state == IDLE) {
    if (startEdge && trayDown && phonePresent) {
      lockMs = dialDuration();
      lockStart = millis();
      digitalWrite(PIN_MAGNET, HIGH);
      state = LOCKED;
      Serial.print("Locked for ms ");
      Serial.println(lockMs);
      report(trayDown, phonePresent, true);
    }
  } else if (cancelDown || !trayDown || !phonePresent || (millis() - lockStart) >= lockMs) {
    Serial.println("Released");
    release(trayDown, phonePresent);
  }

  if (millis() - lastReport >= REPORT_MS) {
    report(trayDown, phonePresent, state == LOCKED);
  }
}
