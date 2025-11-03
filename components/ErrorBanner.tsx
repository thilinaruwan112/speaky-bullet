import React from 'react';

interface ErrorBannerProps {
  title: string;
  message: string;
  onDismiss: () => void;
}

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.598 4.5H4.644C2.336 20.25.892 17.752 2.046 15.751L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
);


export const ErrorBanner: React.FC<ErrorBannerProps> = ({ title, message, onDismiss }) => {
  return (
    <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 p-4 m-4 rounded-r-lg shadow-md flex items-start" role="alert">
        <div className="flex-shrink-0 mr-3">
            <ErrorIcon className="w-5 h-5 text-red-500 dark:text-red-400" />
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
