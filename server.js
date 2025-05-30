import express from 'express';
import connectDB from './config/db.js';
import dotenv from 'dotenv';
import adminRoutes from './routes/adminRoutes.js';


// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

app.use('/api/admin', adminRoutes);

// Database connection
connectDB();

;

// Error handling middleware (should be after all routes)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

