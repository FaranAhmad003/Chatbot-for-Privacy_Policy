const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const speakeasy = require('speakeasy');
const session = require('express-session');

const app = express();
const port = 3000;

// Middleware to parse JSON in the request body
app.use(bodyParser.json());
app.use(
  session({
    secret: 'your-secret-key', // Change this to a secure secret key
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static(__dirname));

// MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '12345678',
  database: 'sys'
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// Serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});
app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/signup.html');
});
// Route to print the entire 'user' table
app.get('/printTable', (req, res) => {
  connection.query('SELECT * FROM user', (err, results) => {
    if (err) {
      console.error('Error fetching data from user table:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      console.log('User table data:', results);
      res.json(results);
    }
  });
});
app.get('/signupSuccess', (req, res) => {
  res.sendFile(__dirname + '/signupSuccess.html');
});
// Handle signup POST request
app.post('/signup', (req, res) => {
  const formData = req.body;

  // Check if the email ends with '@gmail.com'
  if (!formData.email.endsWith('@gmail.com')) {
    return res.status(400).json({ error: 'Invalid email address. Only Gmail addresses are allowed.' });
  }
  if (!isPasswordComplex(formData.password)) {
    return res.status(400).json({
      error: 'Password must contain at least one capital letter, one numeric character, and one special character.'
    });
  }
  const secretKey = speakeasy.generateSecret({ length: 20 }).base32;
  connection.query(
    'INSERT INTO user (first_name, last_name, username, password, email, phone_no, secret_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [formData.firstName, formData.lastName, formData.username, formData.password, formData.email, formData.phoneNo, secretKey],
    (err, results) => {
      if (err) {
        console.error('Error inserting data into user table:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        console.log('Inserted data into user table:', results);
        // Send both success message and secret key in the response
        res.json({ message: 'Signup successful!', secretKey: secretKey });
      }
    }
  );
});

function isPasswordComplex(password) {
  // Regular expressions to check for the required conditions
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumeric = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  // Check if all conditions are met
  return hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar;
}
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});
app.get('/forgotPassword', (req, res) => {
  res.sendFile(__dirname + '/forgotPasswordEmailEntry.html');
});
app.get('/otpVerification', (req, res) => {
  res.sendFile(__dirname + '/otpVerification.html');
});
app.post('/forgotPassword', (req, res) => {
  const usernameOrEmail = req.body.usernameOrEmail;

  // Query the 'user' table to check if the username or email exists
  connection.query(
    'SELECT * FROM user WHERE username = ? OR email = ?',
    [usernameOrEmail, usernameOrEmail],
    (err, results) => {
      if (err) {
        console.error('Error checking username or email:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        if (results.length > 0) {
          // User found
          const user = results[0];

          // Store the user's Google Authenticator secret key in the session (you may use a more secure storage mechanism)
          req.session.userSecretKey = user.secret_key;
          req.session.userId = user.id;

          // Generate a one-time password (OTP) using speakeasy and user's secret key
          const otp = speakeasy.totp({
            secret: user.secret_key,
            encoding: 'base32',
          });

          // You can send the OTP to the user via email or other means

          // Send a success response back to the HTML page
          res.json({ success: true });
        } else {
          // User not found
          console.log('User not found');
          res.status(404).json({ error: 'User not found' });
        }
      }
    }
  );
});
app.post('/verifyOTP', (req, res) => {
  const enteredOTP = req.body.enteredOTP;

  // Retrieve the user's Google Authenticator secret key from the session (you may use a more secure storage mechanism)
  const userSecretKey = req.session.userSecretKey;

  // Verify the entered OTP against the user's secret key
  const verificationResult = speakeasy.totp.verify({
    secret: userSecretKey,
    encoding: 'base32',
    token: enteredOTP,
  });

  if (verificationResult) {
    // OTP is valid
    console.log('OTP verification successful!');
    res.json({ success: true });
    // You can redirect the user to a password reset page or perform other actions
  } else {
    // OTP is invalid
    console.log('Invalid OTP');
    res.status(401).json({ error: 'Invalid OTP' });
  }
});
app.get('/setNewPassword', (req, res) => {
  res.sendFile(__dirname + '/setNewPassword.html');
});
app.get('/client', (req, res) => {
  res.sendFile(__dirname + '/client/client.html');
});
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin/admin.html');
});
app.post('/setNewPassword', (req, res) => {
  const newPassword = req.body.newPassword;

  // You need to identify the user for whom the password is being set
  // For example, you can use the user's session or another form of identification

  // For demonstration purposes, let's assume you have stored the user's ID in the session
  const userId = req.session.userId;

  if (userId) {
    // Update the user's password in the database
    connection.query(
      'UPDATE user SET password = ? WHERE id = ?',
      [newPassword, userId],
      (err, results) => {
        if (err) {
          console.error('Error updating password:', err);
          res.status(500).json({ error: 'Internal Server Error' });
        } else {
          console.log('Password updated successfully');
          res.json({ success: true });
        }
      }
    );
  } else {
    // User not authenticated (session expired, etc.)
    console.log('User not authenticated');
    res.status(401).json({ error: 'User not authenticated' });
  }
});
app.post('/login', (req, res) => {
  const formData = req.body;
  
  connection.query(
    'SELECT * FROM user WHERE username = ? AND password = ?',
    [formData.username, formData.password],
    (err, results) => {
      if (err) {
        console.error('Error checking login credentials:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        if (results.length > 0) {
          const user = results[0];

          // Check the user_type
          if (user.user_type === 'admin') {
            console.log('Admin logged in successfully');
            res.json({ success: true, userType: 'admin' });
          } else if (user.user_type === 'client') {
            console.log('Client logged in successfully');
            res.json({ success: true, userType: 'client' });
          } else {
            // Invalid user_type
            console.log('Invalid user_type');
            res.status(401).json({ error: 'Invalid user_type' });
          }

        } else {
          // Login failed
          console.log('Invalid username or password');
          res.status(401).json({ error: 'Invalid username or password' });
        }
      }
    }
  );
});


app.get('/loginConfirmation', (req, res) => {
  res.sendFile(__dirname + '/loginConfirmation.html');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
