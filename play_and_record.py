import numpy as np
import sounddevice as sd

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