import datetime
import json
import os
import numpy as np
import sounddevice as sd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
import argparse
from play_and_record import int_or_str, audio_callback, record_audio


# Global variables
recording = None
fs = 44100  # Sample rate
threshold = 0.3  # Amplitude threshold for detection
min_silence = 0.1  # Minimum silence duration between knocks (seconds)
min_knock_duration = 0.05  # Minimum knock duration (seconds)
bit_threshold = 0.6  # Silence duration threshold for 0/1 (seconds)
DATABASE = os.path.join(os.path.dirname(__file__), "binary_password.json")

''' Database Related Codes '''
def load_binary_database():
    with open(DATABASE, 'r') as f:
        return json.load(f)


def update_binary_database(data):
    with open(DATABASE, 'w') as f:
        json.dump(data, f, indent=2)


def add_binary_password(id, name, expiration_time, knock_password, password):
    data = load_binary_database()

    # Add new password
    new_password = {
        "id": id,
        "name": name,
        "password": password,
        "knock_password": knock_password,
        "creation_time": datetime.datetime.now().strftime('%Y-%m-%dT%H:%M'),
        "expiration_time": expiration_time,
        "deletion_time": None,
    }

    data.append(new_password)
    update_binary_database(data)

    return [item for item in data if item["deletion_time"] is None]


def edit_binary_password(id, name, expiration_time, knock_password, password):
    data = load_binary_database()
    for item in data:
        if item["id"] == id:
            item["name"] = name
            item["knock_password"] = knock_password
            item["password"] = password
            item["expiration_time"] = expiration_time

    update_binary_database(data)

    return [item for item in data if item["deletion_time"] is None]


def delete_binary_password(id):
    data = load_binary_database()
    for item in data:
        # Soft delete the password after use
        if item["id"] == id:
            item["deletion_time"] = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')
    update_binary_database(data)

    return [item for item in data if item["deletion_time"] is None]


''' Detection Related Codes'''
def detect_knocks(audio_data, channel=0):
    signal = audio_data[:, channel]
    signal = signal / np.max(np.abs(signal))

    # Find peaks (knocks) that exceed the threshold
    peaks, _ = find_peaks(np.abs(signal), height=threshold, distance=int(min_knock_duration * fs))

    # Group continuous peaks into knocks
    knocks = []
    current_knock_start = None

    for i, peak in enumerate(peaks):
        if current_knock_start is None:
            current_knock_start = peak
            continue

        # If gap between peaks is too large, end current knock
        if (peak - peaks[i - 1]) > (min_silence * fs):
            knock_end = peaks[i - 1]
            duration = (knock_end - current_knock_start) / fs
            knocks.append((current_knock_start, knock_end, duration))
            current_knock_start = peak

    # Add the last knock if exists
    if current_knock_start is not None and len(peaks) > 0:
        knock_end = peaks[-1]
        duration = (knock_end - current_knock_start) / fs
        knocks.append((current_knock_start, knock_end, duration))

    return knocks


def decode_knocks(knocks):
    if len(knocks) < 2:
        return "", []

    binary_str = ""
    durations = []

    # Calculate silence durations between knocks
    for i in range(1, len(knocks)):
        silence_duration = (knocks[i][0] - knocks[i - 1][1]) / fs
        if silence_duration > bit_threshold:
            binary_str += "1"
        else:
            binary_str += "0"
        durations.append(silence_duration)

    return binary_str, durations


def plot_detection(signal, knocks, binary_str, channel=0):
    plt.figure(figsize=(15, 5))
    plt.plot(signal[:, channel], label='Audio Signal')

    # Mark all knocks
    for start, end, duration in knocks:
        plt.axvspan(start, end, color='green', alpha=0.3)

    # Mark the spaces between knocks with binary values
    if len(knocks) > 1:
        for i in range(1, len(knocks)):
            mid_point = (knocks[i][0] + knocks[i - 1][1]) // 2
            bit = binary_str[i - 1] if i - 1 < len(binary_str) else '?'
            plt.text(mid_point, 0.8, bit,
                     horizontalalignment='center', fontsize=10)

    plt.title(f"Binary Knock Detection (Channel {channel + 1})")
    plt.xlabel("Samples")
    plt.ylabel("Amplitude")
    plt.grid()
    plt.savefig(f"binary_detection_ch{channel + 1}.png")
    plt.close()


def check_binary_password(password, binary_str, item=None):
    if password in binary_str:
        if item:
            pass_info = {
                'id': item['id'],
                'name': item['name']
            }
            return True, pass_info
        return True, None
    else:
        return False, None


