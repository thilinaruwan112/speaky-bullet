
import React from 'react';
import { ConnectionState } from '../types';

interface ControlsProps {
  connectionState: ConnectionState;
  onToggleConnection: () => void;
}

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm0 12a5 5 0 0 1-5-5V5a5 5 0 0 1 10 0v6a5 5 0 0 1-5 5Z" />
        <path d="M19 11a1 1 0 0 1 1 1v2a7 7 0 1 1-14 0v-2a1 1 0 1 1 2 0v2a5 5 0 0 0 10 0v-2a1 1 0 0 1 1-1Z" />
    </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
    </svg>
);


export const Controls: React.FC<ControlsProps> = ({ connectionState, onToggleConnection }) => {
  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.Idle:
        return 'Tap to start practicing';
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Connected:
        return 'Listening...';
      case ConnectionState.Error:
        return 'Connection Error. Tap to retry.';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center justify-center gap-2">
      <button
        onClick={onToggleConnection}
        disabled={isConnecting}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50
          ${isConnected ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300' : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300'}
          ${isConnecting ? 'bg-gray-400 cursor-not-allowed animate-pulse' : ''}
        `}
      >
        {isConnected ? <StopIcon className="w-8 h-8"/> : <MicIcon className="w-8 h-8"/>}
      </button>
      <p className="text-sm text-gray-500 dark:text-gray-400">{getStatusText()}</p>
    </div>
  );
};
