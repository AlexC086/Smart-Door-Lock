import numpy as np
import sounddevice as sd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
import argparse
import random
from binary_code import generate_binary_password, detect_binary_knocks, decode_knocks, plot_detection, check_binary_password

# Global variables
recording = None
fs = 44100  # Sample rate
threshold = 0.5  # Amplitude threshold for detection
min_silence = 0.1  # Minimum silence duration between knocks (seconds)
min_knock_duration = 0.05  # Minimum knock duration (seconds)
bit_threshold = 0.8  # Silence duration threshold for 0/1 (seconds)


def int_or_str(text):
    """Helper function for argument parsing."""
    try:
        return int(text)
    except ValueError:
        return text


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


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Binary knock detection system.')
    parser.add_argument('--list-devices', action='store_true', help='List audio devices')
    parser.add_argument('--input-device', type=int_or_str, help='Input device ID')
    parser.add_argument('-c', '--channels', type=int, default=1, help='Number of channels')
    parser.add_argument('-t', '--threshold', type=float, default=0.5, help='Detection threshold (0-1)')
    parser.add_argument('-d', '--duration', type=float, default=5.0, help='Recording duration')
    args = parser.parse_args()

    if args.list_devices:
        print(sd.query_devices())
        exit()

    password, knock_password = generate_binary_password()
    print(f"\nKnock detection password: {knock_password}")

    # Update parameters from command line
    threshold = args.threshold
    fs = 44100  # Fixed sample rate for consistent detection

    # Record audio
    audio_data = record_audio(args.duration, args.channels, args.input_device)

    # Process each channel
    for channel in range(audio_data.shape[1]):
        # Detect knocks
        knocks = detect_binary_knocks(audio_data, channel)

        # Decode to binary
        binary_str, durations = decode_knocks(knocks)

        print(check_binary_password(password, binary_str))

        print(f"\nChannel {channel+1} Results:")
        print(f"Detected {len(knocks)} knocks")
        print(f"Binary sequence: {binary_str}")
        print(f"Durations (seconds): {durations}")

        # Plot results
        plot_detection(audio_data, knocks, channel)
        print(f"Detection plot saved to binary_detection_ch{channel+1}.png")