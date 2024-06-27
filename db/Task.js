const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true
    },
    deadline: {
        type: Date, // Assuming the deadline is a date type
        required: true // Assuming the deadline is required
    },
    isCompleted: {
        type: Boolean,
        default: false // Default value is false, assuming tasks start as incomplete
    }
});

module.exports = mongoose.model("tasks", taskSchema);