def audio_callback(indata, frames, time, status):
    """Callback function for real-time processing"""
    global recording, accu_frames

    # Store incoming audio
    end_idx = accu_frames + frames
    if end_idx > recording.shape[0]:
        new_size = max(end_idx, recording.shape[0] * 2)
        new_recording = np.zeros((new_size, recording.shape[1]))
        new_recording[:recording.shape[0]] = recording
        recording = new_recording

    recording[accu_frames:end_idx] = indata[:frames]
    accu_frames += frames


def record_audio(duration, channels=1, device=None):
    """Record audio for specified duration"""
    global recording, accu_frames
    recording = np.zeros((int(fs * duration * 1.5), channels))  # Buffer with 50% extra
    accu_frames = 0

    with sd.InputStream(device=device, channels=channels, samplerate=fs,
                        callback=audio_callback):
        print(f"Recording for {duration} seconds...")
        sd.sleep(int(duration * 1000))

    # Trim recording to actual length
    recording = recording[:accu_frames]
    return recording


def start_recording_knocks():
    current_time = datetime.datetime.now()
    valid_passwords = []
    password_items = {}  # To track password -> item mapping

    # Check if file exists
    if not os.path.exists('binary_password.json'):
        # Create the file with empty JSON object
        with open('binary_password.json', 'w') as f:
            json.dump({}, f)

    data = load_binary_database()

    for item in data:
        if item["deletion_time"] is None:
            # If it is not deleted, check whether it is expired
            if item["expiration_time"] is None:
                valid_passwords.append(item["password"])
                password_items[item["password"]] = item
            else:
                expiration_time = item["expiration_time"]
                if expiration_time > current_time.strftime("%Y-%m-%d %H:%M:%S"):
                    valid_passwords.append(item["password"])
                    password_items[item["password"]] = item

    if valid_passwords == []:
        password, knock_password = generate_binary_password()
        # print(f"\nKnock detection password: {knock_password}")
        valid_passwords.append(password)

    # Record audio
    audio_data = record_audio(duration=10, channels=1, device=None)

    # Detect knocks
    knocks = detect_knocks(audio_data, 0)

    # Decode to binary based on silence between knocks
    binary_str, durations = decode_knocks(knocks)

    unlock = False
    pass_info = None
    for password in valid_passwords:
        item = password_items.get(password)
        unlock, current_pass_info = check_binary_password(password, binary_str, item)
        if unlock:
            pass_info = current_pass_info
            data = load_binary_database()

            for item in data:
                # Delete the password after use
                if item["password"] == password:
                    item["deletion_time"] = current_time.strftime("%Y-%m-%d %H:%M:%S")

            break

    print(unlock)

    print(f"\nResults:")
    print(f"Detected {len(knocks)} knocks")
    print(f"Binary sequence: {binary_str}")
    print(f"Silence durations between knocks (seconds): {durations}")

    # Plot results
    # plot_detection(audio_data, knocks, binary_str, 0)
    # print(f"Detection plot saved to binary_detection_ch1.png")

    return unlock, pass_info

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Binary knock detection system.')
    parser.add_argument('--list-devices', action='store_true', help='List audio devices')
    parser.add_argument('--input-device', type=int_or_str, help='Input device ID')
    parser.add_argument('-c', '--channels', type=int, default=1, help='Number of channels')
    parser.add_argument('-t', '--threshold', type=float, default=0.5, help='Detection threshold (0-1)')
    parser.add_argument('-d', '--duration', type=float, default=10.0, help='Recording duration')
    parser.add_argument('-b', '--bit-threshold', type=float, default=0.6,
                        help='Silence duration threshold for 0/1 (seconds)')
    args = parser.parse_args()

    if args.list_devices:
        print(sd.query_devices())
        exit()

    # Update parameters from command line
    threshold = args.threshold
    bit_threshold = args.bit_threshold
    fs = 44100  # Fixed sample rate for consistent detection

    # Record audio
    audio_data = record_audio(args.duration, args.channels, args.input_device)

    # Process each channel
    for channel in range(audio_data.shape[1]):
        # Detect knocks
        knocks = detect_knocks(audio_data, channel)

        # Decode to binary based on silence between knocks
        binary_str, durations = decode_knocks(knocks)

        print(check_binary_password(password, binary_str))

        print(f"\nChannel {channel + 1} Results:")
        print(f"Detected {len(knocks)} knocks")
        print(f"Binary sequence: {binary_str}")
        print(f"Silence durations between knocks (seconds): {durations}")

        # Plot results
        plot_detection(audio_data, knocks, binary_str, channel)
        print(f"Detection plot saved to binary_detection_ch{channel + 1}.png")