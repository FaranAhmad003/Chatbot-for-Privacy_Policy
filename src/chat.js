// chat.js

async function handleConnection(socket, io, genAI) {
  socket.on('question', async (question) => {
    // Process the user's question using the Google Generative AI
    const response = await generateResponse(question, genAI);

    // Broadcast the response back to the client
    io.emit('response', response);
  });
}

async function generateResponse(question, genAI) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent(question);
  const response = await result.response;
  return response.text();
}

module.exports = {
  handleConnection,
};
