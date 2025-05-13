import cv2
from pyzbar import pyzbar
from picamera.array import PiRGBArray
from picamera import PiCamera
import time

# Initialize camera
camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 24
rawCapture = PiRGBArray(camera, size=(640, 480))

time.sleep(0.1)  # Allow camera to warm up

print("Press Ctrl+C to exit.")
try:
    for frame in camera.capture_continuous(rawCapture, format="bgr", use_video_port=True):
        image = frame.array

        # Detect QR codes in the frame
        decoded_objs = pyzbar.decode(image)
        for obj in decoded_objs:
            # Draw rectangle around QR code
            (x, y, w, h) = obj.rect
            cv2.rectangle(image, (x, y), (x + w, y + h), (0, 255, 0), 2)
            # Print QR code data
            print("QR Code:", obj.data.decode('utf-8'))

        # Display the image
        cv2.imshow("QR Code Scanner", image)
        key = cv2.waitKey(1) & 0xFF

        # Clear the stream for next frame
        rawCapture.truncate(0)

        if key == ord("q"):
            break
finally:
    cv2.destroyAllWindows()
    camera.close()