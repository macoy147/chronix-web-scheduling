// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import dotenv from 'dotenv';
import logger from './logger.js';

// ✅ IMPROVEMENT: Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: '.env' });

const app = express();

// ✅ FIXED: Use environment variables for security
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://marcomontellano147user:marcomontellano147db@cluster0.qk0lbhg.mongodb.net/chronix?retryWrites=true&w=majority&appName=Cluster0';

// ✅ FIXED: Configure CORS for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Use your production URL
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));

app.use(bodyParser.json());

// ✅ IMPROVEMENT: Add a request logger for debugging
// This will log every incoming request's method, path, and body, which is extremely useful for debugging on Render.
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, { body: req.body });
    next();
});

// Serve front-end static assets from ./public at web root
// This makes URLs like /css/auth.css and /js/admin-dashboard.js resolve to public/css/... and public/js/...
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded images from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/img', express.static(path.join(__dirname, 'public', 'img')));

// ✅ FIXED: Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'public'))); // Adjust path to your built frontend
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', (error) => logger.error('MongoDB connection error:', error));
db.once('open', async () => {
    logger.info("✅ Connected to MongoDB!");
    try {
        // Drop old index if it exists (the one causing duplicate key error)
        const indexes = await db.collection('subjects').indexes();
        const badIndex = indexes.find(idx => idx.name === 'code_1');
        if (badIndex) {
            logger.warn("⚠️ Found old index 'code_1' — dropping it...");
            await db.collection('subjects').dropIndex('code_1');
            logger.info("✅ Dropped old 'code_1' index successfully.");
        }

        // Check if admin user exists, if not create one
        await ensureAdminUser();
    } catch (err) {
        logger.error("Error checking/dropping old index:", err);
    }
});

// --------------------- MODELS ---------------------
// User Model - UPDATED with proper fields
const UserSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    userrole: { type: String, required: true, enum: ['admin', 'teacher', 'student'] },
    ctuid: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    section: { type: String, default: '' },
    room: { type: String, default: '' },
    birthdate: { type: String, default: '' },
    gender: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    lastLogin: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Subject Model
const SubjectSchema = new mongoose.Schema({
    courseCode: { type: String, required: true, unique: true },
    descriptiveTitle: { type: String, required: true },
    yearLevel: { type: Number, required: true, min: 1, max: 12 },
    coPrerequisite: String,
    units: String,
    lecHours: String,
    labHours: String,
    totalHours: String,
    remarks: String,
    description: String
});
const Subject = mongoose.model('Subject', SubjectSchema);

// Section Model - Updated capacity to totalEnrolled
const SectionSchema = new mongoose.Schema({
    sectionName: { type: String, required: true, unique: true },
    programID: { type: String, required: true },
    yearLevel: { type: Number, required: true, min: 1, max: 4 },
    shift: { type: String, enum: ['Day', 'Night'], required: true },
    adviserTeacher: { type: String, default: '' },
    totalEnrolled: { type: Number, default: 0 }, // Changed from capacity to totalEnrolled
    academicYear: { type: String, required: true },
    semester: { type: String, enum: ["1st Semester", "2nd Semester", "Midyear"], required: true },
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' }
});
const Section = mongoose.model('Section', SectionSchema);

// Room Model
const RoomSchema = new mongoose.Schema({
    roomName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    building: {
        type: String,
        required: true,
        enum: ['College of Technology(CoTe) Building', 'College of Education(CoEd) Building']
    },
    roomType: {
        type: String,
        required: true,
        enum: ['Lecture', 'Lab', 'Computer Lab']
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 200
    },
    daySection: {
        type: String,
        default: 'None'
    },
    nightSection: {
        type: String,
        default: 'None'
    },
    status: {
        type: String,
        required: true,
        enum: ['Available', 'Under Maintenance', 'Occupied'],
        default: 'Available'
    }
}, {
    timestamps: true
});
const Room = mongoose.model('Room', RoomSchema);

