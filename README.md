# RAG Application

A simple RAG (Retrieval-Augmented Generation) web application with React frontend, Node.js backend, and Python API.

## Setup

1. Install PostgreSQL and create a database:
   ```
   createdb ragdb
   ```
   Ensure the user is `postgres` with password `password` (update in `api/api.py` if needed).

2. Install Python dependencies:
   ```
   cd api
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies for backend:
   ```
   cd backend
   npm install
   ```

4. Build the React frontend:
   ```
   cd frontend
   npm install
   npm run build
   ```

## Running

1. Start the Python API:
   ```
   cd api
   python api.py
   ```

2. Start the Node.js backend:
   ```
   cd backend
   npm start
   ```

3. Open http://localhost:3001 in your browser.

## Usage

- Choose Topic, URL, or PDF.
- Enter the data and submit.
- Chat with the AI, see answers and chunks used.

## Debugging

If you get errors:
- Check PostgreSQL is running and DB exists.
- Ensure all dependencies are installed.
- Check terminal outputs for error messages.
- Open browser dev tools (F12) > Network tab to see API call failures.