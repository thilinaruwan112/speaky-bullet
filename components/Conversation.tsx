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
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.584 14.828a1.5 1.5 0 0 0 0-2.12l-1.414-1.414a1.5 1.5 0 1 0-2.121 2.121l1.414 1.414a1.5 1.5 0 0 0 2.121 0Zm-2.12-4.242a1.5 1.5 0 0 0-2.121-2.121L12.929 9.9a1.5 1.5 0 0 0 2.121 2.121l1.414-1.414ZM19.293 18.364a1.5 1.5 0 0 0 0-2.121l-1.414-1.414a1.5 1.5 0 0 0-2.121 2.121l1.414 1.414a1.5 1.5 0 0 0 2.121 0Zm-4.242 0a1.5 1.5 0 0 0 2.121-2.121l-1.414-1.414a1.5 1.5 0 0 0-2.121 2.121l1.414 1.414ZM19.293 5.636a1.5 1.5 0 0 0-2.121 0l-1.414 1.414a1.5 1.5 0 0 0 2.121 2.121l1.414-1.414a1.5 1.5 0 0 0 0-2.121Z" />
  </svg>
);

const GrammarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.25 4.533A9.708 9.708 0 0 0 6 3a9.708 9.708 0 0 0-5.25 1.533v13.934A9.708 9.708 0 0 0 6 21a9.708 9.708 0 0 0 5.25-1.533V4.533Zm1.5 0v13.934A9.708 9.708 0 0 0 18 21a9.708 9.708 0 0 0 5.25-1.533V4.533A9.708 9.708 0 0 0 18 3a9.708 9.708 0 0 0-5.25 1.533Z" />
  </svg>
);

const PronunciationIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9.75 4.5a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0V4.5Z" />
    <path fillRule="evenodd" d="M4.5 2.25a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h3.75a.75.75 0 0 0 0-1.5H5.25V3h13.5v3.75a.75.75 0 0 0 1.5 0V3a.75.75 0 0 0-.75-.75H4.5ZM19.5 9.75a.75.75 0 0 0-.75.75v8.036l-4.06-4.06a.75.75 0 0 0-1.06 1.06l5.25 5.25a.75.75 0 0 0 1.06 0l5.25-5.25a.75.75 0 1 0-1.06-1.06l-4.06 4.06V10.5a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" />
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
            const base64Audio = correctionAudio;
            if (base64Audio) {
                if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
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
    const bgColor = isGrammar ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30';
    const borderColor = isGrammar ? 'border-orange-300 dark:border-orange-700' : 'border-yellow-300 dark:border-yellow-700';
    const titleColor = isGrammar ? 'text-orange-800 dark:text-orange-300' : 'text-yellow-800 dark:text-yellow-300';

    return (
        <div className={`max-w-xs md:max-w-md lg:max-w-lg w-full ${bgColor} ${borderColor} border rounded-xl p-3 text-gray-800 dark:text-gray-200`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${titleColor}`} />
                <h4 className={`font-bold text-sm ${titleColor}`}>{title}</h4>
            </div>
            <div className="space-y-2 text-sm pl-7">
                <p><span className="font-semibold text-gray-500 dark:text-gray-400">You said:</span> <em className="text-red-600 dark:text-red-400">"{correction.original}"</em></p>
                <div>
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Try saying:</span>
                    <div className="flex items-center gap-2 mt-1">
                         <p className="flex-1 text-green-700 dark:text-green-300 font-medium">"{correction.corrected}"</p>
                         <button 
                            onClick={handlePlayPronunciation} 
                            disabled={isPlaying || !correctionAudio}
                            className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-wait transition-colors"
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
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2 text-white ${
          isUser ? 'bg-blue-500 rounded-br-none' : 'bg-green-600 rounded-bl-none'
        }`}
      >
        <p className="text-sm">{message.text}</p>
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
          className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2 italic text-gray-400 dark:text-gray-500 border ${
            isUser ? 'border-blue-300 dark:border-blue-800 rounded-br-none' : 'border-green-300 dark:border-green-800 rounded-bl-none'
          }`}
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