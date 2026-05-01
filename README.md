# Multi Model Road Damage Detection Reporting And Monitoring

A comprehensive intelligent system for citizens and authorities to report, review, monitor, and resolve road damage cases such as potholes using advanced AI-powered detection and multi-model analysis. Citizens can upload road images with GPS location, and authorities can efficiently manage reports with real-time status updates and resolution tracking.

This repository contains the production-ready implementation using Node.js, Express, EJS, MongoDB, and Bootstrap with integrated AI-powered image analysis capabilities.

## 🎯 Project Overview

**Multi Model Road Damage Detection Reporting And Monitoring** is a civic response system that leverages multiple AI models to:

- Enable citizens to report road damage with accurate GPS coordinates and photographic evidence
- Automatically analyze and classify damage severity using multiple AI models
- Provide authorities with a centralized dashboard for efficient report management
- Track repairs from submission through completion with proof documentation
- Maintain comprehensive records for infrastructure monitoring and analytics

## ✨ Key Features

### For Citizens
- **Easy Sign-Up & Login** - Email/password authentication with persistent sessions
- **Smart Report Submission** - Capture damage with photo, location, and description
- **Real-Time Tracking** - Monitor report status from submission to resolution
- **Dashboard View** - See all your submitted reports with status indicators
- **Map Integration** - Visualize report locations on interactive maps

### For Authorities
- **Dedicated Management Panel** - Comprehensive dashboard for all active reports
- **Status Workflow** - Submitted → Approved → Working → Completed/Cancelled
- **Remarks & Updates** - Add detailed notes and field observations
- **Proof Upload** - Attach resolution photos and repair documentation
- **Map Overview** - View all damage locations and workload distribution

### For Administrators
- **System-Wide Visibility** - Monitor all reports, users, and authority teams
- **Advanced Analytics** - Damage statistics, resolution rates, and trends
- **Report Management** - Create, edit, delete, and export reports
- **User Management** - Control roles, permissions, and system access
- **Image Preview** - Review all submitted evidence and validation results

## 🤖 AI-Powered Features

- **Multi-Model Analysis** - Uses multiple AI models for comprehensive damage assessment
- **Automatic Classification** - Identifies damage type (pothole, crack, debris, etc.)
- **Severity Assessment** - Rates damage urgency for priority routing
- **Image Validation** - Ensures submitted images meet quality standards
- **OpenAI Vision Support** - Advanced visual analysis and damage description
- **Gemini Integration** - Alternative AI backend for redundancy and comparison

## 🛠️ Tech Stack

### Backend
- **Node.js** - JavaScript runtime for server-side logic
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database for flexible data storage
- **Mongoose** - Object data modeling and schema validation
- **Express-Session** - User session management
- **Connect-Mongo** - MongoDB session store

### Frontend
- **EJS** - Server-side templating engine
- **Bootstrap 5** - Responsive UI framework
- **Vanilla JavaScript** - Interactive client-side functionality
- **Leaflet.js** - Interactive map display and GIS features

### File & Image Processing
- **Multer** - Multipart form data and file upload handling
- **Sharp** - High-performance image processing and optimization

### AI & APIs
- **OpenAI API** - Advanced image analysis and classification
- **Gemini API** - Alternative AI model for image understanding
- **Axios** - HTTP client for API requests

## 📋 Project Structure

```
Multi-Model-Road-Damage-Detection/
├── server.js                 # Main Express application
├── config.js                 # Configuration settings
├── package.json              # Project dependencies
├── .env                      # Environment variables
│
├── routes/
│   ├── auth.js              # Authentication (login, signup, logout)
│   └── api.js               # API endpoints (upload, status, comments)
│
├── models/
│   ├── User.js              # User schema
│   ├── Report.js            # Road damage report schema
│   ├── Comment.js           # Report comments schema
│   └── Counter.js           # Auto-increment counter utility
│
├── middleware/
│   ├── requireUser.js       # User authentication middleware
│   └── requireRole.js       # Role-based access control
│
├── services/
│   ├── imageAnalysis.js     # AI image processing
│   ├── potholeDetect.js     # Damage detection logic
│   ├── damageTypes.js       # Damage classification
│   └── reportTriage.js      # Report severity assessment
│
├── utils/
│   ├── password.js          # Password hashing & validation
│   ├── formatReport.js      # Report formatting utilities
│   └── sortReports.js       # Report sorting logic
│
├── views/                   # EJS page templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── authority.ejs
│   ├── report.ejs
│   ├── profile.ejs
│   ├── partials/           # Reusable template components
│   └── ...
│
├── public/
│   ├── home/               # Landing page
│   ├── css/                # Stylesheets
│   ├── js/                 # Client-side scripts
│   ├── uploads/            # User-submitted images
│   └── Screenshots/        # Documentation images
│
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18 or higher
- **MongoDB** database (local or cloud instance)
- **npm** or **yarn** package manager

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Multi-Model-Road-Damage-Detection
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=8000
NODE_ENV=development
APP_BASE_URL=http://localhost:9000

# Database
MONGODB_URI=mongodb://localhost:27017/road-damage-db

# Session
SESSION_SECRET=your_secure_session_secret_here

# AI Services (Optional)
OPENAI_API_KEY=your_openai_api_key
USE_OPENAI=true

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
USE_GEMINI=true

# Detection Settings
DETECTION_MODE=auto  # auto, manual, or disabled
```

4. **Start the application**

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

5. **Access the application**

