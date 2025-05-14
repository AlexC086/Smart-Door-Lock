from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import picamera
import picamera.array
import cv2
import io

app = FastAPI()

# Initialize the camera
camera = picamera.PiCamera()
camera.resolution = (640, 480)
camera.framerate = 24

def generate_frames():
    stream = io.BytesIO()
    for _ in camera.capture_continuous(stream, 'jpeg', use_video_port=True):
        # Rewind the stream and read the frame
        stream.seek(0)
        frame = stream.read()
        
        # Clear the stream for the next frame
        stream.seek(0)
        stream.truncate()
        
        # Yield the frame in the multipart format
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
    uvicorn.run(app, host='0.0.0.0', port=5000)