// Schedule Model
const ScheduleSchema = new mongoose.Schema({
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    day: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startPeriod: { type: String, required: true, enum: ['AM', 'PM'] },
    endPeriod: { type: String, required: true, enum: ['AM', 'PM'] },
    scheduleType: { type: String, required: true, enum: ['lecture', 'lab'] },
    createdAt: { type: Date, default: Date.now }
});
const Schedule = mongoose.model('Schedule', ScheduleSchema);

// Ensure indexes match schema
Subject.syncIndexes().then(() => logger.info("✅ Subject indexes synchronized.")).catch(err => logger.error(err));

// --------------------- MULTER CONFIGURATION ---------------------
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.params.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            // Multer attaches the error to the request object
            req.fileValidationError = 'Only image files are allowed!';
            cb(null, false);
        }
    }
});

// --------------------- HELPER FUNCTIONS ---------------------
// Function to ensure admin user exists
async function ensureAdminUser() {
    try {
        const adminUser = await User.findOne({ email: 'admin@gmail.com' });
        if (!adminUser) {
            const newAdmin = new User({
                fullname: 'System Administrator',
                email: 'admin@gmail.com',
                userrole: 'admin',
                ctuid: 'ADMIN001',
                password: 'admin', // In production, this should be hashed
                birthdate: '2000-01-01',
                gender: 'male'
            });
            await newAdmin.save();
            logger.info('✅ Admin user created successfully');
            logger.info('📧 Email: admin@gmail.com');
            logger.info('🔑 Password: admin');
        } else {
            logger.info('✅ Admin user already exists');
        }
    } catch (error) {
        logger.error('Error ensuring admin user:', error);
    }
}

// --------------------- DEBUG ROUTES ---------------------
// Test server connection
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

// Get all users for debugging
app.get('/test-users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json({
            message: 'Users in database',
            users: users.map(user => ({
                _id: user._id,
                email: user.email,
                password: user.password,
                userrole: user.userrole,
                fullname: user.fullname,
                section: user.section,
                room: user.room,
                birthdate: user.birthdate,
                gender: user.gender,
                profilePicture: user.profilePicture,
                lastLogin: user.lastLogin
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// --------------------- ROUTES ---------------------
// Register
app.post('/register', async (req, res) => {
    const { fullname, email, userrole, ctuid, password, section, room, birthdate, gender } = req.body;
    try {
        // Prevent registering as admin through the API
        if (userrole === 'admin') {
            return res.status(403).json({ error: 'Admin registration is not allowed' });
        }

        // Check for duplicate email
        const oldUserByEmail = await User.findOne({ email });
        if (oldUserByEmail) return res.status(400).json({ error: 'User with this email already exists' });

        // NEW: Check for duplicate CTU ID
        const oldUserByCtuid = await User.findOne({ ctuid });
        if (oldUserByCtuid) return res.status(400).json({ error: 'User with this ID already exists' });

        const user = new User({ fullname, email, userrole, ctuid, password, section, room, birthdate, gender });
        await user.save();
        res.json({ message: 'User registered!' });
    } catch (error) {
        logger.error('Error registering user:', error);
        res.status(500).json({ error: 'Error registering user' });
    }
});

// Login - Simple and robust version
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        logger.info('🔐 Login attempt received:', {
            email: email,
            password: password ? '***' : 'missing',
            timestamp: new Date().toISOString()
        });
        // Basic validation
        if (!email || !password) {
            logger.warn('❌ Missing email or password');
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }
        // Clean email
        const cleanEmail = email.trim().toLowerCase();
        logger.info('📧 Searching for user with email:', cleanEmail);
        // Find user by email
        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            logger.warn('❌ User not found with email:', cleanEmail);
            return res.status(400).json({
                error: 'Invalid email or password'
            });
        }
        logger.info('✅ User found:', {
            id: user._id,
            email: user.email,
            storedPassword: user.password,
            inputPassword: password
        });
        // Simple password comparison (since we're storing plain text for now)
        if (user.password !== password) {
            logger.warn('❌ Password mismatch');
            return res.status(400).json({
                error: 'Invalid email or password'
            });
        }
        logger.info('✅ Password matches!');
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        // Prepare user data for response
        const userResponse = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            userrole: user.userrole,
            ctuid: user.ctuid,
            profilePicture: user.profilePicture,
            lastLogin: user.lastLogin,
            birthdate: user.birthdate,
            gender: user.gender,
            section: user.section,
            room: user.room
        };
        logger.info('🎉 Login successful for:', user.email);

        res.json({
            message: 'Login successful!',
            user: userResponse
        });
    } catch (error) {
        logger.error('💥 Login error:', error);
        res.status(500).json({
            error: 'Server error during login'
        });
    }
});

