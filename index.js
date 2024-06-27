const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");
const schedule = require("node-schedule");
const cors = require("cors");
require('./db/config');
require('dotenv').config
const User = require("./db/User");
const Task = require("./db/Task");

const AssignTask = require('./db/AssignTask');

const Jwt = require('jsonwebtoken');
const jwtkey = process.env.jwtkey;
const port = process.env.port

const app = express();
app.use(express.json());
app.use(cors());


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'taskifynow@gmail.com', // Your Gmail email address
        pass: 'whek joab zlvd ywoe' // Your Gmail password
    }
});

console.log("result")

app.post('/signup', async (req, resp) => {
    let user = new User(req.body);
    let result = await user.save();
    // Send welcome email to the user
    await sendWelcomeEmail(user.email, user.name);
    result = result.toObject()
    delete result.password;
    Jwt.sign({ result }, jwtkey, { expiresIn: "6h" }, (err, token) => {
        if (err) {
            resp.send({ result: "something went wrong" })
        }
        resp.send({ result, auth: token });
    })
});


app.post('/signin', async (req, resp) => {

    if (req.body.password && req.body.email) {
        let user = await User.findOne(req.body).select("-password");
        if (user) {
            Jwt.sign({ user }, jwtkey, { expiresIn: "6h" }, (err, token) => {
                if (err) {
                    resp.send({ result: "something went wrong" })
                }
                resp.send({ user, auth: token });
            })
        } else {
            resp.send({ result: "No user found" })
        }
    } else {
        resp.send({ result: "No user found" })
    }

})


// Function to send welcome email
async function sendWelcomeEmail(userEmail, userName) {
    try {
        await transporter.sendMail({
            from: 'taskifynow@gmail.com', // Sender email address
            to: userEmail, // Receiver email address
            subject: 'Welcome to TaskifyNow - Your Personal Task Management Solution!',
            text: `Dear ${userName},\n\nWelcome to TaskifyNow - Your Personal Task Management Solution!\n\nWe're thrilled to have you join our platform. With TaskifyNow, you can effortlessly organize your tasks, streamline your workflow, and achieve your goals with ease.\n\nHere's what you can expect from TaskifyNow:\n\n- Intuitive task management features to help you stay organized.\n- Customizable task lists and categories for better organization.\n- Deadline reminders and priority settings to stay on track.\n- Seamless collaboration with team members on shared tasks and projects.\n- Insights and analytics to track your productivity and progress over time.\n\nGet started now by logging in to your account and exploring all the features TaskifyNow has to offer. We're here to support you every step of the way on your journey towards greater productivity and success.\n\nIf you have any questions or need assistance, feel free to reach out to our support team at [support email].\n\nOnce again, welcome to TaskifyNow!\n\nBest regards,\nThe TaskifyNow Team`
        });
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
}

async function sendDeadlineReminderEmail(userEmail, userName, taskTitle, deadline) {
    try {
        if (!userEmail) {
            throw new Error('User email is undefined or null');
        }

        // Check if userEmail is a valid email address
        if (!validateEmail(userEmail)) {
            throw new Error('Invalid user email address');
        }

        // Sending reminder email
        await transporter.sendMail({
            from: 'taskifynow@gmail.com', // Sender email address
            to: userEmail, // Receiver email address
            subject: `Reminder: Task Deadline Approaching - ${taskTitle}`,
            text: `Dear ${userName},\n\nThis is a friendly reminder that the deadline for your task "${taskTitle}" is approaching. The deadline is ${new Date(deadline).toLocaleString()}.\n\nBest regards,\nTeam Taskify-Now`
        });
        console.log(`Deadline reminder email sent for task: ${taskTitle}`);
    } catch (error) {
        console.error('Error sending deadline reminder email:', error);
    }
}

// Function to validate email address
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Schedule task to check for approaching deadlines every day 
schedule.scheduleJob('0 0 14 * * *', async () => {
    try {
        // Get all tasks with deadlines within the next 24 hours or on the current date, 
        // and where a reminder email has not been sent
        const approachingTasks = await Task.find({
            $or: [
                {
                    deadline: {
                        $gte: new Date(),
                        $lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    } // Deadline within the next 24 hours
                },
                {
                    deadline: {
                        $gte: new Date().setHours(0, 0, 0, 0),
                        $lte: new Date().setHours(23, 59, 59, 999)
                    } // Deadline is today
                }
            ],
            isCompleted: false, // Exclude completed tasks
            reminderEmailSent: { $ne: true } // Exclude tasks where reminder email has already been sent
        });

        // Send reminder email for each approaching task
        for (const task of approachingTasks) {
            // Assuming userId is a valid user ID
            const user = await User.findById(task.userId);
            if (!user) {
                console.error(`User not found for task: ${task.title}`);
                continue; // Skip sending email if user not found
            }
            await sendDeadlineReminderEmail(user.email, user.name, task.title, task.deadline);

            // Update task to indicate that reminder email has been sent
            task.reminderEmailSent = true;
            await task.save();
        }
    } catch (error) {
        console.error('Error scheduling deadline reminder emails:', error);
    }
});



// create task function

app.post("/create-task", verifyToken, async (req, resp) => {
    let task = new Task(req.body);
    let result = await task.save();
    resp.send(result);
})


// Task details function of particular user

app.get('/tasks', verifyToken, async (req, resp) => {
    try {
        // Retrieve userID from query parameter
        const userId = req.query.userId;

        // Find tasks associated with the provided userID
        const tasks = await Task.find({ userId: userId });

        resp.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        resp.status(500).json({ error: 'Failed to fetch tasks' });
    }
});


// Update task progress by ID
app.put('/tasks/:id', verifyToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { isCompleted } = req.body;

        // Update the completion status of the task in the MongoDB database
        const updatedTask = await Task.findByIdAndUpdate(taskId, { isCompleted: isCompleted }, { new: true });

        if (!updatedTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Return the updated task as a response
        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating task progress:', error);
        res.status(500).json({ error: 'Failed to update task progress' });
    }
});



