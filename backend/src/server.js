const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const { seedDatabase } = require('./utils/seedData');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const systemAdminRoutes = require('./routes/systemAdminRoutes');
const customerRoutes = require('./routes/customerRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const customerExpenseRoutes = require('./routes/customerExpenseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const gallaRoutes = require('./routes/gallaRoutes');
const regularRoutes = require('./routes/regularRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Load environment variables
dotenv.config();

const app = express();

// Body Parser & CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Grocery Shop Customer Expense Management System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/system-admin', systemAdminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customer-expenses', customerExpenseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/galla', gallaRoutes);
app.use('/api/regulars', regularRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/reports', reportRoutes);

// 404 Handler for undefined API routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n=============================================================`);
      console.log(`🚀 Grocery Expense Management API is running on port ${PORT}`);
      console.log(`🌐 Local URL:  http://localhost:${PORT}/api/health`);
      console.log(`🔑 Demo Accounts:`);
      console.log(`   - System Admin:  admin@system.com      / Admin@123`);
      console.log(`   - Shop Owner:    owner@freshmart.com   / Owner@123`);
      console.log(`   - Customer:      john@example.com      / Customer@123`);
      console.log(`=============================================================\n`);
    });

    return server;
  } catch (err) {
    console.error('Fatal Server Startup Error:', err);
    process.exit(1);
  }
};

// Start the server if called directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
