# Local Development Setup

## Fixed Issues ✅
- Added proxy configuration to Vite to forward `/api` requests to `localhost:4100`
- Added `http://localhost:5173` to CORS allowed origins in server
- Created `.env.example` with required environment variables

## Setup Instructions

### 1. Configure Environment Variables
Copy the example environment file and fill in your values:
```bash
cd server
cp .env.example .env
```

**Required variables to update:**
- `DATABASE_URL`: Your live database connection string
- `JWT_SECRET`: Generate a long random string (use: `openssl rand -base64 32`)
- `OPENAI_API_KEY`: Your OpenAI API key
- `MESSAGE_ENCRYPTION_KEY`: Generate a 32+ character random string

### 2. Install Dependencies
```bash
# Frontend dependencies (root directory)
npm install

# Server dependencies (server directory)
cd server
npm install
```

### 3. Start Development Servers

**Option A: Start both servers separately**
```bash
# Terminal 1 - Start backend server
cd server
npm run dev

# Terminal 2 - Start frontend server  
cd ..
npm run dev
```

**Option B: Start with concurrent (if installed)**
```bash
# Install concurrently if not already installed
npm install -g concurrently

# Start both servers
concurrently "npm run dev" "cd server && npm run dev"
```

### 4. Access Your Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:4100
- Health check: http://localhost:4100/api/health

## Testing Authentication
Once both servers are running:
1. Open http://localhost:5173 in your browser
2. Try to register a new account
3. The request should now successfully reach `http://localhost:4100/api/auth/register`

## Troubleshooting
- **404 errors**: Make sure both servers are running
- **CORS errors**: Verify `http://localhost:5173` is in allowed origins
- **Database errors**: Check your `DATABASE_URL` in the server `.env` file
- **JWT errors**: Ensure `JWT_SECRET` is set in server `.env` file
