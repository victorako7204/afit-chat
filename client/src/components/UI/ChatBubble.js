import React from 'react';

const ChatBubble = ({ message, isOwn, sender, timestamp, isAnonymous = false }) => {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 animate-fade-in`}>
      <div 
        className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl shadow-sm ${
          isOwn 
            ? 'bg-blue-600 text-white rounded-br-md' 
            : isAnonymous
              ? 'bg-gray-100 text-gray-800 rounded-bl-md border border-gray-200'
              : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
        }`}
      >
        {!isOwn && !isAnonymous && sender && (
          <p className="text-xs font-semibold mb-1 opacity-80">{sender}</p>
        )}
        {isAnonymous && !isOwn && (
          <p className="text-xs font-semibold mb-1 text-gray-500">Anonymous</p>
        )}
        <p className="text-sm leading-relaxed break-words">{message}</p>
        <p className={`text-xs mt-1.5 ${isOwn ? 'text-blue-100' : 'text-gray-400'} text-right`}>
          {timestamp}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
