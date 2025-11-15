import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo SVG */}
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Circle border */}
          <circle cx="512" cy="512" r="450" stroke="#2D7A5F" strokeWidth="40" fill="none"/>
          
          {/* Medical cross */}
          <path d="M314 226H490V402H666V578H490V754H314V578H138V402H314V226Z" fill="#1A5A42"/>
          
          {/* Curved line through cross */}
          <path d="M320 240C320 240 380 340 420 440C460 540 480 640 520 740" 
                stroke="#EF4444" strokeWidth="30" strokeLinecap="round" fill="none"/>
          
          {/* Heartbeat/ECG line */}
          <path d="M612 440L662 340L712 540L762 240L812 440L862 440" 
                stroke="#EF4444" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          
          {/* HASET text banner - curved to fit circle */}
          <rect x="180" y="700" width="664" height="140" rx="70" fill="#EF4444"/>
          <text x="512" y="800" fontFamily="Arial, sans-serif" fontSize="120" fontWeight="bold" 
                fill="white" textAnchor="middle" dominantBaseline="middle">HASET</text>
        </svg>
      </div>
      
      {/* Optional text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-gray-900 ${textSizeClasses[size]} leading-tight`}>
            HASET
          </span>
          <span className="text-xs text-gray-600 uppercase tracking-wide">
            Hospital Management
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
