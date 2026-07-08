# AttendX — Production-Grade Web Portal Walkthrough

## ✅ What was Fixed & Implemented

### 1. Real-time Live Data Synchronization
- **Polling Loop:** Added an automatic auto-refresh sync system to `App.tsx` that triggers database updates every 10 seconds. Admin statistics, employee listings, and daily logs refresh in real-time without manual page reloads.
- **WebSocket/SSE Readiness:** Outlined production WebSocket integration below.

### 2. "Add Employee" Form Fix (MongoDB Null Index Collision)
- **Problem:** MongoDB has a unique index on the optional `email` field. Multiple employee profiles created without email inputs clashed with duplicate `null` values, breaking employee creation.
- **Solution:** Added a smart internal unique email generator. If the admin leaves the email field blank, the system automatically assigns a unique fallback email `${employeeId.toLowerCase()}@apex.internal`. This prevents unique index constraint collisions while keeping login phone-centric.

### 3. Firebase Phone Authentication Integration (10k free SMS/mo)
- **Frontend SDK:** Added dynamic Firebase client SDK loader in `frontend/src/firebase.config.ts`.
- **Backend Admin Verification:** Implemented dynamic `firebase-admin` token verify service in `backend/src/services/firebase.service.ts` and registered verification endpoint `POST /api/auth/employee/firebase-verify`.
- **Hybrid Support:** Both frontend and backend automatically run in **Development Fallback Mode** (generating local OTP and printing it in logs) if keys are missing, allowing easy testing. Once credentials are set, it transitions seamlessly to real SMS delivery.

### 4. Precision GPS Geofencing (Lat-Long)
- **Office Rules:** Geofence matches GPS location accuracy via the **Haversine formula**.
- **Developer Toggle:** Added a "Simulate Location" toggle (defaults to `false` to prioritize real-time location).
- **Real-Time GPS Tracking:** Disabling simulation uses HTML5 `watchPosition` to fetch coordinates dynamically.
- **Interactive UI Feedback:** The GPS status is shown directly under the toggle switch (displays live latitude, longitude, and accuracy radius or permission/timeout error messages).
- **Admin Coordinates Detector:** Added a "Detect & Use My Current GPS Location" button in Company Settings to auto-align the company's geofencing office coordinates with the administrator's physical testing location.

---

## 🚀 Production Deployment & Integration Roadmap

To use AttendX in a live production environment, follow these steps to configure your third-party integrations:

### 1. Database (MongoDB Cloud Atlas)
- **Action:** Replace local database connections with a production-ready, high-availability cluster.
- **Steps:**
  1. Register for a free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
  2. Create a database cluster and whitelist access IP addresses.
  3. Copy the MongoDB Connection String.
  4. Paste it into your backend `.env` file under `DATABASE_URL`.

### 2. Firebase Phone Auth Configuration (Free SMS OTP Setup)
- **Action:** Activate free real-time SMS delivery to physical cellphones.
- **Steps:**
  1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
  2. Enable **Phone** authentication provider.
  3. Under Project Settings, add a **Web App** and copy the configuration credentials.
  4. Add them to your frontend environment configuration (`.env` or process settings):
     ```env
     VITE_FIREBASE_API_KEY=your-api-key
     VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
     VITE_FIREBASE_PROJECT_ID=your-project-id
     VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
     VITE_FIREBASE_APP_ID=your-app-id
     ```
  5. Generate a **Service Account JSON** in Project Settings > Service Accounts.
  6. Copy variables from the JSON key and add to your backend `.env` file:
     ```env
     FIREBASE_PROJECT_ID=your-project-id
     FIREBASE_CLIENT_EMAIL=your-client-email
     FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
     ```

### 3. Device Geolocation Permission (HTTPS SSL)
- **Action:** Enable browser geolocator calls.
- **Steps:**
  - Modern web browsers (Chrome, Safari, Firefox) **block** access to native location hardware on non-secure connections.
  - For production geofencing, your app **must be hosted over HTTPS** (SSL certificate configured on the domain).

### 4. Hosting Options
- **Backend Node.js API:** Deploy to platforms like **Render**, **AWS App Runner**, or **Railway** (requires environment variables set in hosting panel).
- **Frontend React app:** Deploy to **Vercel**, **Netlify**, or **GitHub Pages**. Update `API_BASE` in the React build config to point to your live hosted Backend API URL.