// Get user profile
app.get('/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        logger.error('Error fetching user:', error);
        res.status(500).json({ error: 'Error fetching user' });
    }
});

// Update user profile with file upload
app.put('/user/:id', upload.single('profilePicture'), async (req, res) => {
    try {
        // ✅ IMPROVEMENT: Check for multer file validation errors
        // This ensures the user is notified if they upload an invalid file type.
        if (req.fileValidationError) {
            return res.status(400).json({ error: req.fileValidationError });
        }

        const { fullname, email, ctuid, birthdate, gender, section, room } = req.body;

        const updateFields = {};
        if (fullname) updateFields.fullname = fullname;
        if (email) updateFields.email = email;
        if (ctuid) updateFields.ctuid = ctuid;
        if (birthdate) updateFields.birthdate = birthdate;
        if (gender) updateFields.gender = gender;
        if (section !== undefined) updateFields.section = section;
        if (room !== undefined) updateFields.room = room;

        // If file was uploaded, update profile picture path
        if (req.file) {
            updateFields.profilePicture = '/uploads/' + req.file.filename;
            logger.info('✅ Profile picture uploaded:', req.file.filename);
        }

        logger.info('🔄 Updating user with fields:', updateFields);

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ error: 'User not found' });

        logger.info('✅ Profile updated successfully for user:', updatedUser.email);
        res.json(updatedUser);

    } catch (error) {
        logger.error('❌ Error updating user:', error);
        res.status(500).json({ error: 'Error updating user: ' + error.message });
    }
});

// Delete user
app.delete('/user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Prevent deleting admin users through this route
        if (user.userrole === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin users' });
        }
        // Delete all schedules associated with this teacher
        await Schedule.deleteMany({ teacher: userId });
        // Delete user
        await User.findByIdAndDelete(userId);
        logger.info('✅ User deleted successfully:', user.email);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error deleting user: ' + error.message });
    }
});

// Upload profile picture (standalone endpoint)
app.post('/upload-profile-picture/:id', upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const profilePictureUrl = '/uploads/' + req.file.filename;
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { profilePicture: profilePictureUrl },
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ error: 'User not found' });

        res.json({
            message: 'Profile picture uploaded successfully',
            profilePicture: profilePictureUrl,
            user: updatedUser
        });

    } catch (error) {
        logger.error('Error uploading profile picture:', error);
        res.status(500).json({ error: 'Error uploading profile picture: ' + error.message });
    }
});

// --------------------- STUDENT SPECIFIC ROUTES ---------------------
// Get all students - NEW DEDICATED ENDPOINT
app.get('/users/students', async (req, res) => {
    try {
        const students = await User.find({ userrole: 'student' })
            .select('_id fullname email ctuid userrole section room birthdate gender profilePicture lastLogin')
            .sort({ fullname: 1 });
        
        logger.info(`✅ Fetched ${students.length} students`);
        res.json(students);
    } catch (error) {
        logger.error('Error fetching students:', error);
        res.status(500).json({ error: 'Error fetching students' });
    }
});

