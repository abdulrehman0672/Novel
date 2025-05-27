import express from 'express';
import { Novel, Admin } from '../models/novel.js'; // Update with your actual schema path
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';



const router = express.Router();


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Error: Images only!');
        }
    }
}).single('coverImage');

// Middleware to verify admin authentication
const authAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.adminToken || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Please authenticate' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id).select('-password');
        
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Admin not found' });
        }
        
        req.admin = admin;
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }
        
        const admin = await Admin.findOne({ email }).select('+password');
        
        if (!admin || !(await admin.correctPassword(password, admin.password))) {
            return res.status(401).json({ success: false, message: 'Incorrect email or password' });
        }
        
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });
        
        res.cookie('adminToken', token, {
            expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });
        
        res.status(200).json({ 
            success: true, 
            token, 
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin Logout
router.get('/logout', (req, res) => {
    res.cookie('adminToken', '', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// Get Dashboard Stats
router.get('/dashboard/stats', authAdmin, async (req, res) => {
    try {
        const totalNovels = await Novel.countDocuments();
        const totalAuthors = await Novel.distinct('authorName').count();
        const featuredNovels = await Novel.countDocuments({ isFeatured: true });
        
        // You might want to add actual visitor tracking in your application
        const dailyVisitors = Math.floor(Math.random() * 1000) + 5000;
        const dailyViews = Math.floor(Math.random() * 2000) + 10000;
        
        res.status(200).json({
            success: true,
            stats: {
                totalNovels,
                totalAuthors,
                featuredNovels,
                dailyVisitors,
                dailyViews
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Recent Activity
router.get('/dashboard/activity', authAdmin, async (req, res) => {
    try {
        // Get recently added novels
        const recentNovels = await Novel.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .select('title authorName createdAt');
        
        // Get recently updated novels
        const updatedNovels = await Novel.find()
            .sort({ updatedAt: -1 })
            .limit(3)
            .select('title authorName updatedAt');
            
        res.status(200).json({
            success: true,
            recentNovels,
            updatedNovels
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get All Novels
router.get('/novels', authAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        const query = {};
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { authorName: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }
        
        const novels = await Novel.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
            
        const total = await Novel.countDocuments(query);
        
        res.status(200).json({
            success: true,
            count: novels.length,
            total,
            novels
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add New Novel
router.post('/novels', authAdmin, async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err });
            }
            
            const { 
                title,
                titleUrdu,
                description,
                descriptionUrdu,
                authorName,
                authorNameUrdu,
                category,
                isFeatured
            } = req.body;
            
            const coverImage = req.file ? req.file.filename : 'default-cover.jpg';
            
            const novel = new Novel({
                title,
                titleUrdu,
                description,
                descriptionUrdu,
                authorName,
                authorNameUrdu,
                coverImage,
                category,
                isFeatured: isFeatured === 'true'
            });
            
            await novel.save();
            
            res.status(201).json({ 
                success: true, 
                message: 'Novel added successfully',
                novel
            });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update Novel
router.put('/novels/:id', authAdmin, async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err });
            }
            
            const novel = await Novel.findById(req.params.id);
            
            if (!novel) {
                return res.status(404).json({ success: false, message: 'Novel not found' });
            }
            
            const { 
                title,
                titleUrdu,
                description,
                descriptionUrdu,
                authorName,
                authorNameUrdu,
                category,
                isFeatured
            } = req.body;
            
            novel.title = title || novel.title;
            novel.titleUrdu = titleUrdu || novel.titleUrdu;
            novel.description = description || novel.description;
            novel.descriptionUrdu = descriptionUrdu || novel.descriptionUrdu;
            novel.authorName = authorName || novel.authorName;
            novel.authorNameUrdu = authorNameUrdu || novel.authorNameUrdu;
            novel.category = category || novel.category;
            novel.isFeatured = isFeatured === 'true';
            
            if (req.file) {
                // Delete old image if it's not the default
                if (novel.coverImage !== 'default-cover.jpg') {
                    fs.unlink(`public/uploads/${novel.coverImage}`, (err) => {
                        if (err) console.log('Error deleting old image:', err);
                    });
                }
                novel.coverImage = req.file.filename;
            }
            
            await novel.save();
            
            res.status(200).json({ 
                success: true, 
                message: 'Novel updated successfully',
                novel
            });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete Novel
router.delete('/novels/:id', authAdmin, async (req, res) => {
    try {
        const novel = await Novel.findByIdAndDelete(req.params.id);
        
        if (!novel) {
            return res.status(404).json({ success: false, message: 'Novel not found' });
        }
        
        // Delete cover image if it's not the default
        if (novel.coverImage !== 'default-cover.jpg') {
            fs.unlink(`public/uploads/${novel.coverImage}`, (err) => {
                if (err) console.log('Error deleting image:', err);
            });
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Novel deleted successfully'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get All Authors
router.get('/authors', authAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        const query = {};
        
        if (search) {
            query.authorName = { $regex: search, $options: 'i' };
        }
        
        const authors = await Novel.aggregate([
            { $match: query },
            { 
                $group: { 
                    _id: '$authorName',
                    urduName: { $first: '$authorNameUrdu' },
                    novelsCount: { $sum: 1 },
                    latestNovel: { $last: '$title' },
                    latestNovelDate: { $last: '$createdAt' }
                } 
            },
            { $sort: { latestNovelDate: -1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        ]);
        
        const total = (await Novel.distinct('authorName', query)).length;
        
        res.status(200).json({
            success: true,
            count: authors.length,
            total,
            authors
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Author Details
router.get('/authors/:name', authAdmin, async (req, res) => {
    try {
        const authorName = decodeURIComponent(req.params.name);
        const novels = await Novel.find({ authorName })
            .sort({ createdAt: -1 })
            .select('title titleUrdu coverImage category createdAt');
            
        if (novels.length === 0) {
            return res.status(404).json({ success: false, message: 'Author not found' });
        }
        
        const author = {
            name: authorName,
            urduName: novels[0].authorNameUrdu,
            novelsCount: novels.length,
            novels
        };
        
        res.status(200).json({
            success: true,
            author
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get All Categories
router.get('/categories', authAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        const query = {};
        
        if (search) {
            query.category = { $regex: search, $options: 'i' };
        }
        
        const categories = await Novel.aggregate([
            { $match: query },
            { 
                $group: { 
                    _id: '$category',
                    novelsCount: { $sum: 1 },
                    latestNovel: { $last: '$title' },
                    latestNovelDate: { $last: '$createdAt' }
                } 
            },
            { $sort: { latestNovelDate: -1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        ]);
        
        const total = (await Novel.distinct('category', query)).length;
        
        res.status(200).json({
            success: true,
            count: categories.length,
            total,
            categories
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Category Details
router.get('/categories/:name', authAdmin, async (req, res) => {
    try {
        const categoryName = decodeURIComponent(req.params.name);
        const novels = await Novel.find({ category: categoryName })
            .sort({ createdAt: -1 })
            .select('title titleUrdu coverImage authorName createdAt');
            
        if (novels.length === 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        
        res.status(200).json({
            success: true,
            category: {
                name: categoryName,
                novelsCount: novels.length,
                novels
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Admin Profile
router.get('/profile', authAdmin, async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            admin: req.admin
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update Admin Profile
router.put('/profile', authAdmin, async (req, res) => {
    try {
        const { name, email } = req.body;
        
        const admin = await Admin.findById(req.admin._id);
        
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }
        
        admin.name = name || admin.name;
        
        if (email && email !== admin.email) {
            const emailExists = await Admin.findOne({ email });
            
            if (emailExists) {
                return res.status(400).json({ success: false, message: 'Email already in use' });
            }
            
            admin.email = email;
        }
        
        await admin.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully',
            admin
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Change Password
router.put('/change-password', authAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new password' });
        }
        
        const admin = await Admin.findById(req.admin._id).select('+password');
        
        if (!(await admin.correctPassword(currentPassword, admin.password))) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        
        admin.password = newPassword;
        await admin.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Password changed successfully'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get System Settings
router.get('/settings', authAdmin, async (req, res) => {
    try {
        // In a real app, you would get these from a settings model or config
        const settings = {
            siteTitle: 'Urdu Novels',
            siteLanguage: 'English',
            timeZone: '(UTC+05:00) Islamabad, Karachi',
            dateFormat: 'F j, Y',
            readingMode: 'light',
            fontSize: 'medium',
            showProgress: true,
            showPercentage: true,
            siteStatus: 'online',
            maintenanceMessage: "We're currently performing maintenance. We'll be back soon!"
        };
        
        res.status(200).json({
            success: true,
            settings
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update System Settings
router.put('/settings', authAdmin, async (req, res) => {
    try {
        // In a real app, you would save these to a settings model or config
        const {
            siteTitle,
            siteLanguage,
            timeZone,
            dateFormat,
            readingMode,
            fontSize,
            showProgress,
            showPercentage,
            siteStatus,
            maintenanceMessage
        } = req.body;
        
        // Here you would typically save these settings to your database
        // For now, we'll just return them
        
        res.status(200).json({ 
            success: true, 
            message: 'Settings updated successfully',
            settings: req.body
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;