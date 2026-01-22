from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'collaborative_todo')]

# Security settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
REFRESH_SECRET = os.environ.get('JWT_REFRESH_SECRET', 'your-refresh-secret-key')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Create the main app without a prefix
app = FastAPI(title="Collaborative Todo API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    id_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class User(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"  # low, medium, high
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # todo, in_progress, done
    priority: Optional[str] = None
    due_date: Optional[str] = None

class Task(BaseModel):
    id: str
    title: str
    description: str
    status: str
    priority: str
    due_date: Optional[str]
    user_id: str
    created_at: datetime
    updated_at: datetime

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "member"  # admin, member, viewer

class GroupTaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None

class GroupTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None


# ============== HELPERS ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, REFRESH_SECRET, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None or payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

def user_response(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "created_at": user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user["created_at"]
    }


# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "password_hash": get_password_hash(user_data.password),
        "picture": None,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    
    # Generate tokens
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response(user)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()})
    
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token({"sub": user["id"]})
    refresh_token = create_refresh_token({"sub": user["id"]})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response(user)
    )

@api_router.post("/auth/google", response_model=TokenResponse)
async def google_auth(auth_data: GoogleAuthRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth is not configured")
    
    # Verify the Google ID token
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.id_token}"
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            
            google_data = response.json()
            
            # Verify the audience matches our client ID
            if google_data.get("aud") != GOOGLE_CLIENT_ID:
                raise HTTPException(status_code=401, detail="Invalid token audience")
            
            email = google_data.get("email")
            name = google_data.get("name", email.split("@")[0])
            picture = google_data.get("picture")
            
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Failed to verify Google token")
    
    # Find or create user
    user = await db.users.find_one({"email": email.lower()})
    
    if user:
        # Update picture if available
        if picture and picture != user.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": picture}})
            user["picture"] = picture
    else:
        # Create new user
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": email.lower(),
            "name": name,
            "picture": picture,
            "password_hash": None,  # Google auth users don't have a password
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user)
    
    access_token = create_access_token({"sub": user["id"]})
    refresh_token = create_refresh_token({"sub": user["id"]})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response(user)
    )

