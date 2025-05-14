# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from Knock_pattern.binary_code import load_binary_database, add_binary_password, edit_binary_password, delete_binary_password
from pydantic import BaseModel

app = FastAPI()

# Allow CORS for all origins (or specify the frontend URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can specify specific origins like ["http://localhost:3000"] for security
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)

class EditMorseEntry(BaseModel):
    id: int
    name: str
    expiration_time: str
    knock_password: str
    password: str

class DeleteByID(BaseModel):
    id: int




''' Morse Code Related APIs '''
@app.post("/get_morse_database")
async def get_morse_database():
    data = load_binary_database()
    return [item for item in data if item["deletion_time"] is None]

@app.post("/add_morse_code")
async def add_morse_code(request: EditMorseEntry):
    return add_binary_password(request.id, request.name, request.expiration_time, request.knock_password, request.password)

@app.post("/edit_morse_code")
async def edit_morse_code(request: EditMorseEntry):
    return edit_binary_password(request.id, request.name, request.expiration_time, request.knock_password, request.password)

@app.post("/delete_morse_code")
async def delete_morse_code(request: DeleteByID):
    return delete_binary_password(request.id)