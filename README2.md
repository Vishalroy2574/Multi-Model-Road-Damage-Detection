# Road Damage Reporter

Road Damage Reporter is a web application for citizens and authorities to report, review, and resolve road damage cases such as potholes. Citizens can upload a road image, add location details, and submit a report. Authorities can review reports, update status, add remarks, and upload proof of resolution.

This repository contains the current server-rendered implementation of the project using Node.js, Express, EJS, MongoDB, and Bootstrap.

## What This App Does

- Lets users sign up and log in with email/password
- Lets users submit road damage reports with images and location details
- Stores reports in MongoDB
- Shows all reports in a dashboard and map view
- Gives authority/admin users a dedicated panel to manage reports
- Allows status updates such as submitted, approved, working, completed, and cancelled
- Supports remarks/comments and proof image upload for resolved cases
- Uses AI-assisted image validation and analysis when configured

## Simple Presentation Explanation

You can describe the project like this:

> Road Damage Reporter is a civic response system that helps citizens report potholes and helps authorities track, verify, and resolve them. A user uploads a road image and location, the system stores the case, and the authority panel is used to review the report, update the status, and attach a resolution photo when the problem is fixed.

## Why This Project Is Useful

- Citizens get a simple way to report damaged roads
- Authorities get a centralized queue of complaints
- Report status is transparent and trackable
- Images and location data make cases easier to verify
- The dashboard helps show which cases are still pending and which are resolved

## Tech Stack

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- Express Session
- Connect-Mongo

### Frontend

- EJS templates
- Bootstrap
- Vanilla JavaScript
- Leaflet for map display

### Media and AI

- Multer for image uploads
- Sharp for image processing
- Axios for HTTP requests
- OpenAI support for vision analysis
- Gemini support for optional vision analysis

## Why These Technologies Were Used

- **Node.js**: good for JavaScript-based backend development
- **Express.js**: keeps routing and API creation simple
- **MongoDB**: flexible for storing report data, user info, and comments
- **Mongoose**: makes MongoDB data handling cleaner and safer
- **EJS**: easy server-side rendering for dashboards and forms
- **Bootstrap**: faster UI building with responsive layouts
- **Leaflet**: lightweight map support for displaying report locations
- **Multer**: handles image file uploads
- **Sharp**: useful for image processing and validation
- **Express-session + connect-mongo**: keeps users logged in across requests
- **OpenAI / Gemini**: optional AI-based road image inspection

## How The System Works

### 1. Login and Session

Users log in through the auth route. A session is created and stored in MongoDB so the user stays logged in even after refresh.

### 2. Report Submission

The user uploads a road image, adds a location, and submits the report. The frontend sends the image and form data to the backend API.

### 3. AI Validation / Analysis

The app can analyze the uploaded image using AI or local fallback logic. This helps decide whether the image is suitable and what kind of road damage is visible.

### 4. Report Storage

The final report is saved in MongoDB with:

- image URL
- description
- severity
- coordinates
- analysis result
- workflow status

### 5. Authority Review

Authorities can:

- change report status
- add remarks
- upload proof of resolution
- delete reports if they are admins

### 6. Dashboard Updates

The dashboard shows:

- total reports
- pending triage
- resolved cases
- report cards with images and metadata
- map-based location view

## Project Structure

- `server.js` - main Express app, routes, session setup, page rendering
- `routes/auth.js` - login, signup, logout, auth session handling
- `routes/api.js` - upload, report save, status update, comments, proof upload, delete
- `models/` - MongoDB schemas
- `views/` - EJS pages and partials
- `public/js/` - browser-side interactivity
- `public/css/` - shared styling
- `utils/` - formatting, password helpers, sorting helpers
- `services/` - image analysis and triage logic

## Main Screens

- Home / landing page
- Login and signup
- Dashboard for all reports
- Authority panel
- Report form
- Route view
- Profile page

## Key Flows

### Citizen Flow

1. Sign in
2. Open the report form
3. Upload a road image
4. Add location and description
5. Submit the report
6. Track the status later in the dashboard

### Authority Flow

1. Sign in as authority/admin
2. Open authority panel
3. Review reports
4. Update status to approved, working, completed, or cancelled
5. Add remarks
6. Upload a resolution photo

## Setup

### Requirements

- Node.js 18+
- MongoDB connection string

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file with:

```env
PORT=8000
MONGODB_URI=your_mongo_connection_string
SESSION_SECRET=your_session_secret
APP_BASE_URL=http://localhost:8000

# Optional AI settings
OPENAI_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
USE_GEMINI=true
DETECTION_MODE=auto
```

### Run

```bash
npm start
```

For development:

```bash
npm run dev
```

Then open:

```text
http://localhost:8000
```

## Important Routes

- `/login`
- `/logout`
- `/dashboard`
- `/authority`
- `/report`
- `/routing`
- `/profile`
- `/api/upload`
- `/api/reports`
- `/api/reports/status`
- `/api/reports/proof`
- `/api/reports/delete`

## Demo Summary For Presentation

If you need a short answer during a demo, say:

> This project is a road damage reporting and authority management system. Citizens upload a road image with location details, the backend validates and stores the case, and the authority panel is used to review, resolve, and document each report.

## Viva-Friendly Points

- Why MongoDB? Because report data is flexible and document-based.
- Why Express? Because it makes API and page routing simple.
- Why EJS? Because the UI is server-rendered and easy to maintain.
- Why sessions? Because users need persistent login.
- Why Multer? Because the app accepts image uploads.
- Why Leaflet? Because it shows report locations on a map.
- Why AI analysis? Because it helps validate road images before submission.

## Notes

- This repository currently uses a server-rendered Node.js stack.
- The original project concept described in the larger capstone was broader, but this codebase is the working implementation you can present and demo.

## License

MIT

