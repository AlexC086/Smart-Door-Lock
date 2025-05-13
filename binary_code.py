import datetime
import json
import os
import numpy as np
import sounddevice as sd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
import argparse
import random
from play_and_record import int_or_str, audio_callback, record_audio


# Global variables
recording = None
fs = 44100  # Sample rate
threshold = 0.5  # Amplitude threshold for detection
min_silence = 0.1  # Minimum silence duration between knocks (seconds)
min_knock_duration = 0.05  # Minimum knock duration (seconds)
bit_threshold = 0.6  # Silence duration threshold for 0/1 (seconds)


def generate_binary_password(filename="binary_password.json"):
    random_number = random.randint(0, 63)
    password = f"{random_number:06b}"  # 6-bit binary string
    knock_password = password.replace('0', '. ').replace('1', '. _ ') + "."
    current_time = datetime.datetime.now()
    current_id = 1

    # Load existing data (if file exists)
    existing_data = []
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            existing_data = json.load(f)
        if existing_data:
            current_id = existing_data[-1].get('id') + 1


    data = {
        "id": current_id,
        "password": password,
        "knock_password": knock_password,
        "creation_time": current_time.strftime("%Y-%m-%d %H:%M:%S"),
        "expiration_time": None,
        "deletion_time": None,
    }

    # Append new password
    existing_data.append(data)

    # Write back to file
    with open(filename, 'w') as f:
        json.dump(existing_data, f, indent=2)

    return password, knock_password


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


def check_binary_password(password, binary_str):
    if password in binary_str:
        return True
    else:
        return False


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
    with open('binary_password.json') as f:
        data = json.load(f)

    for item in data:
        if item["expiration_time"] is None:
            valid_passwords.append(item["password"])
        else:
            expiration_time = item["expiration_time"]
            if expiration_time > current_time.strftime("%Y-%m-%d %H:%M:%S"):
                valid_passwords.append(item["password"])

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
    for password in valid_passwords:
        unlock = check_binary_password(password, binary_str)
        if unlock:
            with open('binary_password.json') as f:
                data = json.load(f)

            for item in data:
                # Make the password expire after use
                if item["password"] == password:
                    item["expiration_time"] = current_time.strftime("%Y-%m-%d %H:%M:%S")
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

    return unlock

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

    password, knock_password = generate_binary_password()
    print(f"\nKnock detection password: {knock_password}")

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