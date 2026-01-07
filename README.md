# Offline POS System for ERPNext

A Progressive Web Application (PWA) for offline Point of Sale operations that syncs with ERPNext.

## Features

- **Offline-First**: Works without internet connection using IndexedDB
- **POS Invoices**: Create and manage sales invoices
- **Easy Returns**: Simplified return process with search and quick refund
- **Inventory Management**:
  - Check stock levels across warehouses
  - Add stock to inventory
  - Transfer stock between warehouses
- **Flexible Discounts**: Apply percentage or fixed amount discounts
- **Auto-Sync**: Automatic synchronization with ERPNext when online

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React PWA)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   POS UI    │  │  Inventory  │  │   Returns Module    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │  IndexedDB  │                          │
│                    │   (Dexie)   │                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼─────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │   Sync Layer  │
                    └───────┬───────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  API Routes │  │ ERPNext SDK │  │   Sync Service      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │    ERPNext    │
                    │   Database    │
                    └───────────────┘
```

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Dexie.js for IndexedDB
- React Query for data fetching
- PWA with service worker

### Backend
- Python 3.11+
- FastAPI
- FrappeClient for ERPNext integration
- SQLite for local caching (optional)

## Quick Start

### Docker (Recommended)

The easiest way to run the application:

```bash
# Clone and navigate to the project
cd offline_erpnext

# Copy environment file and customize if needed
cp .env.docker.example .env

# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

**Stop the containers:**
```bash
docker-compose down
```

**Rebuild after code changes:**
```bash
docker-compose up -d --build
```

### Custom Ports

You can change the ports in your `.env` file:
```env
FRONTEND_PORT=8080
BACKEND_PORT=9000
```

---

### Manual Installation

#### Linux/macOS

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configure your ERPNext credentials
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

#### Windows

**Backend (Command Prompt):**
```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

**Backend (PowerShell):**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

**Frontend:**
```cmd
cd frontend
npm install
npm run dev
```

#### Running Both Together (Windows)

Open two terminals:

**Terminal 1 - Backend:**
```cmd
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```cmd
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

## Configuration

ERPNext connection is configured through the **web interface** when you first open the app:

1. Open the app at http://localhost:3000 (or http://localhost:5173 for dev)
2. Click **"Setup Connection"**
3. Enter your ERPNext URL (e.g., `https://your-erpnext.com`)
4. Enter API Key and API Secret (generate from ERPNext User settings)
5. Click **"Test & Connect"**

### Getting ERPNext API Credentials

1. Log into ERPNext as Administrator
2. Go to **User** → your user → **API Access**
3. Click **Generate Keys**
4. Copy the API Key and API Secret

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for Swagger UI documentation.

## License

MIT
