from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse
from picamera import PiCamera
import cv2
import io
import numpy as np
from time import sleep

app = FastAPI()

camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 30
sleep(2)  # Allow camera to warm up

def generate_frames():
    while True:
        # Create an in-memory stream
        stream = io.BytesIO()
        camera.capture(stream, format='jpeg', use_video_port=True)
        stream.seek(0)
        
        # Convert the stream to bytes
        frame_bytes = stream.read()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.get('/video_feed')
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8080)