import serial
import time
from pathlib import Path
import sys
import json
from datetime import datetime
import os

from QR_code.qr_code_livestream import one_time_qr_scan
from Knock_pattern.binary_code import start_recording_knocks
from Piwho.examples.live_speaker_recognition import voice_open_door

LOG = 'door_actions.json'

def load_log():
    """Load the action log with retry on JSONDecodeError"""
    for attempt in range(3):
        try:
            with open(LOG, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            if attempt < 2:
                time.sleep(0.1)  # Wait a bit and retry
            else:
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

    def _log_action(self, action: str, action_type: str, pass_info=None):
        """Log an action to the JSON file"""
        # Format the action message to include pass info if available
        # if pass_info and "Door unlocked" in action:
        #     action = f"Door unlocked by {pass_info['name']} (ID: {pass_info['id']})"
            
        entry = {
            "action": action,
            "action_type": action_type,
            "action_time": datetime.now().isoformat()
        }
        
        # Add pass info if available
        if pass_info:
            entry["pass_id"] = pass_info['id']
            entry["pass_name"] = pass_info['name']
        else:
            entry["pass_id"] = None
            entry["pass_name"] = None

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

    def send_open_door(self, action_type: str, pass_info=None):
        """Send command to open the door"""
        self.ser.write(b"OPEN_DOOR\n")
        self._log_action("Door unlocked", action_type, pass_info)
        time.sleep(1.5)  # Wait for door to open

    def send_error(self, action_type: str, pass_info=None):
        """Send error signal"""
        self.ser.write(b"ERROR\n")
        self._log_action("Access denied", action_type, pass_info)
        time.sleep(2)  # Wait for buzzer to finish playing

    def monitor_unlock_requests(self):
        """Monitor serial port for unlock requests"""
        try:
            while True:
                if self.ser.in_waiting > 0:
                    line = self.ser.readline().decode('utf-8').strip()

                    if line == "UNLOCK_BY_QR_CODE":
                        print("QR Code unlock requested")
                        unlock_result, pass_info = one_time_qr_scan()
                        if unlock_result:
                            self.send_open_door("QR Code", pass_info)
                        else:
                            self.send_error("QR Code")

                    elif line == "UNLOCK_BY_PATTERN":
                        print("Pattern unlock requested")
                        unlock_result, pass_info = start_recording_knocks()
                        if unlock_result:
                            self.send_open_door("Morse Code", pass_info)
                        else:
                            self.send_error("Morse Code")

                    elif line == "UNLOCK_BY_VOICE":
                        print("Voice unlock requested")
                        unlock_result = voice_open_door()
                        pass_info = {
                            'id': 1,
                            'name': "Samuel"
                        }
                        if unlock_result:
                            self.send_open_door("Voice", pass_info)
                        else:
                            self.send_error("Voice")

        except KeyboardInterrupt:
            print("\nStopping monitor...")
        finally:
            self.ser.close()


if __name__ == "__main__":
    print("Monitoring for unlock requests...")
    unlocker = DoorUnlocker()
    unlocker.monitor_unlock_requests()