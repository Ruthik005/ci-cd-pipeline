const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/taskflow';

async function testConnection() {
    try {
        console.log('Testing connection to:', MONGO_URI);
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 });
        console.log('✅ Connected successfully without authentication!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
