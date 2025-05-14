from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from picamera import PiCamera
import io
import threading
import queue
from time import sleep
import cv2
import numpy as np
from PIL import Image

app = FastAPI()

# Global variables
output_queue = queue.Queue(maxsize=1)
camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 30
sleep(2)  # Allow camera to warm up

# Load pre-trained MobileNet SSD model for object detection
net = cv2.dnn.readNetFromCaffe(
    "MobileNet-SSD/deploy.prototxt",
    "MobileNet-SSD/mobilenet_iter_73000.caffemodel"
)
CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat",
           "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
           "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
           "sofa", "train", "tvmonitor"]
COLORS = np.random.uniform(0, 255, size=(len(CLASSES), 3))

def detect_objects(frame):
    # Convert to blob for DNN
    (h, w) = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5)
    
    # Pass blob through network and get detections
    net.setInput(blob)
    detections = net.forward()
    
    # Process detections
    for i in np.arange(0, detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        
        if confidence > 0.5:  # Filter weak detections
            idx = int(detections[0, 0, i, 1])
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            (startX, startY, endX, endY) = box.astype("int")
            
            # Draw bounding box and label
            label = f"{CLASSES[idx]}: {confidence*100:.2f}%"
            cv2.rectangle(frame, (startX, startY), (endX, endY), COLORS[idx], 2)
            y = startY - 15 if startY - 15 > 15 else startY + 15
            cv2.putText(frame, label, (startX, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLORS[idx], 2)
    
    return frame

def capture_frames():
    while True:
        stream = io.BytesIO()
        camera.capture(stream, format='jpeg', use_video_port=True)
        stream.seek(0)
        
        # Convert to numpy array for processing
        image = Image.open(stream)
        frame = np.array(image)
        
        # Perform object detection
        frame = detect_objects(frame)
        
        # Convert back to bytes
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        # Keep only the most recent frame
        try:
            output_queue.get_nowait()
        except queue.Empty:
            pass
        output_queue.put(frame_bytes)
        
        stream.close()

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
    uvicorn.run(app, host='0.0.0.0', port=8081)