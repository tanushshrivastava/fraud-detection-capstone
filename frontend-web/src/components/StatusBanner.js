import React from 'react';

const StatusBanner = ({ variant = 'info', title, children }) => {
  return (
    <div className={`status-banner ${variant}`}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
};

export default StatusBanner;
