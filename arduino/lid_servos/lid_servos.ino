#include <Servo.h>

Servo myServo1;
Servo myServo2;
Servo lidServo;

const int servoPin1 = 9;
const int servoPin2 = 12;
const int lidServoPin = 13;
const int buttonPin = 8;
const int trigPin = 6;
const int echoPin = 7;

const unsigned long DURATION_MS = 3000;
const unsigned long HOLD_MS = 15000;
const unsigned long OBJECT_REPORT_MS = 500;
const unsigned long PING_TIMEOUT_US = 30000;
// HC-SR04 needs a short gap between pings so the previous echo can die.
const unsigned long PING_GAP_MS = 60;

const int SERVO1_DOWN = 120;
const int SERVO1_UP = 30;
const int SERVO2_DOWN = 60;
const int SERVO2_UP = 150;
const int LID_UP = 90;
const int LID_DOWN = 20;

// How close an object must be before it counts, in cm. Change this to retune.
const int OBJECT_DISTANCE_CM = 15;

int buttonState = 0;
int lastButtonState = LOW;
int counter = 0;

void setup() {
  myServo1.attach(servoPin1);
  myServo2.attach(servoPin2);
  lidServo.attach(lidServoPin);
  pinMode(buttonPin, INPUT_PULLDOWN);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  digitalWrite(trigPin, LOW);

  myServo1.write(SERVO1_UP);
  myServo2.write(SERVO2_UP);
  lidServo.write(LID_UP);

  Serial.begin(9600);
}

void sweep(int from, int to, unsigned long durationMs) {
  unsigned long startTime = millis();
  while (millis() - startTime < durationMs) {
    float progress = (float)(millis() - startTime) / durationMs;
    lidServo.write(from + (to - from) * progress);
  }
  lidServo.write(to);
}

// Centimeters, or -1 when pulseIn times out (no echo).
long measureDistanceCm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long durationUs = pulseIn(echoPin, HIGH, PING_TIMEOUT_US);
  if (durationUs == 0) {
    return -1;
  }
  return durationUs / 58;
}

void uncooking() {
  myServo1.write(SERVO1_DOWN);
  myServo2.write(SERVO2_DOWN);
  sweep(LID_UP, LID_DOWN, DURATION_MS);

  unsigned long holdStart = millis();
  unsigned long lastReportMs = 0;
  bool inRange = false;

  while (millis() - holdStart < HOLD_MS) {
    long distanceCm = measureDistanceCm();

    if (distanceCm >= 0 && distanceCm <= OBJECT_DISTANCE_CM) {
      unsigned long now = millis();
      // Entering range prints immediately. While it stays, at most every 500 ms.
      if (!inRange || now - lastReportMs >= OBJECT_REPORT_MS) {
        Serial.print("Object detected: ");
        Serial.print(distanceCm);
        Serial.println(" cm");
        lastReportMs = now;
      }
      inRange = true;
    } else if (distanceCm > OBJECT_DISTANCE_CM) {
      inRange = false;
    }

    unsigned long elapsed = millis() - holdStart;
    if (elapsed >= HOLD_MS) {
      break;
    }
    unsigned long remaining = HOLD_MS - elapsed;
    delay(remaining < PING_GAP_MS ? remaining : PING_GAP_MS);
  }

  myServo1.write(SERVO1_UP);
  myServo2.write(SERVO2_UP);
  sweep(LID_DOWN, LID_UP, DURATION_MS);
}

void loop() {
  buttonState = digitalRead(buttonPin);
  if (buttonState == HIGH && lastButtonState == LOW) {
    counter++;
    Serial.println(counter);
    delay(50);
    uncooking();
  }
  lastButtonState = buttonState;
}
