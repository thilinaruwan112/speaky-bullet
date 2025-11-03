import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { Correction, CorrectionType, AIVoice } from '../types';

let sessionPromise: Promise<LiveSession> | null = null;

// Audio context for user input
let inputAudioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;

// Audio context for AI output
let outputAudioContext: AudioContext | null = null;
let outputNode: GainNode | null = null;
let nextStartTime = 0;
const sources = new Set<AudioBufferSourceNode>();

interface ConnectCallbacks {
  onConnect: () => void;
  onUpdateInput: (text: string) => void;
  onUpdateOutput: (text: string) => void;
  onTurnComplete: (input: string, output: string, correction?: Correction) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

async function connect(callbacks: ConnectCallbacks, voice: AIVoice, speechRate: number, systemInstruction: string) {
  if (!process.env.API_KEY) {
    callbacks.onError('An API key is required, but it has not been configured.');
    return;
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Initialize output audio context
  outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  outputNode = outputAudioContext.createGain();
  outputNode.connect(outputAudioContext.destination);
  nextStartTime = 0;

  let currentInputTranscription = '';
  let currentOutputTranscription = '';

  sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: async () => {
        // Initialize input audio context and microphone stream
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          mediaStreamSource = inputAudioContext.createMediaStreamSource(mediaStream);
          scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            if (sessionPromise) {
               sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            }
          };

          mediaStreamSource.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
          callbacks.onConnect();
        } catch (err) {
            callbacks.onError('Failed to get microphone access. Please allow microphone permission in your browser settings.');
            close();
        }
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.inputTranscription) {
            currentInputTranscription += message.serverContent.inputTranscription.text;
            callbacks.onUpdateInput(currentInputTranscription);
        }
        if (message.serverContent?.outputTranscription) {
            currentOutputTranscription += message.serverContent.outputTranscription.text;
            callbacks.onUpdateOutput(currentOutputTranscription);
        }
        if (message.serverContent?.turnComplete) {
            const correctionMarker = '---CORRECTION---';
            let conversationalText = currentOutputTranscription;
            let correction: Correction | undefined = undefined;

            const correctionIndex = conversationalText.indexOf(correctionMarker);
            if (correctionIndex !== -1) {
              const jsonString = conversationalText.substring(correctionIndex + correctionMarker.length);
              conversationalText = conversationalText.substring(0, correctionIndex).trim();
              try {
                const parsedJson = JSON.parse(jsonString);
                if (parsedJson.original && parsedJson.corrected && parsedJson.explanation && parsedJson.type && 
                    (parsedJson.type === CorrectionType.Grammar || parsedJson.type === CorrectionType.Pronunciation)) {
                  correction = parsedJson;
                }
              } catch (e) {
                console.error("Failed to parse correction JSON:", e);
              }
            }

            callbacks.onTurnComplete(currentInputTranscription, conversationalText, correction);
            currentInputTranscription = '';
            currentOutputTranscription = '';
        }

        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && outputAudioContext && outputNode) {
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.playbackRate.value = speechRate;
            source.connect(outputNode);
            source.addEventListener('ended', () => {
              sources.delete(source);
            });
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration / speechRate;
            sources.add(source);
        }

        if (message.serverContent?.interrupted) {
          for (const source of sources.values()) {
            source.stop();
          }
          sources.clear();
          nextStartTime = 0;
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error('Gemini session error:', e);
        let errorMessage = 'A connection error occurred. Please try again later.';
        if (e.message) {
            const lowerMessage = e.message.toLowerCase();
            if (lowerMessage.includes('api key not valid') || lowerMessage.includes('invalid api key')) {
                errorMessage = 'The configured API key is invalid or has expired.';
            } else if (lowerMessage.includes('network') || !navigator.onLine) {
                errorMessage = 'Network connection error. Please check your internet connection and try again.';
            } else if (lowerMessage.includes('resource has been exhausted')) {
                errorMessage = 'You have exceeded your API quota. Please check your usage limits.';
            }
        }
        callbacks.onError(errorMessage);
        close();
      },
      onclose: (e: CloseEvent) => {
        callbacks.onClose();
        cleanUpResources();
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
      systemInstruction: systemInstruction,
    },
  });
}

function cleanUpResources() {
    // Stop microphone stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    // Disconnect and close input audio context
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource = null;
    }
    if (inputAudioContext && inputAudioContext.state !== 'closed') {
        inputAudioContext.close();
        inputAudioContext = null;
    }
    // Stop any playing audio and close output audio context
    for (const source of sources.values()) {
        source.stop();
    }
    sources.clear();
    if (outputAudioContext && outputAudioContext.state !== 'closed') {
        outputAudioContext.close();
        outputAudioContext = null;
    }
    outputNode = null;
}


async function close() {
    if (sessionPromise) {
        const session = await sessionPromise;
        session.close();
        sessionPromise = null;
    }
    cleanUpResources();
}

async function getSpeech(text: string, voice: AIVoice): Promise<string | null> {
  if (!process.env.API_KEY) {
    console.error('API key not found for TTS.');
    return null;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Say this clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
  } catch (error) {
    console.error('Text-to-speech generation failed:', error);
    return null;
  }
}

async function generateOpeningText(scenario: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error('An API key is required, but it has not been configured.');
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let prompt: string;
    if (scenario === 'pronunciation') {
        prompt = `You are an English pronunciation coach. Start a practice session. Greet the user and provide the very first short sentence or tongue twister for them to pronounce. Your response must be only the words you would speak. For example: "Hi there! Let's work on your pronunciation. Please say this for me: 'How now, brown cow?'" Be concise and friendly.`;
    } else {
        prompt = `You are an English tutor. Start a practice conversation about "${scenario}". Greet the user and ask the first direct question to begin the role-play. Your response must be only the words you would speak. Be concise and friendly.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error('Failed to generate opening text:', error);
        // Provide a reliable fallback if the API call fails
        if (scenario === 'pronunciation') {
             return "Hello! Let's practice your pronunciation. Please say: 'She sells seashells by the seashore.'";
        }
        return `Hello! Let's practice "${scenario}". Are you ready to start?`;
    }
}


export const geminiService = { connect, close, getSpeech, generateOpeningText };
