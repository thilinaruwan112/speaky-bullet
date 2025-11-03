import React from 'react';

interface ErrorBannerProps {
  title: string;
  message: string;
  onDismiss: () => void;
}

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);


export const ErrorBanner: React.FC<ErrorBannerProps> = ({ title, message, onDismiss }) => {
  return (
    <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 p-4 m-4 rounded-r-lg shadow-md flex items-start" role="alert">
        <div className="flex-shrink-0 mr-3">
            <ErrorIcon className="w-6 h-6 text-red-500 dark:text-red-400" />
        </div>
      <div className="flex-grow">
        <p className="font-bold">{title}</p>
        <p className="text-sm">{message}</p>
      </div>
      <div className="flex-shrink-0 ml-3">
        <button
          onClick={onDismiss}
          className="p-1 rounded-full text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/50 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label="Dismiss error message"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
