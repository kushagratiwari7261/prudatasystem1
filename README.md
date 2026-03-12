# Zenwair Clothing 

Welcome to the Zenwair Clothing project! This repository contains a full-stack e-commerce application with a React frontend, a React Admin dashboard, and a Node.js/Express backend running with PostgreSQL and Elasticsearch via Docker.

## Project Structure
- **/frontend**: Customer-facing shopping interface (React, runs on Port `3005`)
- **/admin**: Administrative dashboard to manage products/orders (React, runs on Port `3001`)
- **/backend**: API Server & Database configuration (Node.js/Express, runs on Port `5000`)
- **/infra**: Reverse proxy configurations (Nginx)

## Getting Started

Follow these detailed instructions to get the project running locally from scratch.

### Prerequisites
You need the following installed on your machine:
- **Node.js** (v18+)
- **NPM** (Node Package Manager)
- **Docker Desktop** (Required to spin up our PostgreSQL Database, Redis, and Elasticsearch containers)

---

### Step 1: Install Dependencies
Navigate into each major directory and install the necessary dependencies using your terminal.

```bash
# 1. Install Backend Dependencies
cd backend
npm install

# 2. Install Frontend Shop Dependencies
cd ../frontend
npm install

# 3. Install Admin Dashboard Dependencies
cd ../admin
npm install
```

---

### Step 2: Environment Variables
The application relies on private API keys, database URLs, and session secrets that are required to start the servers. 

You must ask the repository owner or technical lead to securely provide you with the contents for your `.env` files. 
- You will need a `/backend/.env` file containing the `DATABASE_URL`, `JWT_SECRET`, Razorpay keys, and OAuth keys.
- You will need `/frontend/.env` containing `REACT_APP_API_URL=http://localhost:5000/api/v1`
- You will need `/admin/.env` containing `REACT_APP_API_URL=http://localhost:5000/api/v1` and `REACT_APP_ADMIN_MODE=true`

---

### Step 3: Start Docker Services & Create the Database
This project uses Docker Compose to entirely manage the databases for you! You do **not** need to manually install PostgreSQL or create the database yourself. Docker will automatically download PostgreSQL, start a server, and create a database called `zenwair_db` with the user `zenwair_user`.

Open a terminal at the very **root directory** of the project and run:

```bash
docker-compose up -d postgres redis elasticsearch
```
*(Wait a few minutes to ensure the database containers fully initialize and are labeled "Healthy" in Docker Desktop.)*

---

### Step 4: Run the Database Migration & Seed Admin Data
Even though Docker creates the empty database, we need to build the tables (Products, Users, Orders, etc.) and create our master Admin account.

Inside your terminal, navigate to the `backend` folder and run our custom database migration script:

```bash
cd backend
npm run migrate
```
If successful, the console will explicitly say `Schema migrated successfully` and `Admin user seeded`. 
**Take note of the Admin email and password printed to the console!** Keep this safe, as you will need it to log into the dashboard later.

---

### Step 5: Start the App Servers
You will need to open 3 separate terminal tabs to run the backend, frontend, and admin interfaces simultaneously.

**Terminal 1 (Backend API):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend Shop):**
```bash
cd frontend
npm start
```

**Terminal 3 (Admin Dashboard):**
```bash
cd admin
npm start
```

---

### Step 6: Create Your First Product!
Now that the whole platform is running, here is exactly how you launch your store:

1. Open your browser and navigate to the Admin panel at **`http://localhost:3001`**.
2. Log in using the Admin credentials that were seeded during `Step 4` (default is usually `admin@zenwair.com` / `Admin@1234`).
3. On the left sidebar, click on **Categories**, and add a category like "T-Shirts".
4. Next, click on **Products**, and click **Add Product** in the top right. 
5. Fill out your new product's title, price, select the category, and upload an image. Click **Save**!
6. Finally, on your newly created Product card, click the **📐 Sizes** button. Here you can add your inventory (e.g. Size M, Color Black, Stock: 50).
7. Visit the customer-facing shop at **`http://localhost:3005`** and you should dynamically see your new product ready to be purchased! Your database is completely working!