// Get students by section - NEW ENDPOINT
app.get('/users/students/section/:section', async (req, res) => {
    try {
        const { section } = req.params;
        const students = await User.find({ 
            userrole: 'student',
            section: section 
        }).sort({ fullname: 1 });
        
        res.json(students);
    } catch (error) {
        logger.error('Error fetching students by section:', error);
        res.status(500).json({ error: 'Error fetching students by section' });
    }
});

// Get students by year level - NEW ENDPOINT
app.get('/users/students/year-level/:yearLevel', async (req, res) => {
    try {
        const { yearLevel } = req.params;
        // This requires sections to have yearLevel and students to be linked to sections
        const sections = await Section.find({ yearLevel: parseInt(yearLevel) });
        const sectionNames = sections.map(s => s.sectionName);
        
        const students = await User.find({
            userrole: 'student',
            section: { $in: sectionNames }
        }).sort({ fullname: 1 });
        
        res.json(students);
    } catch (error) {
        logger.error('Error fetching students by year level:', error);
        res.status(500).json({ error: 'Error fetching students by year level' });
    }
});

// --------------------- DASHBOARD ROUTES ---------------------
app.get('/dashboard-counts', async (req, res) => {
    try {
        const studentCount = await User.countDocuments({ userrole: 'student' });
        const teacherCount = await User.countDocuments({ userrole: 'teacher' });
        const availableRoomCount = await Room.countDocuments({ status: 'Available' });

        res.json({
            students: studentCount,
            teachers: teacherCount,
            availableRooms: availableRoomCount
        });
    } catch (error) {
        logger.error('Error fetching dashboard counts:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard counts.' });
    }
});

