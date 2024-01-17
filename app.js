const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const speakeasy = require("speakeasy");
const session = require("express-session");
const http = require("http");
const socketIO = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { setUsername, getUsername } = require("./userdata");
const fs = require("fs");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const path = require("path");
const nodemailer = require("nodemailer");

require("dotenv").config(); // Load environment variables
const port = 3000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing in the environment variables.");
  process.exit(1); // Exit the application if the API key is missing
}

//pdf
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(apiKey);

// Middleware to parse JSON in the request body
app.use(bodyParser.json());
app.use(
  session({
    secret: "your-secret-key", // Change this to a secure secret key
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static(__dirname));

// MySQL connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345678",
  database: "sys",
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

// Serve the HTML page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});
app.get("/signup", (req, res) => {
  res.sendFile(__dirname + "/signup.html");
});
// Route to print the entire 'user' table
app.get("/printTable", (req, res) => {
  connection.query("SELECT * FROM user", (err, results) => {
    if (err) {
      console.error("Error fetching data from user table:", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      console.log("User table data:", results);
      res.json(results);
    }
  });
});
app.get("/signupSuccess", (req, res) => {
  res.sendFile(__dirname + "/signupSuccess.html");
});
// Handle signup POST request
app.post("/signup", (req, res) => {
  const formData = req.body;

  // Check if the email ends with '@gmail.com'
  const allowedDomains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "lhr.nu.edu.pk",
    "icloud.com",
  ];
  const emailDomain = formData.email.split("@")[1];
  if (!allowedDomains.includes(emailDomain)) {
    return res.status(400).json({
      error: "Invalid email address. Only Gmail addresses are allowed.",
    });
  }
  if (!isPasswordComplex(formData.password)) {
    return res.status(400).json({
      error:
        "Password must contain at least one capital letter, one numeric character, and one special character.",
    });
  }

  const secretKey = speakeasy.generateSecret({ length: 20 }).base32;
  connection.query(
    "INSERT INTO user (first_name, last_name, username, password, email, phone_no, secret_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      formData.firstName,
      formData.lastName,
      formData.username,
      formData.password,
      formData.email,
      formData.phoneNo,
      secretKey,
    ],
    (err, results) => {
      if (err) {
        console.error("Error inserting data into user table:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        console.log("Inserted data into user table:", results);
        // Send both success message and secret key in the response
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "chatbotx092@gmail.com",
            pass: "vlep zify kiem sntq", // Replace with your actual App Password
          },
        });

        const mailOptions = {
          from: "chatbotx092@gmail.com",
          to: formData.email,
          subject: "Your Secret Key",
          html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        /* Your CSS styles here */
      </style>
    </head>
    <body>
      <h1>Welcome, ${formData.firstName}!</h1>
      <p>Your signup was successful.</p>
      <p>Here's your secret key: ${secretKey}</p>
      <p>Keep this key safe.</p>
    </body>
    </html>
  `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(error);
          } else {
            console.log("Email sent:", info.response);
          }
        });
        res.json({ message: "Signup successful!", secretKey: secretKey });
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
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});
app.get("/forgotPassword", (req, res) => {
  res.sendFile(__dirname + "/forgotPasswordEmailEntry.html");
});
app.get("/otpVerification", (req, res) => {
  res.sendFile(__dirname + "/otpVerification.html");
});
app.post("/forgotPassword", (req, res) => {
  const usernameOrEmail = req.body.usernameOrEmail;

  // Query the 'user' table to check if the username or email exists
  connection.query(
    "SELECT * FROM user WHERE username = ? OR email = ?",
    [usernameOrEmail, usernameOrEmail],
    (err, results) => {
      if (err) {
        console.error("Error checking username or email:", err);
        res.status(500).json({ error: "Internal Server Error" });
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
            encoding: "base32",
          });

          // You can send the OTP to the user via email or other means

          // Send a success response back to the HTML page
          res.json({ success: true });
        } else {
          // User not found
          console.log("User not found");
          res.status(404).json({ error: "User not found" });
        }
      }
    }
  );
});
app.post("/verifyOTP", (req, res) => {
  const enteredOTP = req.body.enteredOTP;
  const userSecretKey = req.session.userSecretKey;
  const verificationResult = speakeasy.totp.verify({
    secret: userSecretKey,
    encoding: "base32",
    token: enteredOTP,
  });
  if (verificationResult) {
    // OTP is valid
    console.log("OTP verification successful!");
    res.json({ success: true });
  } else {
    // OTP is invalid
    console.log("Invalid OTP");
    res.status(401).json({ error: "Invalid OTP" });
  }
});
app.get("/setNewPassword", (req, res) => {
  res.sendFile(__dirname + "/setNewPassword.html");
});
app.get("/client", (req, res) => {
  const username = getUsername(); // Replace this with your actual logic to get the username
  const adminHtml = fs.readFileSync(__dirname + "/client/client.html", "utf8");
  const updatedHtml = adminHtml.replace("<%= username %>", username);
  res.send(updatedHtml);
});
app.get("/admin", (req, res) => {
  const username = getUsername(); // Replace this with your actual logic to get the username
  const adminHtml = fs.readFileSync(__dirname + "/admin/admin.html", "utf8");
  const updatedHtml = adminHtml.replace("<%= username %>", username);
  res.send(updatedHtml);
});

app.post("/setNewPassword", (req, res) => {
  const newPassword = req.body.newPassword;
  const userId = req.session.userId;

  if (userId) {
    // Update the user's password in the database
    connection.query(
      "UPDATE user SET password = ? WHERE id = ?",
      [newPassword, userId],
      (err, results) => {
        if (err) {
          console.error("Error updating password:", err);
          res.status(500).json({ error: "Internal Server Error" });
        } else {
          console.log("Password updated successfully");
          res.json({ success: true });
        }
      }
    );
  } else {
    // User not authenticated (session expired, etc.)
    console.log("User not authenticated");
    res.status(401).json({ error: "User not authenticated" });
  }
});
let name;

app.post("/login", (req, res) => {
  const formData = req.body;

  connection.query(
    "SELECT * FROM user WHERE username = ? AND password = ?",
    [formData.username, formData.password],
    (err, results) => {
      if (err) {
        console.error("Error checking login credentials:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      if (results.length > 0) {
        const user = results[0];
        setUsername(formData.username);
        name = formData.username;

        if (user.user_type === "admin") {
          console.log("Admin logged in successfully:", getUsername());
          //session
          req.session.userInfo = {
            username: formData.username,
            user_type: "admin",
          };

          return res.json({ success: true, userType: "admin" });
        } else if (user.user_type === "client") {
          // Client logged in successfully
          console.log("Client logged in successfully:", getUsername());

          // Store user information in the session
          req.session.userInfo = {
            username: formData.username,
            user_type: "client",
          };

          return res.json({
            success: true,
            userType: "client",
            username: formData.username,
          });
        } else {
          // Invalid user_type
          console.log("Invalid user_type");
          return res.status(401).json({ error: "Invalid user_type" });
        }
      } else {
        // Login failed
        console.log("Invalid username or password");
        return res.status(401).json({ error: "Invalid username or password" });
      }
    }
  );
});

//==================PDF Parser
app.post("/upload", upload.single("pdfFile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const buffer = req.file.buffer;

    // Parse PDF
    pdfParse(buffer)
      .then((data) => {
        // Log the parsed data
        console.log(data);

        // Send the extracted text back to the client as plain text
        res.send(data.text);

        // Use the parsed text in the run function
        run(data.text);
      })
      .catch((error) => {
        console.error("Error parsing PDF:", error);
        res.status(500).send("Error parsing PDF.");
      });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error.");
  }
});

async function run(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt + "what is this about?");

    if (result && result.response) {
      const response = await result.response;
      const text = await response.text();
      console.log(text);
    } else {
      console.error("Invalid response structure:", result);
    }
  } catch (error) {
    console.error("Error in run function:", error);
  }
}

//==========================================

app.get("/loginConfirmation", (req, res) => {
  res.sendFile(__dirname + "/loginConfirmation.html");
});
io.on("connection", (socket) => {
  console.log("User connected");

  // You can handle chat connections here, passing necessary data
  // For example, you might want to pass the user information from the session
  const userId = req.session.userId; // Assuming you store user ID in the session

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});
// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
//==================================================


//client response here for every question here
app.get("/ask", async (req, res) => {
  const question = req.query.question;

  if (!question) {
    res.status(400).json({ error: "Invalid question" });
    return;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(question);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});