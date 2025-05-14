from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from picamera import PiCamera
from picamera.array import PiRGBArray
import cv2
import time
import io

app = FastAPI()

# Initialize camera
camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 24
raw_capture = PiRGBArray(camera, size=(640, 480))
time.sleep(0.1)  # Let the camera warm up

def generate_frames():
    for frame in camera.capture_continuous(raw_capture, format="bgr", use_video_port=True):
        image = frame.array
        ret, buffer = cv2.imencode('.jpg', image)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        raw_capture.truncate(0)  # Clear the stream for next frame

@app.get('/video_feed')
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5000)