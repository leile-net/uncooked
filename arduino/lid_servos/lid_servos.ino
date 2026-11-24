#include <Servo.h>

Servo myServo1;
Servo myServo2;
Servo lidServo;
const int servoPin1 = 9;
const int servoPin2 = 12;
const int lidServoPin = 13;
// Pin 12 drives servo2. A servo signal and a button cannot share a pin, so the button is on pin 2.
const int buttonPin = 2;

const unsigned long DURATION_MS = 3000;
const unsigned long HOLD_MS = 15000;
const int START_ANGLE = 70;
const int END_ANGLE = 0;
const int LID_UP = 90;
int buttonState = 0;
int counter = 0;
bool motionRunning = false;

void setup() {
  myServo1.attach(servoPin1);
  myServo2.attach(servoPin2);
  pinMode(buttonPin, INPUT_PULLDOWN);
  lidServo.attach(lidServoPin);
  Serial.begin(9600);
  myServo1.write(30); // up
  myServo2.write(150);
  lidServo.write(LID_UP);
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
  motionRunning = true;
  myServo1.write(120); // down
  myServo2.write(60);
  sweep(90, 20, DURATION_MS);  // lid down
  delay(HOLD_MS);
  myServo1.write(30); // up
  myServo2.write(150);
  sweep(20, 90, DURATION_MS);  // lid back up
  motionRunning = false;
}

int lastButtonState = LOW;
void loop() {
  buttonState = digitalRead(buttonPin);
  if (!motionRunning && buttonState == HIGH && lastButtonState == LOW) {
    counter++;
    Serial.println(counter);
    delay(50);
    uncooking();
    buttonState = digitalRead(buttonPin);
  }
  lastButtonState = buttonState;
  //myServo1.write(120); // down
  //myServo2.write(60);
  //sweep(90, 20, 3000);  // lid down
  //myServo1.write(30); // up
  //myServo2.write(150);
  //sweep(20, 90, 3000);  // lid back up
}
