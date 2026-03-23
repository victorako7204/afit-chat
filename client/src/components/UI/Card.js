import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  padding = 'default',
  hover = false,
  ...props 
}) => {
  const paddingSizes = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8'
  };

  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 shadow-sm 
        ${hover ? 'hover:shadow-md transition-shadow duration-200' : ''}
        ${paddingSizes[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
