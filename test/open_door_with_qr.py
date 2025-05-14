import serial
import time

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))
from QR_code.qr_code import one_time_qr_scan

# Configure serial port
ser = serial.Serial('/dev/ttyACM0', 9600, timeout=1)

# Wait Arduino board to reset
time.sleep(2)

ser.reset_input_buffer()

def send_open_door():
    # Send command to Arduino
    ser.write(b"OPEN_DOOR\n")
    # Wait until the door open
    time.sleep(1.5)
    # Read Arduino's response
    response = ser.readline().decode('utf-8').strip()
    print(response)
    if response == "DOOR_OPENED":
        print("PWM pulse triggered successfully!")
    else:
        print("Error: No response from Arduino")

def send_error():
    # Send command to Arduino
    ser.write(b"ERROR\n")
    # Wait until the buzzer finish playing
    time.sleep(2)
    # Read Arduino's response
    response = ser.readline().decode('utf-8').strip()
    print(response)
    if response == "ERROR":
        print("Wrong password!")
    else:
        print("Error: No response from Arduino")

# Example usage:
if one_time_qr_scan():
    send_open_door()
else:
    send_error()

ser.close()