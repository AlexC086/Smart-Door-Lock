const int pwmPin = 9;          // PWM output pin
const int buzzerPin = 10;
const int pwmDutyCycle = 128;   // 50% duty cycle (0-255)
const int buzzerDutyCycle = 255;   // 50% duty cycle (0-255)
const int pwmDuration = 50;     // PWM pulse duration (ms)
const int buzzerDuration = 1000;
const int errorDuration1 = 500;
const int gapDuration = 200;
const int errorDuration2 = 100;
const int offDuration = 1000;   // Delay between pulses (ms)

// Button pins
const int buttonQrPin = 2;      // Button for QR code unlock
const int buttonPatternPin = 3;  // Button for pattern unlock
const int buttonVoicePin = 4;    // Button for voice unlock

// Button states
int buttonQrState = 0;
int buttonPatternState = 0;
int buttonVoiceState = 0;

void setup() {
  Serial.begin(9600);          // Start serial communication
  pinMode(pwmPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  analogWrite(pwmPin, 0);      // Start with PWM off
  analogWrite(buzzerPin, 0);   // Start with buzzer off
  
  // Initialize buttons as inputs with pull-up resistors
  pinMode(buttonQrPin, INPUT_PULLUP);
  pinMode(buttonPatternPin, INPUT_PULLUP);
  pinMode(buttonVoicePin, INPUT_PULLUP);

  delay(500); // Wait for stable signals (prevents false triggers)
}

void loop() {
  // Check if data is available from Raspberry Pi
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n'); // Read until newline
    command.trim(); // Remove whitespace

    // If Pi sends "OPEN_DOOR", trigger the PWM sequence
    if (command == "OPEN_DOOR") {
      // First pulse
      analogWrite(pwmPin, pwmDutyCycle);
      delay(pwmDuration);
      analogWrite(pwmPin, 0);

      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(buzzerDuration);
      analogWrite(buzzerPin, 0);
      
      // Delay between pulses
      delay(offDuration);
      
      // Second pulse
      analogWrite(pwmPin, pwmDutyCycle);
      delay(pwmDuration);
      analogWrite(pwmPin, 0);

      // Optional: Send acknowledgment back to Pi
      Serial.println("DOOR_OPENED");
    }
    else if (command == "ERROR") {
      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(errorDuration1);
      analogWrite(buzzerPin, 0);
      delay(gapDuration);

      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(errorDuration2);
      analogWrite(buzzerPin, 0);
      delay(gapDuration);

      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(errorDuration2);
      analogWrite(buzzerPin, 0);
      delay(gapDuration);

      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(errorDuration1);
      analogWrite(buzzerPin, 0);
      delay(gapDuration);

      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(errorDuration2);
      analogWrite(buzzerPin, 0);
      delay(gapDuration);

      analogWrite(buzzerPin, buzzerDutyCycle);
      delay(errorDuration2);
      analogWrite(buzzerPin, 0);

      // Optional: Send acknowledgment back to Pi
      Serial.println("ERROR");
    }
  }

  // Check button states
  buttonQrState = digitalRead(buttonQrPin);
  buttonPatternState = digitalRead(buttonPatternPin);
  buttonVoiceState = digitalRead(buttonVoicePin);

  // Check if QR code button is pressed (LOW because of pull-up)
  if (buttonQrState == LOW) {
    Serial.println("UNLOCK_BY_QR_CODE");
    delay(200); // Debounce delay
    while(digitalRead(buttonQrPin) == LOW); // Wait for button release
  }

  // Check if pattern button is pressed
  if (buttonPatternState == LOW) {
    Serial.println("UNLOCK_BY_PATTERN");
    delay(200); // Debounce delay
    while(digitalRead(buttonPatternPin) == LOW); // Wait for button release
  }

  // Check if voice button is pressed
  if (buttonVoiceState == LOW) {
    Serial.println("UNLOCK_BY_VOICE");
    delay(200); // Debounce delay
    while(digitalRead(buttonVoicePin) == LOW); // Wait for button release
  }
}