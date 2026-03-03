import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Image as ImageIcon, Wand2, Loader2, Download, RefreshCw, X, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STYLES = [
  {
    id: 'corporate',
    name: 'Corporate Grey',
    description: 'Professional corporate headshot, neutral grey seamless backdrop, studio lighting, business attire.',
    color: 'bg-slate-100 text-slate-900 border-slate-200'
  },
  {
    id: 'tech',
    name: 'Modern Tech Office',
    description: 'Professional headshot, blurred modern tech office background, natural window lighting, smart casual attire.',
    color: 'bg-blue-50 text-blue-900 border-blue-200'
  },
  {
    id: 'outdoor',
    name: 'Outdoor Natural',
    description: 'Professional headshot, outdoor natural lighting, blurred greenery background, approachable and friendly.',
    color: 'bg-emerald-50 text-emerald-900 border-emerald-200'
  },
  {
    id: 'creative',
    name: 'Creative Studio',
    description: 'Professional headshot, creative studio environment, dramatic lighting, stylish and modern.',
    color: 'bg-purple-50 text-purple-900 border-purple-200'
  }
];

type AppState = 'upload' | 'style-select' | 'generating' | 'result';

export default function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [sourceImage, setSourceImage] = useState<{ data: string; mimeType: string; url: string } | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        const [prefix, base64Data] = result.split(',');
        const mimeType = prefix.match(/:(.*?);/)?.[1] || file.type;
        setSourceImage({
          data: base64Data,
          mimeType: mimeType,
          url: result
        });
        setAppState('style-select');
      }
    };
    reader.readAsDataURL(file);
  };

  const generateHeadshot = async () => {
    if (!sourceImage || !selectedStyle) return;
    
    setAppState('generating');
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const styleDesc = STYLES.find(s => s.id === selectedStyle)?.description || selectedStyle;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: sourceImage.data,
                mimeType: sourceImage.mimeType,
              },
            },
            {
              text: `Transform this casual selfie into a professional headshot. Keep the person's face and identity exactly the same. Change the background, lighting, and clothing to match this style: ${styleDesc}. Ensure it looks like a high-quality professional photograph.`,
            },
          ],
        },
      });
      
      let base64Image = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
      
      if (base64Image) {
        setGeneratedImage(`data:image/jpeg;base64,${base64Image}`);
        setAppState('result');
      } else {
        throw new Error('No image generated');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate headshot');
      setAppState('style-select');
    }
  };

  const editImage = async () => {
    if (!generatedImage || !editPrompt.trim()) return;
    
    setIsEditing(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const [prefix, base64Data] = generatedImage.split(',');
      const mimeType = prefix.match(/:(.*?);/)?.[1] || 'image/jpeg';
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: editPrompt,
            },
          ],
        },
      });
      
      let newBase64Image = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          newBase64Image = part.inlineData.data;
          break;
        }
      }
      
      if (newBase64Image) {
        setGeneratedImage(`data:${mimeType};base64,${newBase64Image}`);
        setEditPrompt('');
      } else {
        throw new Error('No image generated during edit');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to edit image');
    } finally {
      setIsEditing(false);
    }
  };

  const resetApp = () => {
    setAppState('upload');
    setSourceImage(null);
    setSelectedStyle('');
    setGeneratedImage(null);
    setEditPrompt('');
    setError(null);
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `headshot-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-900 text-white rounded-lg flex items-center justify-center">
            <ImageIcon size={18} />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">AI Headshot Pro</h1>
        </div>
        {appState !== 'upload' && (
          <button 
            onClick={resetApp}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Start Over
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 flex flex-col">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 flex items-start gap-3">
            <X className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {appState === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-semibold tracking-tight mb-3">Professional Headshots in Seconds</h2>
                <p className="text-neutral-500 text-lg">Upload a casual selfie and let AI transform it into a polished, professional headshot.</p>
              </div>

              <div 
                className={`w-full aspect-video md:aspect-[21/9] rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center p-8 text-center cursor-pointer
                  ${isDragging ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-600">
                  <Upload size={28} />
                </div>
                <h3 className="text-lg font-medium mb-1">Click to upload or drag and drop</h3>
                <p className="text-sm text-neutral-500">SVG, PNG, JPG or GIF (max. 10MB)</p>
              </div>
            </motion.div>
          )}

          {appState === 'style-select' && sourceImage && (
            <motion.div 
              key="style-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col md:flex-row gap-8"
            >
              {/* Left: Source Image Preview */}
              <div className="w-full md:w-1/3 flex flex-col gap-4">
                <h3 className="font-medium text-neutral-500 uppercase tracking-wider text-xs">Your Photo</h3>
                <div className="bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm">
                  <img 
                    src={sourceImage.url} 
                    alt="Source" 
                    className="w-full aspect-[3/4] object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Right: Style Selection */}
              <div className="w-full md:w-2/3 flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-2">Choose your style</h2>
                  <p className="text-neutral-500">Select the environment and lighting for your professional headshot.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group
                        ${selectedStyle === style.id 
                          ? 'border-neutral-900 ring-1 ring-neutral-900 bg-white shadow-md' 
                          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'}`}
                    >
                      <div className={`w-10 h-10 rounded-full mb-4 flex items-center justify-center border ${style.color}`}>
                        {selectedStyle === style.id ? <Check size={18} /> : <ImageIcon size={18} />}
                      </div>
                      <h4 className="font-semibold text-neutral-900 mb-1">{style.name}</h4>
                      <p className="text-sm text-neutral-500 leading-relaxed">{style.description}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-auto pt-6 border-t border-neutral-200 flex justify-end">
                  <button
                    onClick={generateHeadshot}
                    disabled={!selectedStyle}
                    className="bg-neutral-900 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Generate Headshot
                    <Wand2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {appState === 'generating' && (
            <motion.div 
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-neutral-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-neutral-900 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-neutral-900">
                  <Wand2 size={32} className="animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">Crafting your headshot...</h2>
              <p className="text-neutral-500 max-w-md">Our AI is analyzing your photo and applying the selected style. This usually takes 10-15 seconds.</p>
            </motion.div>
          )}

          {appState === 'result' && generatedImage && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col md:flex-row gap-8 h-full"
            >
              {/* Left: Result Image */}
              <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col items-center justify-center bg-neutral-100 rounded-3xl p-4 md:p-8 border border-neutral-200 relative">
                <img 
                  src={generatedImage} 
                  alt="Generated Headshot" 
                  className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-lg"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={downloadImage}
                  className="absolute bottom-6 right-6 bg-white text-neutral-900 p-3 rounded-full shadow-lg hover:scale-105 transition-transform border border-neutral-200 flex items-center gap-2 pr-5 font-medium text-sm"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>

              {/* Right: Editing Tools */}
              <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-2">Looking good!</h2>
                  <p className="text-neutral-500">Not quite perfect? Use the AI editor below to make adjustments.</p>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4 text-neutral-900 font-medium">
                    <Wand2 size={18} className="text-blue-600" />
                    <h3>AI Magic Edit</h3>
                  </div>
                  
                  <p className="text-sm text-neutral-500 mb-4">
                    Describe what you want to change. For example: "Add a retro filter", "Change the shirt to a blue suit", "Make the background pure white".
                  </p>

                  <div className="flex flex-col gap-3 mt-auto">
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="E.g., Add a subtle smile..."
                      className="w-full p-3 rounded-xl border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none resize-none h-28 text-sm transition-all"
                      disabled={isEditing}
                    />
                    <button
                      onClick={editImage}
                      disabled={!editPrompt.trim() || isEditing}
                      className="bg-neutral-900 text-white px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full"
                    >
                      {isEditing ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Applying Edits...
                        </>
                      ) : (
                        <>
                          Apply Edit
                          <ChevronRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
