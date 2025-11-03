import React from 'react';
import { ConnectionState } from '../types';

interface ControlsProps {
  connectionState: ConnectionState;
  onToggleConnection: () => void;
  showSettings: boolean;
}

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m12 5.25v-1.5a6 6 0 0 0-12 0v1.5m12 0a9 9 0 1 1-18 0a9 9 0 0 1 18 0Z" />
    </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 0 1 9 14.437V9.564Z" />
    </svg>
);


export const Controls: React.FC<ControlsProps> = ({ connectionState, onToggleConnection, showSettings }) => {
  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.Idle:
        return showSettings ? 'Adjust settings above or tap to start' : 'Tap to start practicing';
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
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700/50 p-4 flex flex-col items-center justify-center gap-2">
      <button
        onClick={onToggleConnection}
        disabled={isConnecting}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50 shadow-lg hover:shadow-xl
          ${isConnected ? 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 focus:ring-red-300' : 'bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 focus:ring-indigo-300'}
          ${isConnecting ? 'bg-gray-400 cursor-not-allowed animate-pulse' : ''}
        `}
      >
        {isConnected ? <StopIcon className="w-8 h-8"/> : <MicIcon className="w-8 h-8"/>}
      </button>
      <p className="text-sm text-gray-500 dark:text-gray-400 min-h-[20px]">{getStatusText()}</p>
    </div>
  );
};
