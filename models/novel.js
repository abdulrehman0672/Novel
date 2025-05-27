import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';


// Novel Schema
const novelSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Novel title is required'],
        trim: true
    },
    titleUrdu: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Novel description is required'],
        trim: true
    },
    descriptionUrdu: {
        type: String,
        trim: true
    },
    authorName: {
        type: String,
        required: [true, 'Author name is required'],
        trim: true
    },
    authorNameUrdu: {
        type: String,
        trim: true
    },
    coverImage: {
        type: String,
        required: [true, 'Cover image is required'],
        default: 'default-cover.jpg'
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: [
            'Romance',
            'Suspense',
            'Horror',
            'Historical',
            'Sci-Fi',
            'Comedy',
            'Drama',
            'Fantasy',
            'Mystery',
            'Biography'
        ]
    },
    rating: {
        type: Number,
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating must not be more than 5'],
        default: 4.5
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    chapters: [
        {
            chapterNumber: {
                type: Number,
                required: true
            },
            title: {
                type: String,
                required: [true, 'Chapter title is required']
            },
            titleUrdu: {
                type: String
            },
            content: {
                type: String,
                required: [true, 'Chapter content is required']
            },
            contentUrdu: {
                type: String
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    views: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Admin User Schema
const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'super-admin'],
        default: 'admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method to compare passwords
adminSchema.methods.correctPassword = async function(
    candidatePassword,
    userPassword
) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Update timestamp before saving novel
novelSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Novel = mongoose.model('Novel', novelSchema);
const Admin = mongoose.model('Admin', adminSchema);

export { Novel, Admin };