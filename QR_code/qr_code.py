import cv2
from pyzbar import pyzbar
from picamera2 import Picamera2
import time
import json
import os
import secrets
from datetime import datetime, timedelta
import qrcode

# Configuration
QR_DATABASE = "qr_codes.json"
QR_CODE_DIR = "qr_codes"  # Directory to store QR code images
PASSWORD_LENGTH = 32  # 256-bit password

def initialize_database():
    """Create an empty database if it doesn't exist"""
    if not os.path.exists(QR_DATABASE):
        with open(QR_DATABASE, 'w') as f:
            json.dump([], f)

    # Create QR code directory if it doesn't exist
    if not os.path.exists(QR_CODE_DIR):
        os.makedirs(QR_CODE_DIR)

def load_database():
    """Load the QR code database"""
    with open(QR_DATABASE, 'r') as f:
        return json.load(f)

def save_database(data):
    """Save the QR code database"""
    with open(QR_DATABASE, 'w') as f:
        json.dump(data, f, indent=2)

def generate_password():
    """Generate a secure random password"""
    return secrets.token_hex(PASSWORD_LENGTH)

def generate_qr_code(data, qr_id):
    """Generate and save a QR code image"""
    filename = os.path.join(QR_CODE_DIR, f"qr_code_{qr_id}.png")

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filename)
    return filename

def create_qr_code(name=None, expiration_time=None, one_time=False):
    """Create a new QR code entry and generate QR image"""
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data = load_database()

    # Get the next available ID
    new_id = max([entry['id'] for entry in data], default=0) + 1

    # Generate password
    password = generate_password()

    # Create new entry
    new_entry = {
        "id": new_id,
        "name": name,
        "password": password,
        "creation_time": current_time,
        "expiration_time": expiration_time,
        "deletion_time": None,
        "is_one_time": one_time,
        "qr_code_file": f"qr_code_{new_id}.png"  # Store filename reference
    }

    # Generate and save QR code
    qr_filename = generate_qr_code(password, new_id)

    data.append(new_entry)
    save_database(data)

    print(f"\nCreated new QR code with ID: {new_id}")
    print(f"Password: {password}")
    print(f"QR code saved as: {qr_filename}\n")

def delete_qr_code(qr_id):
    """Mark a QR code as deleted (soft delete)"""
    data = load_database()

    for entry in data:
        if entry['id'] == qr_id and entry['deletion_time'] is None:
            entry['deletion_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            save_database(data)
            print(f"QR code {qr_id} has been deleted (marked as inactive)")
            return

    print(f"QR code {qr_id} not found or already deleted")

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

def scan_qr_code():
    """Scan QR codes using the camera"""
    # Initialize camera
    picam2 = Picamera2()
    preview_config = picam2.create_preview_configuration(main={"size": (640, 480)})
    picam2.configure(preview_config)
    picam2.start()

    print("\nPress q to exit scanning mode.")
    try:
        while True:
            # Capture frame
            image = picam2.capture_array()

            # Convert to RGB (OpenCV uses BGR)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            # Detect QR codes in the frame
            decoded_objs = pyzbar.decode(rgb_image)
            for obj in decoded_objs:
                # Draw rectangle around QR code
                (x, y, w, h) = obj.rect
                cv2.rectangle(rgb_image, (x, y), (x + w, y + h), (0, 255, 0), 2)

                # Verify QR code
                qr_data = obj.data.decode('utf-8')
                verify_qr_code(qr_data)

            # Display the image
            cv2.imshow("QR Code Scanner", rgb_image)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
    finally:
        cv2.destroyAllWindows()
        picam2.stop()

def one_time_qr_scan(timeout=30):
    """
    Scan continuously until a QR code is detected, then return verification result.
    Returns True if valid QR, False if invalid QR or timeout reached.
    """
    # Initialize camera
    picam2 = Picamera2()
    preview_config = picam2.create_preview_configuration(main={"size": (640, 480)})
    picam2.configure(preview_config)
    picam2.start()

    try:
        start_time = time.time()
        while time.time() - start_time < timeout:
            # Capture frame
            image = picam2.capture_array()

            # Convert to RGB (OpenCV uses BGR)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            # Detect QR codes
            decoded_objs = pyzbar.decode(rgb_image)
            if decoded_objs:  # If any QR code is detected
                qr_data = decoded_objs[0].data.decode('utf-8')  # Check first QR code found
                return verify_qr_code(qr_data)

            time.sleep(0.1)  # Small delay between scans

        return False  # Timeout reached with no QR code detected
    finally:
        picam2.stop()

def list_qr_codes():
    """List all active QR codes"""
    data = load_database()
    current_time = datetime.now()

    print("\nActive QR Codes:")
    print("ID\tCreated At\t\t\tExpires At\t\tQR Code File")
    print("---------------------------------------------------------------")

    for entry in data:
        if entry['deletion_time'] is None:
            expires_at = "Never" if entry['expiration_time'] is None else entry['expiration_time']
            print(f"{entry['id']}\t{entry['creation_time']}\t{expires_at}\t{entry['qr_code_file']}")

    print("\nDeleted QR Codes:")
    print("ID\tCreated At\t\t\tDeleted At")
    print("------------------------------------------------")

    for entry in data:
        if entry['deletion_time'] is not None:
            print(f"{entry['id']}\t{entry['creation_time']}\t{entry['deletion_time']}")

def set_expiration(qr_id, days):
    """Set expiration time for a QR code"""
    data = load_database()

    for entry in data:
        if entry['id'] == qr_id and entry['deletion_time'] is None:
            if days <= 0:
                entry['expiration_time'] = None
            else:
                expire_date = datetime.now() + timedelta(days=days)
                entry['expiration_time'] = expire_date.strftime("%Y-%m-%d %H:%M:%S")

            save_database(data)
            print(f"QR code {qr_id} expiration set to {days} days")
            return

    print(f"QR code {qr_id} not found or already deleted")

def main_menu():
    """Display the main menu"""
    print("\nDoor Access QR Code System")
    print("1. Create new QR code")
    print("2. Delete QR code")
    print("3. Scan/Verify QR code")
    print("4. List all QR codes")
    print("5. Set QR code expiration")
    print("6. Exit")

    try:
        choice = int(input("Enter your choice: "))
        return choice
    except ValueError:
        return -1

def main():
    initialize_database()

    while True:
        choice = main_menu()

        if choice == 1:
            name = input("Enter a name for this QR code (optional): ")
            one_time = input("Is this QR code a one-time pass? (yes/no): ").lower() == 'yes'
            create_qr_code(name=name, one_time=one_time)
        elif choice == 2:
            qr_id = int(input("Enter QR code ID to delete: "))
            delete_qr_code(qr_id)
        elif choice == 3:
            scan_qr_code()
        elif choice == 4:
            list_qr_codes()
        elif choice == 5:
            qr_id = int(input("Enter QR code ID: "))
            days = int(input("Enter expiration in days (0 for no expiration): "))
            set_expiration(qr_id, days)
        elif choice == 6:
            print("Exiting...")
            break
        else:
            print("Invalid choice, please try again")

if __name__ == "__main__":
    main()