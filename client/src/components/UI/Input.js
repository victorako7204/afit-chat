import React from 'react';

const Input = ({ 
  label, 
  error, 
  className = '', 
  type = 'text',
  darkMode = false,
  ...props 
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className={`block text-sm font-medium mb-1.5 ${
          darkMode ? 'text-slate-300' : 'text-gray-700'
        }`}>
          {label}
        </label>
      )}
      <input
        type={type}
        className={`w-full px-3.5 py-2 rounded-lg transition-colors duration-200 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${error 
            ? 'border-red-500 focus:ring-red-500' 
            : darkMode 
              ? 'border-slate-600 hover:border-slate-500' 
              : 'border-gray-300 hover:border-gray-400'
          }
          ${darkMode 
            ? 'bg-slate-700/50 text-slate-100 placeholder-slate-400' 
            : 'bg-white text-gray-900 placeholder-gray-400'
          }`}
        {...props}
      />
      {error && (
        <p className={`mt-1.5 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
      )}
    </div>
  );
};

export default Input;
