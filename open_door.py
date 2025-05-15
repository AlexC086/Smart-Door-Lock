import serial
import time
from pathlib import Path
import sys
import json
from datetime import datetime
import os

from QR_code.qr_code_livestream import one_time_qr_scan
from Knock_pattern.binary_code import start_recording_knocks

LOG = 'door_actions.json'

def load_log():
    """Load the action log"""
    with open(LOG, 'r') as f:
        return json.load(f)

class DoorUnlocker:
    def __init__(self, port='/dev/ttyACM0', baudrate=9600, log_file=LOG):
        if not os.path.exists(LOG):
            with open(LOG, 'w') as f:
                json.dump([], f)
        self.ser = serial.Serial(port, baudrate, timeout=1)
        self.log_file = Path(log_file)
        time.sleep(2)  # Wait for Arduino to reset
        self.ser.reset_input_buffer()

    def _log_action(self, action: str, action_type: str):
        """Log an action to the JSON file"""
        entry = {
            "action": action,
            "action_type": action_type,
            "action_time": datetime.now().isoformat()
        }

        # Read existing data if file exists
        existing_data = []
        if self.log_file.exists():
            with open(self.log_file, 'r') as f:
                try:
                    existing_data = json.load(f)
                    if not isinstance(existing_data, list):
                        existing_data = []
                except json.JSONDecodeError:
                    existing_data = []

        # Append new entry
        existing_data.append(entry)

        # Write back to file
        with open(self.log_file, 'w') as f:
            json.dump(existing_data, f, indent=2)

    def send_open_door(self, action_type: str):
        """Send command to open the door"""
        self.ser.write(b"OPEN_DOOR\n")
        self._log_action("Door unlocked", action_type)
        time.sleep(1.5)  # Wait for door to open

    def send_error(self, action_type: str):
        """Send error signal"""
        self.ser.write(b"ERROR\n")
        self._log_action("Access denied", action_type)
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
                            self.send_open_door("QR Code")
                        else:
                            self.send_error("QR Code")

                    elif line == "UNLOCK_BY_PATTERN":
                        print("Pattern unlock requested")
                        if start_recording_knocks():
                            self.send_open_door("Morse Code")
                        else:
                            self.send_error("Morse Code")

                    elif line == "UNLOCK_BY_VOICE":
                        print("Voice unlock requested")
                        # Add your voice recognition logic here
                        # For now, we'll just open the door
                        self.send_open_door("Voice")

        except KeyboardInterrupt:
            print("\nStopping monitor...")
        finally:
            self.ser.close()


if __name__ == "__main__":
    print("Monitoring for unlock requests...")
    unlocker = DoorUnlocker()
    unlocker.monitor_unlock_requests()