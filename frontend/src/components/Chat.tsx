import React from 'react';

const Chat: React.FC = () => {
  return (
    <div>
      <h1>AI Chat</h1>
      <div style={{ height: '400px', border: '1px solid #ccc', overflowY: 'scroll', padding: '10px' }}>
        {/* Chat messages will go here */}
      </div>
      <div style={{ display: 'flex' }}>
        <input type="text" style={{ flex: '1', padding: '10px' }} placeholder="Type your message..." />
        <button style={{ padding: '10px' }}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
