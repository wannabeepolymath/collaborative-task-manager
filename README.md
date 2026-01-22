# TeamTasks - Collaborative Todo App

A task management app that lets you keep track of personal todos and collaborate with others on shared tasks. Built with React Native (Expo) for the frontend and FastAPI for the backend.

## Features

- **Email/Password Authentication** - Register and login with email and password
- **Google Sign-In** (Optional) - Sign in with Google account
- **Personal Tasks** - Create, edit, delete your own todos with status and priority
- **Groups** - Create groups and invite others via email
- **Collaborative Tasks** - Group tasks that everyone can see and manage
- **Task Assignment** - Assign tasks to specific group members
- **Role-based Access** - Owner, Admin, Member, Viewer roles with different permissions
- **Real-time Status** - Track tasks from "todo" to "in progress" to "done"

## Tech Stack

- **Frontend:** React Native (Expo), TypeScript, Zustand, Axios
- **Backend:** FastAPI, Motor (async MongoDB), JWT Authentication
- **Database:** MongoDB

## Project Structure

```
├── backend/           # FastAPI API server
│   ├── server.py      # Main API with all routes
│   ├── requirements.txt
│   └── .env           # Backend environment variables
├── frontend/          # React Native (Expo) app
│   ├── app/           # Expo Router screens
│   ├── src/           # Components, stores, API client
│   └── .env           # Frontend environment variables
├── Dockerfile         # Production Docker image
├── docker-compose.yml # Docker Compose for easy deployment
├── nginx.conf         # Nginx configuration
└── supervisord.conf   # Process manager configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB (local or cloud)
- Expo Go app (for mobile testing)

### Local Development

1. **Clone and install dependencies**

   ```bash
   # Backend
   cd backend
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt

   # Frontend
   cd ../frontend
   yarn install
   ```

2. **Configure environment variables**

   Backend (`backend/.env`):
   ```env
   MONGO_URL="mongodb://localhost:27017"
   DB_NAME="collaborative_todo"
   JWT_SECRET="your-secret-key-change-in-production"
   JWT_REFRESH_SECRET="your-refresh-secret-key"
   # Optional: Google OAuth
   GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
   ```

   Frontend (`frontend/.env`):
   ```env
   EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
   # Optional: Google OAuth Client IDs
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-android-client-id
   ```

3. **Start MongoDB**

   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:7
   
   # Or use your local MongoDB installation
   ```

4. **Run the application**

   ```bash
   # Terminal 1: Backend
   cd backend
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload

   # Terminal 2: Frontend
   cd frontend
   yarn start
   ```

5. **Access the app**
   - Web: Open http://localhost:3000
   - Mobile: Scan QR code with Expo Go app

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t teamtasks .
docker run -d -p 80:80 -p 8001:8001 \
  -e MONGO_URL=mongodb://your-mongo-host:27017 \
  -e JWT_SECRET=your-secret \
  teamtasks
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Login with Google ID token
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### Tasks (Personal)
- `GET /api/tasks` - List user's tasks
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Groups
- `GET /api/groups` - List user's groups
- `POST /api/groups` - Create new group
- `GET /api/groups/:id` - Get group details
- `PATCH /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/invite` - Invite member
- `DELETE /api/groups/:id/members/:memberId` - Remove member

### Group Tasks
- `GET /api/groups/:id/tasks` - List group tasks
- `POST /api/groups/:id/tasks` - Create group task
- `PATCH /api/groups/:id/tasks/:taskId` - Update group task
- `DELETE /api/groups/:id/tasks/:taskId` - Delete group task

## Role Permissions

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View tasks | ✓ | ✓ | ✓ | ✓ |
| Create tasks | ✓ | ✓ | ✓ | ✗ |
| Update tasks | ✓ | ✓ | ✓ | ✗ |
| Delete tasks | ✓ | ✓ | ✗ | ✗ |
| Invite members | ✓ | ✓ | ✗ | ✗ |
| Remove members | ✓ | ✓ | ✗ | ✗ |
| Edit group | ✓ | ✓ | ✗ | ✗ |
| Delete group | ✓ | ✗ | ✗ | ✗ |

## Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
5. Create clients for:
   - Web application
   - iOS (if building for iOS)
   - Android (if building for Android)
6. Add the client IDs to your `.env` files

## Environment Variables

### Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret for JWT access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret for JWT refresh tokens |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |

### Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_BACKEND_URL` | Yes | Backend API URL |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID_*` | No | Google OAuth client IDs |

## License

MIT
