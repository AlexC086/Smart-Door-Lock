from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from picamera import PiCamera
import io
import threading
import queue
from time import sleep

app = FastAPI()

# Global variables
output_queue = queue.Queue(maxsize=1)
camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 30
sleep(2)  # Allow camera to warm up

def capture_frames():
    while True:
        stream = io.BytesIO()
        camera.capture(stream, format='jpeg', use_video_port=True)
        # Keep only the most recent frame
        try:
            output_queue.get_nowait()
        except queue.Empty:
            pass
        output_queue.put(stream.getvalue())
        stream.seek(0)
        stream.truncate()

# Start the capture thread
capture_thread = threading.Thread(target=capture_frames, daemon=True)
capture_thread.start()

def generate_frames():
    while True:
        frame = output_queue.get()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.get('/video_feed')
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8080)