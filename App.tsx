import React, { useState, useCallback, useRef } from 'react';
import { Conversation } from './components/Conversation';
import { Controls } from './components/Controls';
import { ErrorBanner } from './components/ErrorBanner';
import { geminiService } from './services/geminiService';
import { Message, Sender, ConnectionState, Correction, AIVoice, PracticeMode } from './types';

const FREE_TALK_INSTRUCTION = `You are a friendly and patient English language tutor. Your role is to engage in natural, spoken conversation with a user who is practicing their English. Always respond conversationally first. If you notice a grammatical error or a significant mispronunciation in the user's last turn, after your conversational response, add a special correction block on a new line starting with "---CORRECTION---". This block must be a valid JSON object with four keys: "type" (a string, either "grammar" or "pronunciation"), "original" (the user's phrase with the error), "corrected" (the corrected phrase), and "explanation" (a brief, simple explanation of the correction). Do not include the marker or JSON if there are no errors.`;
const PRACTICE_MODE_INSTRUCTION = `You are an English tutor in a practice session. Your goal is to guide the user through a common conversational scenario. If the user suggests a scenario, engage with them on that topic. If they don't, you should propose one (e.g., ordering food, booking a hotel, a job interview) and then guide them through it step-by-step. Keep your responses focused on the scenario. Just like in free talk, if you notice a grammatical error or a significant mispronunciation, provide a correction after your conversational response using the "---CORRECTION---" marker followed by the JSON object.`;
const PRACTICE_STARTERS = [
    "Let's practice ordering food at a restaurant.",
    "How about we try booking a hotel room?",
    "Can we do a mock job interview?",
    "I'd like to practice asking for directions.",
    "Let's talk about our daily routines.",
    "Let's discuss plans for a trip.",
    "How about making a doctor's appointment?",
    "Can we practice shopping for clothes?",
];


