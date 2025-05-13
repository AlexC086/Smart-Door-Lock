# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from binary_code import generate_binary_password

app = FastAPI()

# Allow CORS for all origins (or specify the frontend URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can specify specific origins like ["http://localhost:3000"] for security
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)

@app.post("/generate_binary_password")
async def generate_binary_code():
    try:
        password, knock_password = generate_binary_password()
        return {"password": password, "knock_password": knock_password}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))