import React from 'react';

const Textarea = ({ 
  label, 
  error, 
  className = '', 
  rows = 4,
  ...props 
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full px-3.5 py-2.5 border rounded-lg transition-colors duration-200 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'}
          bg-white text-gray-900 placeholder-gray-400 resize-none`}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Textarea;
