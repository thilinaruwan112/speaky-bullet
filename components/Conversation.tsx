import React, { useEffect, useRef, useState } from 'react';
import { Message, Sender, Correction, CorrectionType } from '../types';
import { geminiService } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface ConversationProps {
  messages: Message[];
  currentUserTurn: string;
  currentAiTurn: string;
  speechRate: number;
}

const SpeakerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
  </svg>
);

const GrammarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
);

const PronunciationIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
    </svg>
);


const CorrectionCard: React.FC<{ correction: Correction, correctionAudio?: string | null, speechRate: number }> = ({ correction, correctionAudio, speechRate }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const handlePlayPronunciation = async () => {
        if (isPlaying || !correctionAudio) return;
        setIsPlaying(true);
        try {
            if (correctionAudio) {
                if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const audioBuffer = await decodeAudioData(decode(correctionAudio), audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.playbackRate.value = speechRate;
                source.connect(audioContextRef.current.destination);
                source.onended = () => setIsPlaying(false);
                source.start();
            } else {
                setIsPlaying(false);
            }
        } catch (error) {
            console.error("TTS error:", error);
            setIsPlaying(false);
        }
    };
    
    const isGrammar = correction.type === CorrectionType.Grammar;
    const title = isGrammar ? 'Grammar Correction' : 'Pronunciation Tip';
    const Icon = isGrammar ? GrammarIcon : PronunciationIcon;
    const bgColor = isGrammar ? 'bg-orange-50 dark:bg-orange-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30';
    const borderColor = isGrammar ? 'border-orange-200 dark:border-orange-700/50' : 'border-yellow-200 dark:border-yellow-700/50';
    const titleColor = isGrammar ? 'text-orange-700 dark:text-orange-300' : 'text-yellow-700 dark:text-yellow-300';
    const buttonColor = isGrammar ? 'bg-orange-500 hover:bg-orange-600' : 'bg-yellow-500 hover:bg-yellow-600';


    return (
        <div className={`max-w-xs md:max-w-md lg:max-w-lg w-full ${bgColor} ${borderColor} border rounded-xl p-3 text-gray-800 dark:text-gray-200`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${titleColor}`} />
                <h4 className={`font-semibold text-sm ${titleColor}`}>{title}</h4>
            </div>
            <div className="space-y-2 text-sm pl-7">
                <p><span className="font-semibold text-gray-500 dark:text-gray-400">You said:</span> <em className="text-red-600 dark:text-red-400 font-medium">"{correction.original}"</em></p>
                <div>
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Try saying:</span>
                    <div className="flex items-center gap-2 mt-1">
                         <p className="flex-1 text-green-700 dark:text-green-300 font-bold">"{correction.corrected}"</p>
                         <button 
                            onClick={handlePlayPronunciation} 
                            disabled={isPlaying || !correctionAudio}
                            className={`p-1.5 rounded-full text-white ${buttonColor} disabled:bg-gray-400 disabled:cursor-wait transition-colors shadow-sm`}
                            aria-label="Listen to correct pronunciation"
                         >
                             <SpeakerIcon className="w-4 h-4" />
                         </button>
                    </div>
                </div>
                <p><span className="font-semibold text-gray-500 dark:text-gray-400">Tip:</span> {correction.explanation}</p>
            </div>
        </div>
    );
};


const ChatBubble: React.FC<{ message: Message; speechRate: number }> = ({ message, speechRate }) => {
  const isUser = message.sender === Sender.User;
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2.5 shadow-sm
          ${
            isUser 
            ? 'bg-indigo-500 text-white rounded-br-none' 
            : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-600'
          }`}
      >
        <p className="text-sm leading-relaxed">{message.text}</p>
      </div>
      {isUser && message.correction && (
          <CorrectionCard correction={message.correction} correctionAudio={message.correctionAudio} speechRate={speechRate}/>
      )}
    </div>
  );
};

const InProgressBubble: React.FC<{ text: string, sender: Sender }> = ({ text, sender }) => {
    if (!text) return null;
    const isUser = sender === Sender.User;
    return (
      <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2.5 italic text-gray-400 dark:text-gray-500 border
            ${isUser ? 'border-indigo-200 dark:border-indigo-800/50 rounded-br-none' : 'border-gray-200 dark:border-gray-700/50 rounded-bl-none'}
          `}
        >
          <p className="text-sm">{text}</p>
        </div>
      </div>
    );
  };


export const Conversation: React.FC<ConversationProps> = ({ messages, currentUserTurn, currentAiTurn, speechRate }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentUserTurn, currentAiTurn]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} speechRate={speechRate} />
      ))}
      <InProgressBubble text={currentUserTurn} sender={Sender.User} />
      <InProgressBubble text={currentAiTurn} sender={Sender.AI} />
    </div>
  );
};
