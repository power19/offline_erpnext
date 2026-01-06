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

### Linux/macOS

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

### Windows

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

### Running Both Together (Windows)

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

Create a `.env` file in the backend directory:
```env
ERPNEXT_URL=https://your-erpnext-instance.com
ERPNEXT_API_KEY=your-api-key
ERPNEXT_API_SECRET=your-api-secret
```

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for Swagger UI documentation.

## License

MIT