function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Idle);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<AIVoice>(AIVoice.Kore);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(PracticeMode.FreeTalk);


  const currentUserTurnRef = useRef('');
  const currentAiTurnRef = useRef('');
  
  // Use separate state for rendering to avoid re-rendering on every small transcription update
  const [currentUserTurnDisplay, setCurrentUserTurnDisplay] = useState('');
  const [currentAiTurnDisplay, setCurrentAiTurnDisplay] = useState('');
  

  const handleToggleConnection = useCallback(async (starter?: string) => {
    if (connectionState === ConnectionState.Connected) {
      geminiService.close();
      setConnectionState(ConnectionState.Idle);
    } else {
      setConnectionState(ConnectionState.Connecting);
      setError(null);
      setMessages([]);
      
      let systemInstruction = FREE_TALK_INSTRUCTION;
      if (practiceMode === PracticeMode.Practice) {
          if (starter) {
              systemInstruction = `${PRACTICE_MODE_INSTRUCTION} The user wants to start with the following scenario: "${starter}". Greet them and begin the scenario immediately.`;
          } else {
              systemInstruction = PRACTICE_MODE_INSTRUCTION;
          }
      }

      geminiService.connect({
        onConnect: () => {
          setConnectionState(ConnectionState.Connected);
        },
        onUpdateInput: (text) => {
          currentUserTurnRef.current = text;
          setCurrentUserTurnDisplay(text);
        },
        onUpdateOutput: (text) => {
          currentAiTurnRef.current = text;
          setCurrentAiTurnDisplay(text);
        },
        onTurnComplete: async (input, output, correction) => {
          let correctionAudio: string | null = null;
          if (correction) {
            correctionAudio = await geminiService.getSpeech(correction.corrected, selectedVoice);
          }

          if (input) {
            setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: Sender.User, text: input, correction, correctionAudio }]);
          }
          if (output) {
            setMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: Sender.AI, text: output }]);
          }
          currentUserTurnRef.current = '';
          currentAiTurnRef.current = '';
          setCurrentUserTurnDisplay('');
          setCurrentAiTurnDisplay('');
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          setConnectionState(ConnectionState.Error);
        },
        onClose: () => {
          setConnectionState(ConnectionState.Idle);
          currentUserTurnRef.current = '';
          currentAiTurnRef.current = '';
          setCurrentUserTurnDisplay('');
          setCurrentAiTurnDisplay('');
        },
      }, selectedVoice, speechRate, systemInstruction);
    }
  }, [connectionState, selectedVoice, speechRate, practiceMode]);

  const getErrorInfo = (errorMessage: string | null): { title: string, message: string } | null => {
    if (!errorMessage) return null;

    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('api key')) {
        return { title: 'Configuration Error', message: errorMessage };
    }
    if (lowerMessage.includes('microphone')) {
        return { title: 'Microphone Access Error', message: errorMessage };
    }
    if (lowerMessage.includes('network')) {
        return { title: 'Network Error', message: errorMessage };
    }
    if (lowerMessage.includes('quota')) {
        return { title: 'Quota Exceeded', message: errorMessage };
    }
    return { title: 'Connection Error', message: errorMessage };
  }

  const errorInfo = getErrorInfo(error);
  const isSessionActive = connectionState === ConnectionState.Connecting || connectionState === ConnectionState.Connected;


  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-sm text-center">
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">AI English Speaking Practice</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Have a natural conversation to improve your fluency</p>
        
        <div className="mt-4 flex justify-center rounded-md shadow-sm" role="group">
            <button
                type="button"
                onClick={() => setPracticeMode(PracticeMode.FreeTalk)}
                disabled={isSessionActive}
                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                practiceMode === PracticeMode.FreeTalk
                    ? 'bg-blue-600 text-white ring-1 ring-inset ring-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                } border border-gray-300 dark:border-gray-600 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {PracticeMode.FreeTalk}
            </button>
            <button
                type="button"
                onClick={() => setPracticeMode(PracticeMode.Practice)}
                disabled={isSessionActive}
                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                practiceMode === PracticeMode.Practice
                    ? 'bg-blue-600 text-white ring-1 ring-inset ring-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                } border-t border-b border-r border-gray-300 dark:border-gray-600 rounded-r-md focus:z-10 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {PracticeMode.Practice}
            </button>
        </div>
        
        <div className="mt-3 flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
                <label htmlFor="voice-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Voice:</label>
                <select
                    id="voice-select"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value as AIVoice)}
                    disabled={isSessionActive}
                    className="text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {Object.values(AIVoice).map((voice) => (
                        <option key={voice} value={voice}>{voice}</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <label htmlFor="rate-slider" className="text-sm font-medium text-gray-700 dark:text-gray-300">Speed:</label>
                <input
                    id="rate-slider"
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    disabled={isSessionActive}
                    className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-8 text-center">{speechRate.toFixed(1)}x</span>
            </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col overflow-y-auto">
        {errorInfo && (
          <ErrorBanner 
            title={errorInfo.title}
            message={errorInfo.message}
            onDismiss={() => setError(null)}
          />
        )}

        {messages.length === 0 && !isSessionActive && practiceMode === PracticeMode.Practice && (
            <div className="text-center my-auto p-4">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Choose a practice scenario</h2>
                <div className="flex flex-wrap justify-center gap-3">
                    {PRACTICE_STARTERS.map((starter) => (
                        <button
                            key={starter}
                            onClick={() => handleToggleConnection(starter)}
                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        >
                            {starter}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {(messages.length > 0 || isSessionActive) && (
            <Conversation 
                messages={messages} 
                currentUserTurn={currentUserTurnDisplay}
                currentAiTurn={currentAiTurnDisplay}
                speechRate={speechRate}
            />
        )}
      </main>

      <Controls
        connectionState={connectionState}
        onToggleConnection={() => handleToggleConnection()}
      />
    </div>
  );
}

export default App;