Open your browser and navigate to:
```
http://localhost:9000
```

## 📖 System Workflows

### 🔵 Citizen Workflow

1. **Sign Up** - Create account with email and password
2. **Login** - Access the dashboard
3. **Report Damage** - 
   - Click "New Report" button
   - Take/upload road damage photo
   - Mark location on map or enter address
   - Add description and severity estimate
   - Submit report
4. **Track Status** - Monitor report progress in dashboard
5. **View Updates** - Receive authority remarks and completion notifications

### 🟠 Authority Workflow

1. **Login** - Access authority panel
2. **Review Reports** - See queue of submitted reports
3. **Triage** - Assess and prioritize reports
4. **Update Status** - Change from submitted → approved → working → completed
5. **Document Work** - Add field notes and repair photos
6. **Close Report** - Mark as resolved with proof of completion

### 🔴 Admin Workflow

1. **Login** - Access admin dashboard
2. **System Monitoring** - View all reports, users, and activity
3. **Analytics** - Review statistics and trends
4. **User Management** - Create/manage authority accounts
5. **Audit Logs** - Track system activities
6. **Configuration** - Manage AI settings and thresholds

## 🔑 Key Routes

### Authentication
- `GET  /login` - Login page
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - Authenticate user
- `GET  /logout` - End session

### Dashboard & Reports
- `GET  /dashboard` - User report dashboard
- `GET  /report` - Report submission form
- `GET  /routing` - Route/location view
- `GET  /authority` - Authority management panel
- `GET  /profile` - User profile page

### APIs
- `POST   /api/upload` - Upload report image
- `GET    /api/reports` - Fetch all reports
- `POST   /api/reports` - Create new report
- `PATCH  /api/reports/status` - Update report status
- `POST   /api/reports/proof` - Upload resolution proof
- `DELETE /api/reports/:id` - Remove report
- `POST   /api/comments` - Add report comment
- `GET    /api/comments/:reportId` - Fetch comments

## 💾 Database Schema

### User Document
```javascript
{
  emailId: String,
  name: String,
  password: String (hashed),
  role: String (user/authority/admin),
  isActive: Boolean,
  createdAt: Date
}
```

### Report Document
```javascript
{
  reportId: Number,
  userId: String,
  imageUrl: String,
  description: String,
  severity: String (low/medium/high),
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  status: String (submitted/approved/working/completed/cancelled),
  analysisResult: Object,
  remarks: String,
  proofImageUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Comment Document
```javascript
{
  reportId: Number,
  userId: String,
  message: String,
  role: String,
  createdAt: Date
}
```

## 🤖 AI Integration

### Image Analysis Pipeline

1. **Image Upload** - User submits photo via Multer
2. **Pre-processing** - Sharp optimizes image (resize, compress)
3. **Model Selection** - System chooses OpenAI, Gemini, or local fallback
4. **Analysis** - AI identifies damage type and severity
5. **Classification** - Results stored in report document
6. **Validation** - System confirms image meets quality standards

### Damage Classification
- **Pothole** - Circular or irregular pit in road surface
- **Crack** - Linear or web-like fissures
- **Debris** - Scattered objects or loose material
- **Rut** - Longitudinal groove or channel
- **Patch** - Existing repair or maintenance area

## 🧪 Testing Credentials

For development/demo purposes:

```
Admin Account:
Email: vishalroy2574@gmail.com
Role: Admin

Authority Account:
Email: nilesh23@gmail.com
Role: Authority

Citizen Accounts:
Create via signup form
```

## 📊 Performance Features

- **Session Caching** - MongoDB session store for scalability
- **Image Optimization** - Sharp compresses large uploads
- **Indexed Queries** - MongoDB indexes for fast report retrieval
- **Lazy Loading** - Maps and images load progressively
- **Responsive Design** - Bootstrap ensures mobile compatibility

## 🔒 Security Features

- **Password Hashing** - bcrypt for secure password storage
- **Session Management** - Express-session with MongoDB store
- **Role-Based Access Control** - Middleware for permission checking
- **Input Validation** - Data validation before storage
- **CORS Configuration** - Secure cross-origin requests
- **Multer Configuration** - File upload size limits and type validation

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB service is running
- Check connection string in `.env`
- Ensure network access if using MongoDB Atlas

### Image Upload Fails
- Verify `/public/uploads/` directory exists
- Check file permissions
- Confirm Multer configuration in `routes/api.js`

### AI Analysis Not Working
- Verify API keys in `.env` file
- Check API quotas and billing
- Review service documentation for rate limits

### Session Problems
- Clear browser cookies
- Restart server
- Check `SESSION_SECRET` in `.env`

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Leaflet.js Guide](https://leafletjs.com/)
- [Bootstrap Documentation](https://getbootstrap.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Google Gemini API](https://ai.google.dev/)

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 👥 Project Team

- **Developer** - Full-stack implementation, AI integration, database design
- **Advisor** - Project oversight and technical guidance

## 📞 Support & Feedback

For issues, suggestions, or questions:
- Open an issue on the repository
- Contact the development team
- Review the documentation and troubleshooting guide

## 🎓 Academic Notes

This project demonstrates:
- Full-stack web development (MERN-like stack)
- Database design and schema optimization
- RESTful API development
- Authentication and authorization patterns
- File upload and media processing
- AI/ML integration in web applications
- Responsive UI/UX design
- DevOps and deployment practices

---

**Last Updated:** May 2026  
**Version:** 1.0.0  
**Status:** Production Ready
