#include <Servo.h>

Servo myServo1;
Servo myServo2;
Servo lidServo;

const int servoPin1 = 9;
const int servoPin2 = 12;
const int lidServoPin = 13;
const int buttonPin = 8;

const unsigned long DURATION_MS = 3000;
const unsigned long HOLD_MS = 15000;

const int SERVO1_DOWN = 120;
const int SERVO1_UP = 30;
const int SERVO2_DOWN = 60;
const int SERVO2_UP = 150;
const int LID_UP = 90;
const int LID_DOWN = 20;

int buttonState = 0;
int lastButtonState = LOW;
int counter = 0;

void setup() {
  myServo1.attach(servoPin1);
  myServo2.attach(servoPin2);
  lidServo.attach(lidServoPin);
  pinMode(buttonPin, INPUT_PULLDOWN);

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

void uncooking() {
  myServo1.write(SERVO1_DOWN);
  myServo2.write(SERVO2_DOWN);
  sweep(LID_UP, LID_DOWN, DURATION_MS);

  delay(HOLD_MS);

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
