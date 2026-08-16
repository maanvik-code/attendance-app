const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure directory and storage logs exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

const LOGS_FILE = path.join(__dirname, 'attendance_logs.json');
if (!fs.existsSync(LOGS_FILE)) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([]));
}

// UPDATE YOUR TARGET LOCATION HERE (Latitude & Longitude)
const TARGET_LAT = 17.7330004; 
const TARGET_LNG = 83.3077470; 
const ALLOWED_RADIUS_METERS = 100; 

// Haversine formula for distance calculation in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Endpoint: Mark Attendance
app.post('/api/mark-attendance', (req, res) => {
  const { userId, userLat, userLng, imageBase64 } = req.body;

  if (!userId || !userLat || !userLng || !imageBase64) {
    return res.status(400).json({ success: false, message: "Missing required details." });
  }

  const distance = calculateDistance(userLat, userLng, TARGET_LAT, TARGET_LNG);

  if (distance > ALLOWED_RADIUS_METERS) {
    return res.status(403).json({ 
      success: false, 
      message: `Out of bounds! You are ${Math.round(distance)}m away from target location.` 
    });
  }

  const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, "");
  const fileName = `attendance_${userId}_${Date.now()}.jpg`;
  const filePath = path.join(__dirname, 'uploads', fileName);

  fs.writeFile(filePath, base64Data, 'base64', (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to save captured photo." });
    }

    const newRecord = {
      userId: userId,
      timestamp: new Date().toLocaleString(),
      distanceMeters: Math.round(distance),
      photoUrl: `/uploads/${fileName}`
    };

    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    logs.unshift(newRecord);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));

    return res.json({ 
      success: true, 
      message: "Attendance marked successfully!",
      distance: Math.round(distance)
    });
  });
});

// Endpoint: Fetch Logs for Admin Dashboard
app.get('/api/admin/records', (req, res) => {
  if (fs.existsSync(LOGS_FILE)) {
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    return res.json(logs);
  }
  return res.json([]);
});

// Route: Admin Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin Panel available at http://localhost:${PORT}/admin`);
});