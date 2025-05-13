import random
import datetime
import json
import os
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks

# Global variables
recording = None
fs = 44100  # Sample rate
threshold = 0.5  # Amplitude threshold for detection
min_silence = 0.1  # Minimum silence duration between knocks (seconds)
min_knock_duration = 0.05  # Minimum knock duration (seconds)
bit_threshold = 0.8  # Silence duration threshold for 0/1 (seconds)


def generate_binary_password(filename="binary_password.json"):
    random_number = random.randint(0, 63)
    password = f"{random_number:06b}"  # 6-bit binary string
    knock_password = password.replace('0', '.').replace('1', '_') + "."
    current_time = datetime.datetime.now()

    data = {
        "password": password,
        "knock_password": knock_password,
        "creation_time": current_time.strftime("%Y-%m-%d %H:%M:%S"),
        "expiration_time": None
    }

    # Load existing data (if file exists)
    existing_data = []
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            existing_data = json.load(f)

    # Append new password
    existing_data.append(data)

    # Write back to file
    with open(filename, 'w') as f:
        json.dump(existing_data, f, indent=2)

    return password, knock_password


def detect_binary_knocks(audio_data, channel=0):
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


if __name__ == '__main__':
    password, knock_password = generate_binary_password()
    print(f"\nKnock detection password: {knock_password}")
    binary_str = "00110100"
    print(check_binary_password(password, binary_str))