// Assign a task to a user by email
app.post('/assign-task', verifyToken, async (req, resp) => {
    const { title, description, deadline, email, assignedBy } = req.body;

    try {
        // Check if required fields are provided
        if (!title || !description || !deadline || !email || !assignedBy) {
            return resp.status(400).json({ message: 'Missing required fields' });
        }

        // Find the user by email
        const user = await User.findOne({ email: email });
        if (!user) {
            return resp.status(404).json({ message: 'User not found' });
        }

        // Find the user who assigned the task to get their details
        const assignedByUser = await User.findById(assignedBy);

        // Create the task with user's ID
        const assigntask = new AssignTask({
            title,
            description,
            deadline,
            userId: user._id, // Assign the _id of the user
            assignedBy: assignedByUser // Assign the user object
        });

        // Save the task to the database
        let result = await assigntask.save();

        // Send email notification to the user
        await transporter.sendMail({
            from: 'taskifynow@gmail.com',
            to: email,
            subject: 'Task Assigned',
            text: `Dear ${user.name},\n\nYou have been assigned a new task: \n ${title} \n ${description} \n Deadline Date:- ${deadline} \n Assigned by ${assignedByUser.name}.`
        });

        resp.status(201).json(result); // Respond with 201 (Created) status
    } catch (err) {
        console.error(err);
        resp.status(500).json({ message: 'Server Error' });
    }
});


