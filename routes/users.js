const express = require('express');
const session = require('express-session');
require('dotenv').config();
const { poolPromise, sql } = require('../db'); // Import DB connection
const Redis = require('ioredis');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const axios = require('axios');
const WebSocket = require('ws');
const cors = require('cors');
const router = express.Router();
router.use(express.json());
const redisClient = new Redis({
    host: '127.0.0.1', // Update with your Redis server host
    port: 6379,        // Update with your Redis server port
});

router.use(cors({
    origin: '*', // Allow all domains (for development)
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow the methods you need
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow the headers you need
    credentials: true,
}));


// const msalConfig = {
//     auth: {
//         clientId: '644c879b-ba25-4fa0-b161-f76e20d072f8',
//         authority: process.env.MY_Auth,
//         clientSecret: process.env.MY_SECRET_KEY,
//     },
//     cache: {
//         cacheLocation: 'memory',
//     },
// };

// // Create MSAL client
// const msalClient = new ConfidentialClientApplication(msalConfig);


async function setLoginStatus(email, status) {
    const key = `login:${email}`;
    await redisClient.set(key, status, 'EX', 3600); // Set login status with a 1-hour expiration
}

async function getLoginStatus(email) {
    const key = `login:${email}`;
    return await redisClient.get(key);
}


router.post('/google-signin', async (req, res) => {
    const { accessToken } = req.body;

    try {
        // Verify Google access token
        const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
        const payload = response.data;

        if (!payload || !payload.sub || !payload.email) {
            return res.status(400).json({ error: 'Invalid access token' });
        }

        let email = payload.email;

        // Check user in DB
        const pool = await poolPromise;
        const userCheck = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE email = @email');

        let userId;
        let name = email.split('@')[0];
        if (!userCheck.recordset.length) {
            // Add new user if not exists
            const result = await pool.request()
                .input('name', sql.NVarChar, name)
                .input('email', sql.NVarChar, email)
                .input('password', sql.NVarChar, 'password')
                .query('INSERT INTO Users (name, email, password) OUTPUT INSERTED.id VALUES (@name, @email, @password)');

            userId = result.recordset[0].id;
        } else {
            // User exists, get their ID
            userId = userCheck.recordset[0].id;
            name = userCheck.recordset[0].name;
        }

        // Set login status in Redis
        await setLoginStatus(email, 'loggedIn');
        res.status(200).json({
            message: 'Google Sign-in successful',
            user: {
                id: userId,
                name: name,
                email: email
            }
        });
    } catch (error) {
        console.error('Google Sign-in error:', error.message);
        res.status(500).json({ error: `Google Sign-in error: ${error.message}` });
    }
});

// const wss = new WebSocket.Server({ port: 8080 });

// wss.on('connection', (ws) => {
//     console.log('Frontend connected to WebSocket.');

//     // Send a connection confirmation message to the connected client
//     ws.send(JSON.stringify({ message: 'Connection established, waiting for login...' }));

//     // Handle messages from the frontend
//     ws.on('message', (message) => {
//         console.log('Received message from frontend:', message); // For debugging
//     });

//     // Log client disconnect
//     ws.on('close', () => {
//         console.log('Frontend disconnected from WebSocket.');
//     });

//     // Log errors
//     ws.on('error', (error) => {
//         console.error('WebSocket Error:', error);
//     });
// });

// // Login route
// router.get('/Microsoftlogin', (req, res) => {
//     const authCodeUrlParameters = {
//         scopes: ['user.read'],
//         // redirectUri: 'https://flutterhub.centralindia.cloudapp.azure.com/api/users/Microsoftlogin/callback/',
//         redirectUri: 'http://localhost:3000/users/Microsoftlogin/callback',
//     };



//     msalClient
//         .getAuthCodeUrl(authCodeUrlParameters)
//         .then((response) => {
//             res.status(200).json({ loginUrl: response });
//         })
//         .catch((error) => {
//             console.error('Error getting auth code URL:', error);
//             res.status(500).send('Error during login');
//         });
// });

// // Callback route
// router.get('/Microsoftlogin/callback', async (req, res) => {
//     const tokenRequest = {
//         code: req.query.code,
//         scopes: ['user.read'],
//         redirectUri: 'http://localhost:3000/users/Microsoftlogin/callback',
//         // redirectUri: 'https://flutterhub.centralindia.cloudapp.azure.com/api/users/Microsoftlogin/callback/',
//     };

//     try {
//         const response = await msalClient.acquireTokenByCode(tokenRequest);
//         // console.log('Authentication successful:', response.account);

//         const email = response.account.username;
//         const name = response.account.name
//         const accessToken = response.accessToken;


