import cv2
import numpy as np
import requests
import pyzbar.pyzbar as pyzbar
from datetime import datetime
import json
import os
import secrets
import time

# Configuration (same as before)
QR_DATABASE = "qr_codes.json"
PASSWORD_LENGTH = 32  # 256-bit password

# URL of your FastAPI livestream
FASTAPI_STREAM_URL = "http://localhost:5000/video_feed"

def load_database():
    """Load the QR code database"""
    with open(QR_DATABASE, 'r') as f:
        return json.load(f)

def verify_qr_code(password):
    """Verify if a QR code is valid"""
    data = load_database()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for entry in data:
        if (entry['password'] == password and
                entry['deletion_time'] is None and
                (entry['expiration_time'] is None or
                 entry['expiration_time'] > current_time)):
            print(f"Access granted for QR code ID: {entry['id']}")
            if entry['is_one_time']:
                delete_qr_code(entry['id'])
            return True

    print("Access denied: Invalid or expired QR code")
    return False

def delete_qr_code(qr_id):
    """Mark a QR code as deleted (soft delete)"""
    data = load_database()
    for entry in data:
        if entry['id'] == qr_id and entry['deletion_time'] is None:
            entry['deletion_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(QR_DATABASE, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"QR code {qr_id} has been deleted (marked as inactive)")
            return
    print(f"QR code {qr_id} not found or already deleted")

def scan_from_fastapi_stream():
    """Scan QR codes from FastAPI livestream"""
    stream = requests.get(FASTAPI_STREAM_URL, stream=True)
    bytes_data = bytes()

    try:
        for chunk in stream.iter_content(chunk_size=1024):
            bytes_data += chunk
            a = bytes_data.find(b'\xff\xd8')  # JPEG start marker
            b = bytes_data.find(b'\xff\xd9')  # JPEG end marker

            if a != -1 and b != -1:
                jpg = bytes_data[a:b+2]
                bytes_data = bytes_data[b+2:]

                # Decode JPEG to OpenCV frame
                frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)

                # Detect QR codes
                decoded_objs = pyzbar.decode(frame)
                for obj in decoded_objs:
                    (x, y, w, h) = obj.rect
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

                    # Verify QR code
                    qr_data = obj.data.decode('utf-8')
                    verify_qr_code(qr_data)

                # Display the frame (optional)
                cv2.imshow("QR Scanner (FastAPI Stream)", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    finally:
        cv2.destroyAllWindows()

if __name__ == "__main__":
    print("Starting QR scanner using FastAPI livestream...")
    scan_from_fastapi_stream()