app.get('/assigned-tasks', verifyToken, async (req, resp) => {
    try {
        const userId = req.query.userId;

        const assignedtasks = await AssignTask.find({
            $or: [
                { assignedBy: userId }, // Find tasks assigned by the user
                { userId: userId } // Find tasks assigned to the user
            ]
        }).populate('assignedBy', 'name')
            .populate('userId', 'name');  // Populate the 'assignedBy' field with the 'name' of the user

        resp.json(assignedtasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        resp.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.put('/assigntasks/:id', verifyToken, async (req, resp) => {
    try {
        const assigntaskId = req.params.id;
        const { isCompleted } = req.body;

        // Update the completion status of the task in the MongoDB database
        const updatedTask = await AssignTask.findByIdAndUpdate(assigntaskId, { isCompleted: isCompleted }, { new: true });

        if (!updatedTask) {
            return resp.status(404).json({ error: 'Task not found' });
        }

        // Return the updated task as a response
        resp.json(updatedTask);
    } catch (error) {
        console.error('Error updating task progress:', error);
        resp.status(500).json({ error: 'Failed to update task progress' });
    }
});


app.put('/assigned-tasks-update/:id', verifyToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.query.userId;
        const { title, description, deadline, userEmail } = req.body;

        // Ensure the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: 'Invalid task ID' });
        }

        // Find the task and ensure the requesting user is the one who assigned it
        const task = await AssignTask.findOne({
            _id: taskId,
            assignedBy: userId,
        });

        if (!task) {
            return res.status(404).json({ message: 'Task not found or not authorized to update' });
        }

        // Update task fields
        task.title = title;
        task.description = description;
        task.deadline = deadline;
        task.userEmail = userEmail;

        // Save the updated task
        await task.save();

        res.json({ message: 'Task updated successfully', task });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});


app.get("/update-task/:id", verifyToken, async (req, resp) => {
    let result = await Task.findOne({ _id: req.params.id });
    if (result) {
        resp.send(result);
    } else {
        resp.send({ result: "No record Found" });
    }
})

app.put("/update/:id", verifyToken, async (req, resp) => {
    let updatedProduct = await Task.updateOne(
        { _id: req.params.id },
        {
            $set: req.body
        }
    )

    resp.send(updatedProduct)
})

app.delete("/remove-task/:id", verifyToken, async (req, resp) => {
    const result = await Task.deleteOne({ _id: req.params.id });
    resp.send(result);
})



app.get("/searchtask/:userId/:key", verifyToken, async (req, resp) => {
    const { userId, key } = req.params;
    try {
        let result = await Task.find({
            userId, // Filter tasks based on the logged-in user's ID
            "$or": [
                { title: { $regex: key, $options: 'i' } } // Perform case-insensitive search
            ]
        });
        resp.send(result);
    } catch (error) {
        console.error('Error searching tasks:', error.message);
        resp.status(500).send({ error: 'Failed to search tasks' });
    }
});

app.get("/searchassigntask/:userId/:key", verifyToken, async (req, resp) => {
    const { userId, key } = req.params;
    try {
        let result = await AssignTask.find({
            "$and": [
                { userId: { $ne: userId } }, // Filter out tasks assigned by the current user
                {
                    "$or": [
                        { title: { $regex: key, $options: 'i' } } // Perform case-insensitive search
                    ]
                }
            ]
        });
        resp.send(result);
    } catch (error) {
        console.error('Error searching tasks:', error.message);
        resp.status(500).send({ error: 'Failed to search tasks' });
    }
});


// Update password route
app.put('/update-password', verifyToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Assuming you have middleware to extract user ID from JWT payload

    try {
        // Find the user by ID
        const user = await User.findById(userId);

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password in the database
        user.password = hashedNewPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});


// middleware function
function verifyToken(req, resp, next) {
    let token = req.headers['authorization'];
    if (token) {
        token = token.split(' ')[1];
        Jwt.verify(token, jwtkey, (err, valid) => {
            if (err) {
                resp.status(401).send({ result: "Please provide valid token" })
            } else {
                next();
            }
        });
    } else {
        resp.status(403).send({ result: "Please add token with header" })
    }
    // console.warn("middleware called", token);
}




app.listen(port);