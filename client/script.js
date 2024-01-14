document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const messageList = document.getElementById('message-list');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');

  sendButton.addEventListener('click', () => {
    const question = messageInput.value.trim();
    if (question !== '') {
      // Emit the user's question to the server
      socket.emit('question', question);
      messageInput.value = '';
    }
  });

  socket.on('response', (response) => {
    // Display the response from the server
    const listItem = document.createElement('li');
    listItem.textContent = response;
    messageList.prepend(listItem);
  });
});
