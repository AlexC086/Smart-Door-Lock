# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from Knock_pattern.binary_code import load_binary_database, add_binary_password, edit_binary_password, delete_binary_password
from typing import Optional
from pydantic import BaseModel
import json
import datetime

app = FastAPI()

# Allow CORS for all origins (or specify the frontend URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can specify specific origins like ["http://localhost:3000"] for security
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)

class EditEntry(BaseModel):
    id: int
    name: str
    type: str
    expiration_time: str
    knock_password: Optional[str] = None
    password: Optional[str] = None
    method: str

class DeleteByID(BaseModel):
    id: int
    method: str

class LoadDB(BaseModel):
    method: str


@app.post("/update_database")
async def load_database(request: LoadDB):
    if request.method == "morse":
        data = load_binary_database()
        return [item for item in data if item["deletion_time"] is None]

    # Or you may update both DBs, up to you :)
    elif request.method == "qr":
        pass

@app.post("/add_entry")
async def add_entry(request: EditEntry):
    if request.method == "morse":
        return add_binary_password(request.id, request.name, request.expiration_time, request.knock_password, request.password)

    elif request.method == "qr":
        pass

@app.post("/edit_entry")
async def edit_entry(request: EditEntry):
    if request.method == "morse":
        return edit_binary_password(request.id, request.name, request.expiration_time, request.knock_password, request.password)
    elif request.method == "qr":
        pass

@app.post("/delete_entry")
async def delete_entry(request: DeleteByID):
    if request.method == "morse":
        return delete_binary_password(request.id)
    elif request.method == "qr":
        pass