// Get room statistics for dashboard charts
app.get('/room-stats', async (req, res) => {
    try {
        const rooms = await Room.find();

        const stats = {
            total: rooms.length,
            byStatus: {
                'Available': 0,
                'Under Maintenance': 0,
                'Occupied': 0
            },
            byBuilding: {},
            byType: {}
        };
        rooms.forEach(room => {
            // Count by status
            if (stats.byStatus.hasOwnProperty(room.status)) {
                stats.byStatus[room.status]++;
            }

            // Count by building
            const building = room.building || 'Unassigned';
            stats.byBuilding[building] = (stats.byBuilding[building] || 0) + 1;

            // Count by type
            const type = room.roomType || 'Unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        });
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching room stats:', error);
        res.status(500).json({ error: 'Error fetching room statistics' });
    }
});

// Students per Section
app.get('/students-per-section', async (req, res) => {
    try {
        const agg = await User.aggregate([
            { $match: { userrole: 'student' } },
            { $group: { _id: "$section", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        const result = agg.map(item => ({
            section: item._id || "Unassigned",
            count: item.count
        }));
        res.json(result);
    } catch (error) {
        logger.error('Error fetching students per section:', error);
        res.status(500).json({ error: 'Failed to fetch students per section.' });
    }
});

// Students per Room
app.get('/students-per-room', async (req, res) => {
    try {
        const agg = await User.aggregate([
            { $match: { userrole: 'student' } },
            { $group: { _id: "$room", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        const result = agg.map(item => ({
            room: item._id || "Unassigned",
            count: item.count
        }));
        res.json(result);
    } catch (error) {
        logger.error('Error fetching students per room:', error);
        res.status(500).json({ error: 'Failed to fetch students per room.' });
    }
});

// --------------------- SUBJECT ROUTES ---------------------
app.get('/subjects', async (req, res) => {
    try {
        const { yearLevel } = req.query;
        let query = {};
        
        // Filter by year level if specified
        if (yearLevel) {
            query.yearLevel = parseInt(yearLevel);
        }
        
        const subjects = await Subject.find(query).sort({ descriptiveTitle: 1 });
        res.json(subjects);
    } catch (error) {
        logger.error('Error fetching subjects:', error);
        res.status(500).json({ error: 'Error fetching subjects' });
    }
});

app.post('/subjects', async (req, res) => {
    try {
        logger.info('Received request to create subject:', req.body);
        const {
            courseCode, descriptiveTitle, yearLevel, coPrerequisite, units,
            lecHours, labHours, totalHours, remarks, description
        } = req.body;
        if (!courseCode || !descriptiveTitle || !yearLevel) {
            return res.status(400).json({ error: 'Course Code, Descriptive Title, and Year Level are required' });
        }
        const existing = await Subject.findOne({ courseCode: courseCode.trim() });
        if (existing) {
            return res.status(400).json({ error: `Course Code '${courseCode}' already exists` });
        }
        
        // Check for duplicate subject with same year level
        const duplicateSubject = await Subject.findOne({ 
            descriptiveTitle: descriptiveTitle.trim(),
            yearLevel: yearLevel
        });
        if (duplicateSubject) {
            return res.status(400).json({ error: `Subject '${descriptiveTitle}' already exists for Year Level ${yearLevel}` });
        }
        
        const newSubject = new Subject({
            courseCode: courseCode.trim(),
            descriptiveTitle: descriptiveTitle.trim(),
            yearLevel: yearLevel,
            coPrerequisite: coPrerequisite?.trim() || '',
            units: units?.trim() || '',
            lecHours: lecHours || '',
            labHours: labHours || '',
            totalHours: totalHours || '',
            remarks: remarks?.trim() || '',
            description: description?.trim() || ''
        });
        await newSubject.save();
        logger.info('✅ Subject created successfully:', newSubject);
        res.json({ message: 'Subject created successfully', subject: newSubject });
    } catch (error) {
        logger.error('Error creating subject:', error);
        res.status(500).json({ error: `Error creating subject: ${error.message}` });
    }
});

app.put('/subjects/:id', async (req, res) => {
    try {
        const {
            courseCode, descriptiveTitle, yearLevel, coPrerequisite, units,
            lecHours, labHours, totalHours, remarks, description
        } = req.body;
        if (!courseCode || !descriptiveTitle || !yearLevel) {
            return res.status(400).json({ error: 'Course Code, Descriptive Title, and Year Level are required' });
        }
        const existing = await Subject.findOne({ courseCode: courseCode.trim(), _id: { $ne: req.params.id } });
        if (existing) {
            return res.status(400).json({ error: `Course Code '${courseCode}' already exists` });
        }
        
        // Check for duplicate subject with same year level
        const duplicateSubject = await Subject.findOne({ 
            descriptiveTitle: descriptiveTitle.trim(),
            yearLevel: yearLevel,
            _id: { $ne: req.params.id }
        });
        if (duplicateSubject) {
            return res.status(400).json({ error: `Subject '${descriptiveTitle}' already exists for Year Level ${yearLevel}` });
        }
        
        const updated = await Subject.findByIdAndUpdate(
            req.params.id,
            {
                courseCode: courseCode.trim(),
                descriptiveTitle: descriptiveTitle.trim(),
                yearLevel: yearLevel,
                coPrerequisite: coPrerequisite?.trim() || '',
                units: units?.trim() || '',
                lecHours: lecHours || '',
                labHours: labHours || '',
                totalHours: totalHours || '',
                remarks: remarks?.trim() || '',
                description: description?.trim() || ''
            },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Subject not found' });
        res.json({ message: 'Subject updated successfully', subject: updated });
    } catch (error) {
        logger.error('Error updating subject:', error);
        res.status(500).json({ error: `Error updating subject: ${error.message}` });
    }
});

app.delete('/subjects/:id', async (req, res) => {
    try {
        const deleted = await Subject.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Subject not found' });
        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        logger.error('Error deleting subject:', error);
        res.status(500).json({ error: `Error deleting subject: ${error.message}` });
    }
});

// --------------------- SECTION ROUTES ---------------------
app.get('/sections', async (req, res) => {
    try {
        const sections = await Section.find().sort({ sectionName: 1 });
        res.json(sections);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching sections' });
    }
});

app.post('/sections', async (req, res) => {
    try {
        const { sectionName, programID, yearLevel, shift, adviserTeacher, totalEnrolled, academicYear, semester, status } = req.body;
        if (!sectionName || !programID || !yearLevel || !shift || !academicYear || !semester) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const exists = await Section.findOne({ sectionName: sectionName.trim() });
        if (exists) return res.status(400).json({ error: `Section "${sectionName}" already exists` });
        const section = new Section({
            sectionName: sectionName.trim(),
            programID, yearLevel, shift, adviserTeacher, totalEnrolled, academicYear, semester, status
        });
        await section.save();
        res.json({ message: 'Section created successfully', section });
    } catch (error) {
        res.status(500).json({ error: `Error creating section: ${error.message}` });
    }
});

app.put('/sections/:id', async (req, res) => {
    try {
        const { sectionName, programID, yearLevel, shift, adviserTeacher, totalEnrolled, academicYear, semester, status } = req.body;
        if (!sectionName || !programID || !yearLevel || !shift || !academicYear || !semester) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const exists = await Section.findOne({ sectionName: sectionName.trim(), _id: { $ne: req.params.id } });
        if (exists) return res.status(400).json({ error: `Section "${sectionName}" already exists` });
        const updated = await Section.findByIdAndUpdate(
            req.params.id,
            { sectionName: sectionName.trim(), programID, yearLevel, shift, adviserTeacher, totalEnrolled, academicYear, semester, status },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Section not found' });
        res.json({ message: 'Section updated successfully', section: updated });
    } catch (error) {
        res.status(500).json({ error: `Error updating section: ${error.message}` });
    }
});

app.delete('/sections/:id', async (req, res) => {
    try {
        const deleted = await Section.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Section not found' });
        res.json({ message: 'Section deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: `Error deleting section: ${error.message}` });
    }
});

// --------------------- TEACHER ROUTES ---------------------
app.get('/teachers', async (req, res) => {
    try {
        const teachers = await User.find({ userrole: 'teacher' }).select('_id fullname email ctuid profilePicture userrole birthdate gender section room lastLogin');
        res.json(teachers);
    } catch (error) {
        logger.error('Error fetching teachers:', error);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// --------------------- ROOM ROUTES ---------------------
app.get('/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ roomName: 1 });
        res.json(rooms);
    } catch (error) {
        logger.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Error fetching rooms' });
    }
});

app.get('/rooms/:id', async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (error) {
        logger.error('Error fetching room:', error);
        res.status(500).json({ error: 'Error fetching room' });
    }
});

app.post('/rooms', async (req, res) => {
    try {
        const { roomName, building, roomType, capacity, daySection, nightSection, status } = req.body;

        // Validation
        if (!roomName || !building || !roomType || !capacity) {
            return res.status(400).json({ error: 'Room name, building, room type, and capacity are required' });
        }
        // Check if room already exists
        const existingRoom = await Room.findOne({ roomName: roomName.trim() });
        if (existingRoom) {
            return res.status(400).json({ error: `Room '${roomName}' already exists` });
        }
        const room = new Room({
            roomName: roomName.trim(),
            building,
            roomType,
            capacity: parseInt(capacity),
            daySection: daySection || 'None',
            nightSection: nightSection || 'None',
            status: status || 'Available'
        });
        await room.save();
        logger.info('✅ Room created successfully:', room.roomName);
        res.json({ message: 'Room created successfully', room });

    } catch (error) {
        logger.error('Error creating room:', error);
        res.status(500).json({ error: `Error creating room: ${error.message}` });
    }
});

app.put('/rooms/:id', async (req, res) => {
    try {
        const { roomName, building, roomType, capacity, daySection, nightSection, status } = req.body;

        // Validation
        if (!roomName || !building || !roomType || !capacity) {
            return res.status(400).json({ error: 'Room name, building, room type, and capacity are required' });
        }
        // Check if room name already exists (excluding current room)
        const existingRoom = await Room.findOne({
            roomName: roomName.trim(),
            _id: { $ne: req.params.id }
        });
        if (existingRoom) {
            return res.status(400).json({ error: `Room '${roomName}' already exists` });
        }
        const updatedRoom = await Room.findByIdAndUpdate(
            req.params.id,
            {
                roomName: roomName.trim(),
                building,
                roomType,
                capacity: parseInt(capacity),
                daySection: daySection || 'None',
                nightSection: nightSection || 'None',
                status: status || 'Available'
            },
            { new: true }
        );
        if (!updatedRoom) return res.status(404).json({ error: 'Room not found' });

        logger.info('✅ Room updated successfully:', updatedRoom.roomName);
        res.json({ message: 'Room updated successfully', room: updatedRoom });

    } catch (error) {
        logger.error('Error updating room:', error);
        res.status(500).json({ error: `Error updating room: ${error.message}` });
    }
});

app.delete('/rooms/:id', async (req, res) => {
    try {
        const deletedRoom = await Room.findByIdAndDelete(req.params.id);
        if (!deletedRoom) return res.status(404).json({ error: 'Room not found' });

        logger.info('✅ Room deleted successfully:', deletedRoom.roomName);
        res.json({ message: 'Room deleted successfully' });

    } catch (error) {
        logger.error('Error deleting room:', error);
        res.status(500).json({ error: `Error deleting room: ${error.message}` });
    }
});

// --------------------- SCHEDULE ROUTES ---------------------
app.get('/schedules', async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .populate('subject')
            .populate('teacher')
            .populate('section')
            .populate('room');
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching schedules' });
    }
});

app.post('/schedules', async (req, res) => {
    try {
        const schedule = new Schedule(req.body);
        await schedule.save();

        // Populate the saved schedule for response
        const populatedSchedule = await Schedule.findById(schedule._id)
            .populate('subject')
            .populate('teacher')
            .populate('section')
            .populate('room');

        res.json({ message: 'Schedule created successfully', schedule: populatedSchedule });
    } catch (error) {
        res.status(500).json({ error: 'Error creating schedule' });
    }
});

app.put('/schedules/:id', async (req, res) => {
    try {
        const updatedSchedule = await Schedule.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('subject')
         .populate('teacher')
         .populate('section')
         .populate('room');

        if (!updatedSchedule) return res.status(404).json({ error: 'Schedule not found' });
        res.json({ message: 'Schedule updated successfully', schedule: updatedSchedule });
    } catch (error) {
        res.status(500).json({ error: 'Error updating schedule' });
    }
});

app.delete('/schedules/:id', async (req, res) => {
    try {
        const deletedSchedule = await Schedule.findByIdAndDelete(req.params.id);
        if (!deletedSchedule) return res.status(404).json({ error: 'Schedule not found' });
        res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting schedule' });
    }
});

// ✅ FIXED: Add a catch-all route to serve index.html in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html')); // Adjust as needed
    });
}

// ✅ FIXED: Better error handling for deployment
app.use((err, req, res, next) => {
    logger.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// --------------------- SERVER START ---------------------
app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`🔧 Debug endpoints available:`);
    logger.info(`   - http://localhost:${PORT}/test`);
    logger.info(`   - http://localhost:${PORT}/test-users`);
    logger.info(`📧 Default admin credentials:`);
    logger.info(`   - Email: admin@gmail.com`);
    logger.info(`   - Password: admin`);
    logger.info(`📁 File uploads directory: ${uploadsDir}`);
    logger.info(`🎓 Student endpoints:`);
    logger.info(`   - http://localhost:${PORT}/users/students`);
    logger.info(`   - http://localhost:${PORT}/users/students/section/:section`);
    logger.info(`   - http://localhost:${PORT}/users/students/year-level/:yearLevel`);
    logger.info(`📊 Dashboard endpoints:`);
    logger.info(`   - http://localhost:${PORT}/dashboard-counts`);
    logger.info(`   - http://localhost:${PORT}/room-stats`);
    logger.info(`   - http://localhost:${PORT}/students-per-section`);
    logger.info(`   - http://localhost:${PORT}/students-per-room`);
});