@api_router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest):
    try:
        payload = jwt.decode(data.refresh_token, REFRESH_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    access_token = create_access_token({"sub": user_id})
    new_refresh_token = create_refresh_token({"sub": user_id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=user_response(user)
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_response(current_user)


# ============== TASKS ROUTES ==============

@api_router.get("/tasks")
async def get_tasks(current_user: dict = Depends(get_current_user)):
    tasks = await db.tasks.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(1000)
    return [{
        "id": t["id"],
        "title": t["title"],
        "description": t.get("description", ""),
        "status": t.get("status", "todo"),
        "priority": t.get("priority", "medium"),
        "due_date": t.get("due_date"),
        "user_id": t["user_id"],
        "created_at": t["created_at"].isoformat() if isinstance(t["created_at"], datetime) else t["created_at"],
        "updated_at": t["updated_at"].isoformat() if isinstance(t["updated_at"], datetime) else t["updated_at"]
    } for t in tasks]

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    task = {
        "id": task_id,
        "title": task_data.title,
        "description": task_data.description or "",
        "status": "todo",
        "priority": task_data.priority,
        "due_date": task_data.due_date,
        "user_id": current_user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.tasks.insert_one(task)
    
    return {
        "id": task["id"],
        "title": task["title"],
        "description": task["description"],
        "status": task["status"],
        "priority": task["priority"],
        "due_date": task["due_date"],
        "user_id": task["user_id"],
        "created_at": task["created_at"].isoformat(),
        "updated_at": task["updated_at"].isoformat()
    }

@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, updates: TaskUpdate, current_user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id, "user_id": current_user["id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    updated_task = await db.tasks.find_one({"id": task_id})
    return {
        "id": updated_task["id"],
        "title": updated_task["title"],
        "description": updated_task.get("description", ""),
        "status": updated_task.get("status", "todo"),
        "priority": updated_task.get("priority", "medium"),
        "due_date": updated_task.get("due_date"),
        "user_id": updated_task["user_id"],
        "created_at": updated_task["created_at"].isoformat() if isinstance(updated_task["created_at"], datetime) else updated_task["created_at"],
        "updated_at": updated_task["updated_at"].isoformat() if isinstance(updated_task["updated_at"], datetime) else updated_task["updated_at"]
    }

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.tasks.delete_one({"id": task_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}


# ============== GROUPS ROUTES ==============

@api_router.get("/groups")
async def get_groups(current_user: dict = Depends(get_current_user)):
    # Find groups where user is a member
    groups = await db.groups.find({
        "members.user_id": current_user["id"]
    }).sort("created_at", -1).to_list(1000)
    
    return [{
        "id": g["id"],
        "name": g["name"],
        "description": g.get("description", ""),
        "owner_id": g["owner_id"],
        "members": g["members"],
        "created_at": g["created_at"].isoformat() if isinstance(g["created_at"], datetime) else g["created_at"]
    } for g in groups]

@api_router.post("/groups")
async def create_group(group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    group_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    group = {
        "id": group_id,
        "name": group_data.name,
        "description": group_data.description or "",
        "owner_id": current_user["id"],
        "members": [{
            "user_id": current_user["id"],
            "user_name": current_user["name"],
            "user_email": current_user["email"],
            "role": "owner",
            "joined_at": now.isoformat()
        }],
        "created_at": now
    }
    
    await db.groups.insert_one(group)
    
    return {
        "id": group["id"],
        "name": group["name"],
        "description": group["description"],
        "owner_id": group["owner_id"],
        "members": group["members"],
        "created_at": group["created_at"].isoformat()
    }

@api_router.get("/groups/{group_id}")
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({
        "id": group_id,
        "members.user_id": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {
        "id": group["id"],
        "name": group["name"],
        "description": group.get("description", ""),
        "owner_id": group["owner_id"],
        "members": group["members"],
        "created_at": group["created_at"].isoformat() if isinstance(group["created_at"], datetime) else group["created_at"]
    }

@api_router.patch("/groups/{group_id}")
async def update_group(group_id: str, updates: GroupUpdate, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is owner or admin
    member = next((m for m in group["members"] if m["user_id"] == current_user["id"]), None)
    if not member or member["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to update group")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if update_data:
        await db.groups.update_one({"id": group_id}, {"$set": update_data})
    
    updated_group = await db.groups.find_one({"id": group_id})
    return {
        "id": updated_group["id"],
        "name": updated_group["name"],
        "description": updated_group.get("description", ""),
        "owner_id": updated_group["owner_id"],
        "members": updated_group["members"],
        "created_at": updated_group["created_at"].isoformat() if isinstance(updated_group["created_at"], datetime) else updated_group["created_at"]
    }

@api_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Only owner can delete
    if group["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete this group")
    
    # Delete all group tasks
    await db.group_tasks.delete_many({"group_id": group_id})
    
    # Delete group
    await db.groups.delete_one({"id": group_id})
    
    return {"message": "Group deleted"}

@api_router.post("/groups/{group_id}/invite")
async def invite_member(group_id: str, invite: InviteMemberRequest, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is owner or admin
    member = next((m for m in group["members"] if m["user_id"] == current_user["id"]), None)
    if not member or member["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")
    
    # Find user to invite
    invitee = await db.users.find_one({"email": invite.email.lower()})
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found. They need to register first.")
    
    # Check if already a member
    if any(m["user_id"] == invitee["id"] for m in group["members"]):
        raise HTTPException(status_code=400, detail="User is already a member of this group")
    
    # Add member
    new_member = {
        "user_id": invitee["id"],
        "user_name": invitee["name"],
        "user_email": invitee["email"],
        "role": invite.role,
        "joined_at": datetime.utcnow().isoformat()
    }
    
    await db.groups.update_one(
        {"id": group_id},
        {"$push": {"members": new_member}}
    )
    
    updated_group = await db.groups.find_one({"id": group_id})
    return {
        "id": updated_group["id"],
        "name": updated_group["name"],
        "description": updated_group.get("description", ""),
        "owner_id": updated_group["owner_id"],
        "members": updated_group["members"],
        "created_at": updated_group["created_at"].isoformat() if isinstance(updated_group["created_at"], datetime) else updated_group["created_at"]
    }

@api_router.delete("/groups/{group_id}/members/{member_id}")
async def remove_member(group_id: str, member_id: str, current_user: dict = Depends(get_current_user)):
    group = await db.groups.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check permissions
    current_member = next((m for m in group["members"] if m["user_id"] == current_user["id"]), None)
    target_member = next((m for m in group["members"] if m["user_id"] == member_id), None)
    
    if not current_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Can't remove owner
    if target_member["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the group owner")
    
    # Only owner/admin can remove others, but anyone can remove themselves
    if member_id != current_user["id"]:
        if current_member["role"] not in ["owner", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    # Remove member
    await db.groups.update_one(
        {"id": group_id},
        {"$pull": {"members": {"user_id": member_id}}}
    )
    
    return {"message": "Member removed"}


# ============== GROUP TASKS ROUTES ==============

@api_router.get("/groups/{group_id}/tasks")
async def get_group_tasks(group_id: str, current_user: dict = Depends(get_current_user)):
    # Verify membership
    group = await db.groups.find_one({
        "id": group_id,
        "members.user_id": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found or access denied")
    
    tasks = await db.group_tasks.find({"group_id": group_id}).sort("created_at", -1).to_list(1000)
    
    return [{
        "id": t["id"],
        "title": t["title"],
        "description": t.get("description", ""),
        "status": t.get("status", "todo"),
        "priority": t.get("priority", "medium"),
        "due_date": t.get("due_date"),
        "group_id": t["group_id"],
        "created_by": t["created_by"],
        "assigned_to": t.get("assigned_to"),
        "assigned_to_name": t.get("assigned_to_name"),
        "created_at": t["created_at"].isoformat() if isinstance(t["created_at"], datetime) else t["created_at"],
        "updated_at": t["updated_at"].isoformat() if isinstance(t["updated_at"], datetime) else t["updated_at"]
    } for t in tasks]

@api_router.post("/groups/{group_id}/tasks")
async def create_group_task(group_id: str, task_data: GroupTaskCreate, current_user: dict = Depends(get_current_user)):
    # Verify membership and role
    group = await db.groups.find_one({
        "id": group_id,
        "members.user_id": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found or access denied")
    
    member = next((m for m in group["members"] if m["user_id"] == current_user["id"]), None)
    if member["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create tasks")
    
    # Get assigned user name if assigned
    assigned_to_name = None
    if task_data.assigned_to:
        assigned_member = next((m for m in group["members"] if m["user_id"] == task_data.assigned_to), None)
        if assigned_member:
            assigned_to_name = assigned_member["user_name"]
    
    task_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    task = {
        "id": task_id,
        "title": task_data.title,
        "description": task_data.description or "",
        "status": "todo",
        "priority": task_data.priority,
        "due_date": task_data.due_date,
        "group_id": group_id,
        "created_by": current_user["id"],
        "assigned_to": task_data.assigned_to,
        "assigned_to_name": assigned_to_name,
        "created_at": now,
        "updated_at": now
    }
    
    await db.group_tasks.insert_one(task)
    
    return {
        "id": task["id"],
        "title": task["title"],
        "description": task["description"],
        "status": task["status"],
        "priority": task["priority"],
        "due_date": task["due_date"],
        "group_id": task["group_id"],
        "created_by": task["created_by"],
        "assigned_to": task["assigned_to"],
        "assigned_to_name": task["assigned_to_name"],
        "created_at": task["created_at"].isoformat(),
        "updated_at": task["updated_at"].isoformat()
    }

@api_router.patch("/groups/{group_id}/tasks/{task_id}")
async def update_group_task(group_id: str, task_id: str, updates: GroupTaskUpdate, current_user: dict = Depends(get_current_user)):
    # Verify membership
    group = await db.groups.find_one({
        "id": group_id,
        "members.user_id": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found or access denied")
    
    member = next((m for m in group["members"] if m["user_id"] == current_user["id"]), None)
    if member["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update tasks")
    
    task = await db.group_tasks.find_one({"id": task_id, "group_id": group_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    # Update assigned_to_name if assigned_to changes
    if "assigned_to" in update_data:
        if update_data["assigned_to"]:
            assigned_member = next((m for m in group["members"] if m["user_id"] == update_data["assigned_to"]), None)
            update_data["assigned_to_name"] = assigned_member["user_name"] if assigned_member else None
        else:
            update_data["assigned_to_name"] = None
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.group_tasks.update_one({"id": task_id}, {"$set": update_data})
    
    updated_task = await db.group_tasks.find_one({"id": task_id})
    return {
        "id": updated_task["id"],
        "title": updated_task["title"],
        "description": updated_task.get("description", ""),
        "status": updated_task.get("status", "todo"),
        "priority": updated_task.get("priority", "medium"),
        "due_date": updated_task.get("due_date"),
        "group_id": updated_task["group_id"],
        "created_by": updated_task["created_by"],
        "assigned_to": updated_task.get("assigned_to"),
        "assigned_to_name": updated_task.get("assigned_to_name"),
        "created_at": updated_task["created_at"].isoformat() if isinstance(updated_task["created_at"], datetime) else updated_task["created_at"],
        "updated_at": updated_task["updated_at"].isoformat() if isinstance(updated_task["updated_at"], datetime) else updated_task["updated_at"]
    }

@api_router.delete("/groups/{group_id}/tasks/{task_id}")
async def delete_group_task(group_id: str, task_id: str, current_user: dict = Depends(get_current_user)):
    # Verify membership
    group = await db.groups.find_one({
        "id": group_id,
        "members.user_id": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found or access denied")
    
    member = next((m for m in group["members"] if m["user_id"] == current_user["id"]), None)
    if member["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only admins and owners can delete tasks")
    
    result = await db.group_tasks.delete_one({"id": task_id, "group_id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted"}


# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Collaborative Todo API", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
