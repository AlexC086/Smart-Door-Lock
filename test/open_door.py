import serial
import time
from pathlib import Path
import sys

# Add QR code module to path
sys.path.append(str(Path(__file__).parent.parent))
from QR_code.qr_code_livestream import one_time_qr_scan
from Knock_pattern.binary_code import start_recording_knocks

class DoorUnlocker:
    def __init__(self, port='/dev/ttyACM0', baudrate=9600):
        self.ser = serial.Serial(port, baudrate, timeout=1)
        time.sleep(2)  # Wait for Arduino to reset
        self.ser.reset_input_buffer()
        
    def send_open_door(self):
        """Send command to open the door"""
        self.ser.write(b"OPEN_DOOR\n")
        time.sleep(1.5)  # Wait for door to open
        
    def send_error(self):
        """Send error signal"""
        self.ser.write(b"ERROR\n")
        time.sleep(2)  # Wait for buzzer to finish playing
        
    def monitor_unlock_requests(self):
        """Monitor serial port for unlock requests"""
        try:
            while True:
                if self.ser.in_waiting > 0:
                    line = self.ser.readline().decode('utf-8').strip()
                    
                    if line == "UNLOCK_BY_QR_CODE":
                        print("QR Code unlock requested")
                        if one_time_qr_scan():
                            self.send_open_door()
                        else:
                            self.send_error()
                            
                    elif line == "UNLOCK_BY_PATTERN":
                        print("Pattern unlock requested")
                        if start_recording_knocks():
                            self.send_open_door()
                        
                    elif line == "UNLOCK_BY_VOICE":
                        print("Voice unlock requested")
                        # Add your voice recognition logic here
                        # For now, we'll just open the door
                        self.send_open_door()
                        
        except KeyboardInterrupt:
            print("\nStopping monitor...")
        finally:
            self.ser.close()

if __name__ == "__main__":
    print("Monitoring for unlock requests...")
    unlocker = DoorUnlocker()
    unlocker.monitor_unlock_requests()