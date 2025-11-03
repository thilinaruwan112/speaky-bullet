import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation } from './components/Conversation';
import { Controls } from './components/Controls';
import { ErrorBanner } from './components/ErrorBanner';
import { geminiService } from './services/geminiService';
import { Message, Sender, ConnectionState, AIVoice, PracticeMode } from './types';
import { decode, decodeAudioData } from './utils/audioUtils';

const FREE_TALK_INSTRUCTION = `You are a friendly and patient English language tutor. Your role is to engage in natural, spoken conversation with a user who is practicing their English. Always respond conversationally first. If you notice a grammatical error or a significant mispronunciation in the user's last turn, after your conversational response, add a special correction block on a new line starting with "---CORRECTION---". This block must be a valid JSON object with four keys: "type" (a string, either "grammar" or "pronunciation"), "original" (the user's phrase with the error), "corrected" (the corrected phrase), and "explanation" (a brief, simple explanation of the correction). Do not include the marker or JSON if there are no errors.`;
const PRACTICE_MODE_INSTRUCTION = `You are an English tutor in a practice session. Your goal is to guide the user through a common conversational scenario. If the user suggests a scenario, engage with them on that topic. If they don't, you should propose one (e.g., ordering food, booking a hotel, a job interview) and then guide them through it step-by-step. Keep your responses focused on the scenario. Just like in free talk, if you notice a grammatical error or a significant mispronunciation, provide a correction after your conversational response using the "---CORRECTION---" marker followed by the JSON object.`;
const PRONUNCIATION_PRACTICE_INSTRUCTION = `You are a dedicated English pronunciation coach. Your only role is to help the user improve their pronunciation. Do not engage in long conversations. 1. Provide the user with a single word, phrase, or short tongue-twister to pronounce. 2. Listen to the user's attempt. 3. Provide immediate, concise feedback. 4. If there is a mispronunciation, ALWAYS provide a correction using the "---CORRECTION---" marker followed by a valid JSON object. The "type" must be "pronunciation". The "explanation" should be simple, focusing on mouth shape, tongue placement, or sound. 5. After providing feedback, give the user a new word or phrase to try. Keep the cycle of practice going.`;

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
  const [isStartingPractice, setIsStartingPractice] = useState(false);

  const currentUserTurnRef = useRef('');
  const currentAiTurnRef = useRef('');
  
  const [currentUserTurnDisplay, setCurrentUserTurnDisplay] = useState('');
  const [currentAiTurnDisplay, setCurrentAiTurnDisplay] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    return () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };
  }, []);

  const playAudio = async (base64Audio: string, rate: number) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
       audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    try {
      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = rate;
      source.connect(ctx.destination);
      source.start();
      return new Promise(resolve => source.onended = resolve);
    } catch (e) {
      console.error("Failed to play audio:", e);
      setError("An error occurred while trying to play audio.");
    }
  }

  const handleToggleConnection = useCallback(async (starter?: string) => {
    if (connectionState === ConnectionState.Connected) {
      geminiService.close();
      return;
    } 
    
    setConnectionState(ConnectionState.Connecting);
    setError(null);
    setMessages([]);
    
    let systemInstruction: string;
    
    if (practiceMode === PracticeMode.Practice && starter) {
        setIsStartingPractice(true);
        try {
            const openingText = await geminiService.generateOpeningText(starter);
            const openingAudio = await geminiService.getSpeech(openingText, selectedVoice);

            if (openingText && openingAudio) {
               setMessages([{ id: `ai-starter-${Date.now()}`, sender: Sender.AI, text: openingText }]);
               await playAudio(openingAudio, speechRate);
            }
            
            systemInstruction = `${PRACTICE_MODE_INSTRUCTION} The scenario is "${starter}". You have already started the conversation by saying: "${openingText}". Now, listen for the user's reply and continue the conversation.`;

        } catch (e: any) {
          setError(`Failed to start the practice session: ${e.message}`);
          setConnectionState(ConnectionState.Error);
          setIsStartingPractice(false);
          return;
        } finally {
          setIsStartingPractice(false);
        }
    } else if (practiceMode === PracticeMode.PronunciationPractice) {
        setIsStartingPractice(true);
        try {
            const openingText = await geminiService.generateOpeningText("pronunciation");
            const openingAudio = await geminiService.getSpeech(openingText, selectedVoice);

            if (openingText && openingAudio) {
               setMessages([{ id: `ai-starter-${Date.now()}`, sender: Sender.AI, text: openingText }]);
               await playAudio(openingAudio, speechRate);
            }
            
            systemInstruction = `${PRONUNCIATION_PRACTICE_INSTRUCTION} You have already started the session by asking the user to say: "${openingText}". Now, listen to their attempt and provide feedback.`;
        } catch (e: any) {
          setError(`Failed to start the practice session: ${e.message}`);
          setConnectionState(ConnectionState.Error);
          setIsStartingPractice(false);
          return;
        } finally {
          setIsStartingPractice(false);
        }
    } else {
        systemInstruction = FREE_TALK_INSTRUCTION;
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

        const newMessages: Message[] = [];
        if (input) {
          newMessages.push({ id: `user-${Date.now()}`, sender: Sender.User, text: input, correction, correctionAudio });
        }
        if (output) {
          newMessages.push({ id: `ai-${Date.now()}`, sender: Sender.AI, text: output });
        }
        if (newMessages.length > 0) {
          setMessages(prev => [...prev, ...newMessages]);
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
    <div className="h-screen w-screen flex flex-col font-sans bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-slate-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-4 border-b border-gray-200 dark:border-gray-700/50 shadow-sm text-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">AI English Speaking Practice</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Improve your fluency with a friendly AI tutor</p>
      </header>
      
      <main className="flex-1 flex flex-col overflow-y-auto">
        {errorInfo && (
          <ErrorBanner 
            title={errorInfo.title}
            message={errorInfo.message}
            onDismiss={() => setError(null)}
          />
        )}

        {messages.length === 0 && !isSessionActive && (
          <div className="flex-1 flex flex-col justify-center items-center p-4">
             <div className="w-full max-w-lg mx-auto">
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-center rounded-md" role="group">
                        {(Object.values(PracticeMode)).map((mode, index, array) => (
                             <button
                                key={mode}
                                type="button"
                                onClick={() => setPracticeMode(mode)}
                                disabled={isSessionActive}
                                className={`relative px-4 py-2 text-sm font-semibold transition-colors duration-200 w-full focus:z-10 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-gray-600
                                ${mode === practiceMode ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600'}
                                ${index === 0 ? 'rounded-l-lg' : ''}
                                ${index === array.length - 1 ? 'rounded-r-lg' : ''}
                                ${index > 0 ? '-ml-px' : ''}
                                `}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                    <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label htmlFor="voice-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice:</label>
                            <select
                                id="voice-select"
                                value={selectedVoice}
                                onChange={(e) => setSelectedVoice(e.target.value as AIVoice)}
                                disabled={isSessionActive}
                                className="text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50"
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
                                className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-600 accent-indigo-600 disabled:opacity-50"
                            />
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-8 text-center">{speechRate.toFixed(1)}x</span>
                        </div>
                    </div>
                 </div>
                 {practiceMode === PracticeMode.Practice && (
                    <div className="text-center mt-8">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Choose a practice scenario</h2>
                        <div className="flex flex-wrap justify-center gap-3">
                            {PRACTICE_STARTERS.map((starter) => (
                                <button
                                    key={starter}
                                    onClick={() => handleToggleConnection(starter)}
                                    disabled={isStartingPractice}
                                    className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isStartingPractice ? 'Starting...' : starter}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
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
        showSettings={messages.length === 0 && !isSessionActive}
      />
    </div>
  );
}

export default App;