//         try {
//             const pool = await poolPromise;

//             // Check if the user already exists in the database
//             const userCheck = await pool.request()
//                 .input('email', sql.NVarChar, email)
//                 .query('SELECT * FROM Users WHERE email = @email');

//             let user;
//             if (!userCheck.recordset.length) {
//                 // Create new user if not found
//                 const result = await pool.request()
//                     .input('name', sql.NVarChar, name)
//                     .input('email', sql.NVarChar, email)
//                     .input('password', sql.NVarChar, 'password') // Placeholder password
//                     .query('INSERT INTO Users (name, email, password) OUTPUT INSERTED.* VALUES (@name, @email, @password)');

//                 user = result.recordset[0];
//             } else {
//                 user = userCheck.recordset[0];
//             }

//             req.session.user = {
//                 id: user.id,
//                 name: user.name,
//                 email: user.email,
//             };

//             await setLoginStatus(email, 'loggedIn');
//             console.log("before ws")
//             wss.clients.forEach((client) => {
//                 if (client.readyState === WebSocket.OPEN) {
//                     client.send(JSON.stringify({ message: 'login Successful', user: user }));
//                 }
//             });

//             res.status(200).json({ message: 'Login successful - Return to website', });


//         } catch (err) {
//             console.error('Error during user login:', err);
//             res.status(500).json({ error: 'Internal Server Error' });
//         }

//     } catch (error) {
//         console.error('Error acquiring token:', error);
//         res.status(500).send('Error during callback');
//     }
// });

router.get('/check-session', async (req, res) => {
    const email = req.query.email; // Email should be passed in the request

    try {
        const status = await getLoginStatus(email);

        if (status === 'loggedIn') {
            // Fetch user details from the database based on email
            const pool = await poolPromise;
            const userCheck = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT id, name, email FROM Users WHERE email = @email');

            if (userCheck.recordset.length > 0) {
                // Send user details as JSON
                const user = userCheck.recordset[0];
                res.status(200).json({
                    isLoggedIn: true,
                    message: 'User is logged in',
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }
                });
            } else {
                res.status(404).json({ isLoggedIn: false, message: 'User not found in the database' });
            }
        } else {
            res.status(200).json({ isLoggedIn: false, message: 'User is not logged in' });
        }
    } catch (error) {
        console.error('Error checking session:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Logout route
router.get('/logout', async (req, res) => {
    const email = req.query.email; // Email should be passed in the request

    try {
        // Clear login status in Redis
        await redisClient.del(`login:${email}`);
        res.status(200).json({ message: 'User logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error.message);
        res.status(500).json({ error: 'Failed to log out' });
    }
});


// CREATE User
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

router.post('/create', async (req, res) => {
    // console.log(req.body);
    // console.log('Headers:', req.headers);
    const { name, email, password } = req.body;
    // console.log(name, email, password);
    // Validate email format
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    try {
        const pool = await poolPromise; // Get the database connection pool

        // Check if email exists
        const emailCheck = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT COUNT(*) AS count FROM Users WHERE email = @email');

        if (emailCheck.recordset[0].count > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Insert user into database
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, password)
            .query('INSERT INTO Users (name, email, password) OUTPUT INSERTED.id VALUES (@name, @email, @password)');

        res.status(200).json({
            message: 'User created successfully',
            user: {
                id: result.recordset[0].id,
                name: name,
                email: email,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {

        const pool = await poolPromise;

        // Check if the email exists in the database
        const userCheck = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE email = @email');

        if (!userCheck.recordset.length) {
            return res.status(400).json({ error: 'Email not found' });
        }

        const user = userCheck.recordset[0];

        // Check if the password matches (you should use a hashed password in production)
        if (user.password !== password) {
            return res.status(400).json({ error: 'Password is incorrect' });
        }


        await setLoginStatus(email, 'loggedIn');
        // Return the user info and session data
        res.status(200).json({
            message: 'Login successful',
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Error during signin:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get a single user by ID
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT * FROM users WHERE id=@id");

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(result.recordset[0]); // Return single user object
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// READ Users
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const rows = await pool.request().query('SELECT * FROM Users');
        if (rows && rows.recordset.length > 0) {
            res.status(200).json(rows.recordset);
        } else {
            res.status(404).json({ error: 'No users found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE User
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, password)
            .query('UPDATE Users SET name = @name, email = @email, password = @password WHERE id = @id');

        if (result && result.rowsAffected[0] > 0) {
            res.status(200).json({ message: 'User updated successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE User
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Users WHERE id = @id');

        if (result && result.rowsAffected[0] > 0) {
            res.status(200).json({ message: 'User deleted successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;