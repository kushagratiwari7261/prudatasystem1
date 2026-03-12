# Zenwair Clothing 

Welcome to the Zenwair Clothing project! This repository contains a full-stack e-commerce application with a React frontend, a React Admin dashboard, and a Node.js/Express backend running with PostgreSQL and Elasticsearch via Docker.

## Project Structure
- **/frontend**: Customer-facing shopping interface (React)
- **/admin**: Administrative dashboard to manage products/orders (React)
- **/backend**: API Server & Database configuration (Node.js/Express)
- **/infra**: Reverse proxy configurations (Nginx)

## Getting Started

Follow these instructions to get the project running locally.

### Prerequisites
You need the following installed on your machine:
- **Node.js** (v18+)
- **NPM** (Node Package Manager)
- **Docker Desktop** (Required for the Database, Redis, and Elasticsearch containers)

---

### Step 1: Install Dependencies
Because this is a multi-repo style project, you need to navigate to each directory and install the required npm packages.

Open your terminal and run:

```bash
# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install

# Install Admin Dependencies
cd ../admin
npm install
```

---

### Step 2: Environment Variables
The application relies on private API keys and database credentials that are ignored by Git. You must create `.env` files in each sub-directory before running the app. 

1. Create `backend/.env` with the backend variables (e.g. database host, razorpay keys, Google Auth keys).
2. Create `frontend/.env` with `REACT_APP_API_URL=http://localhost:5000/api/v1`
3. Create `admin/.env` with `REACT_APP_API_URL=http://localhost:5000/api/v1` and `REACT_APP_ADMIN_MODE=true`

*(Ask the repository owner for the complete list of keys required to run the development environment!)*

---

### Step 3: Run the Services
This project uses Docker Compose to automatically spin up a PostgreSQL Database, an Elasticsearch instance, a Redis cache, and an Nginx proxy.

Run this command from the **root directory**:

```bash
docker-compose up -d postgres redis elasticsearch
```
*(Wait 1-2 minutes for the databases to spin up completely).*

---

### Step 4: Start the Servers
You will need to open 3 separate terminals to run each service simultaneously.

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```
*(This starts the API on port 5000)*

**Terminal 2 (Frontend Shop):**
```bash
cd frontend
npm start
```
*(This starts the shop on port 3005)*

**Terminal 3 (Admin Dashboard):**
```bash
cd admin
npm start
```
*(This starts the admin panel on port 3001)*

---

### You're all set! 
You can now visit your local customer frontend at `http://localhost:3005` and your admin panel at `http://localhost:3001`.
