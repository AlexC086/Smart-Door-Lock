import os
import json
import secrets
import qrcode
from datetime import datetime, timedelta

# Configuration
QR_DATABASE = os.path.join(os.path.dirname(__file__), "qr_codes.json")
QR_CODE_DIR = os.path.join(os.path.dirname(__file__), "qr_codes")  # Directory to store QR code images
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
    initialize_database()
    with open(QR_DATABASE, 'r') as f:
        return json.load(f)

def save_database(data):
    """Save the QR code database"""
    with open(QR_DATABASE, 'w') as f:
        json.dump(data, f, indent=2)

def generate_password():
    """Generate a secure random password"""
    return secrets.token_hex(PASSWORD_LENGTH)

def generate_qr_code_image(data, qr_id):
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

def create_qr_code(qr_id, name, expiration_time, is_one_time=False):
    """Create a new QR code entry and generate QR image"""
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data = load_database()

    # Generate password
    password = generate_password()

    # Create new entry
    new_entry = {
        "id": qr_id,
        "name": name,
        "password": password,
        "creation_time": current_time,
        "expiration_time": expiration_time,
        "deletion_time": None,
        "is_one_time": is_one_time,
        "type": "one-time" if is_one_time else "multiple-pass",
        "qr_code_file": f"qr_code_{qr_id}.png"  # Store filename reference
    }

    # Generate and save QR code
    generate_qr_code_image(password, qr_id)

    data.append(new_entry)
    save_database(data)
    
    return new_entry

def edit_qr_code(qr_id, name=None, expiration_time=None, is_one_time=None):
    """Edit an existing QR code entry"""
    data = load_database()
    
    for entry in data:
        if entry['id'] == qr_id and entry['deletion_time'] is None:
            if name is not None:
                entry['name'] = name
            if expiration_time is not None:
                entry['expiration_time'] = expiration_time
            if is_one_time is not None:
                entry['is_one_time'] = is_one_time
                entry['type'] = "one-time" if is_one_time else "multiple-pass"
            
            save_database(data)
            return entry
            
    return None  # QR code not found or already deleted

def delete_qr_code(qr_id):
    """Mark a QR code as deleted (soft delete)"""
    data = load_database()

    for entry in data:
        if entry['id'] == qr_id and entry['deletion_time'] is None:
            entry['deletion_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            save_database(data)
            return True
            
    return False  # QR code not found or already deleted

def get_qr_code_path(qr_id):
    """Get the path to a QR code image"""
    data = load_database()
    
    for entry in data:
        if entry['id'] == qr_id:  # Removed condition for deletion_time being None
            qr_file = entry.get('qr_code_file')
            if qr_file:
                return os.path.join(QR_CODE_DIR, qr_file)
    
    return None  # QR code not found

def verify_qr_code(password):
    """Verify if a QR code is valid"""
    data = load_database()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for entry in data:
        if (entry['password'] == password and
                entry['deletion_time'] is None and
                (entry['expiration_time'] is None or
                 entry['expiration_time'] > current_time)):
            
            if entry['is_one_time']:
                delete_qr_code(entry['id'])
            
            return {'valid': True, 'id': entry['id'], 'name': entry['name']}

    return {'valid': False}
