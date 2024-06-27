const mongoose = require('mongoose');
const User = require('./User');

const assigntaskSchema = new mongoose.Schema({
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
        ref: User, // Reference to the User model
        required: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: User, // Reference to the User model
        required: true
    },
    deadline: {
        type: Date,
        required: true
    },
    isCompleted: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model("assigntasks", assigntaskSchema);
