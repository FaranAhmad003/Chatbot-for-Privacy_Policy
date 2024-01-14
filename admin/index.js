require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const messages = [];

io.on('connection', (socket) => {
  console.log('A user connected');

  // Send existing messages to the new user
  socket.emit('messages', messages);

  socket.on('message', async (message) => {
    try {
      const answer = await getAnswer(message.text);
      const response = { question: message.text, answer };
      messages.push(response);
      io.emit('message', response);
    } catch (error) {
      console.error(error.message);
      // Handle errors, maybe send an error message to the client
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

async function getAnswer(question) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(question);
    const response = await result.response;
    const text = await response.text();
    return text;
  } catch (error) {
    console.error('Error from Generative AI:', error);
    throw new Error('Failed to get answer from Generative AI');
  }
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
