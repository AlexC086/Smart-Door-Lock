import serial

# Configure serial port
ser = serial.Serial('/dev/ttyACM0', 9600, timeout=1)

try:
    while True:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8').strip()
            print("Arduino says:", line)
except KeyboardInterrupt:
    ser.close()
    print("Serial connection closed.")