# main.py
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from Knock_pattern.binary_code import load_binary_database, add_binary_password, edit_binary_password, delete_binary_password
from QR_code.qr_code_livestream import load_database as load_qr_database, create_qr_code, edit_qr_code, delete_qr_code, get_qr_code_path
from open_door import load_log
from typing import Optional, List
from pydantic import BaseModel
import json
import datetime
import os

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

    elif request.method == "qr":
        data = load_qr_database()
        return [item for item in data if item["deletion_time"] is None]

@app.post("/add_entry")
async def add_entry(request: EditEntry):
    if request.method == "morse":
        return add_binary_password(request.id, request.name, request.expiration_time, request.knock_password, request.password)

    elif request.method == "qr":
        return create_qr_code(request.id, request.name, request.expiration_time, request.type)

@app.post("/edit_entry")
async def edit_entry(request: EditEntry):
    if request.method == "morse":
        return edit_binary_password(request.id, request.name, request.expiration_time, request.knock_password, request.password)
    elif request.method == "qr":
        # Only pass non-null values
        name = request.name
        expiration_time = request.expiration_time
        type = request.type if request.type in ["one-time", "multiple-pass"] else None
        return edit_qr_code(request.id, name, expiration_time, type)

@app.post("/delete_entry")
async def delete_entry(request: DeleteByID):
    if request.method == "morse":
        return delete_binary_password(request.id)
    elif request.method == "qr":
        success = delete_qr_code(request.id)
        if not success:
            raise HTTPException(status_code=404, detail=f"QR code with ID {request.id} not found")
        return {"status": "deleted"}
        
@app.get("/qr_code/{qr_id}")
async def get_qr_code(qr_id: int):
    """Serve the QR code image"""
    qr_path = get_qr_code_path(qr_id)
    if not qr_path or not os.path.exists(qr_path):
        raise HTTPException(status_code=404, detail=f"QR code image for ID {qr_id} not found")
    
    return FileResponse(qr_path)

@app.get("/update_action")
async def load_action():
    return load_action()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)