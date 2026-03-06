import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bot, Mic, Users, CheckSquare, BarChart3, Zap, Database, Brain, Globe, Rocket, ArrowRight, Play, Circle } from 'lucide-react';

const Presentation = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const slides = [
    {
      id: 'title',
      title: 'ACTA-AI',
      subtitle: 'Intelligent Meeting Assistant Platform',
      type: 'title'
    },
    {
      id: 'problem',
      title: 'The Challenge',
      type: 'problem',
      content: [
        { icon: '⏰', text: 'Manual note-taking wastes valuable meeting time' },
        { icon: '❓', text: 'Action items get lost in conversation' },
        { icon: '🔍', text: 'Hard to track who said what' },
        { icon: '📊', text: 'No insights into meeting effectiveness' }
      ]
    },
    {
      id: 'solution',
      title: 'Our Solution',
      type: 'features',
      features: [
        { icon: Bot, title: 'Auto-Join Meetings', desc: 'Bot joins Zoom, Meet & Teams automatically' },
        { icon: Mic, title: 'Live Transcription', desc: 'Real-time speech-to-text with 95%+ accuracy' },
        { icon: Users, title: 'Speaker ID', desc: 'Identifies who said what with timestamps' },
        { icon: CheckSquare, title: 'Smart Tasks', desc: 'AI extracts action items automatically' },
        { icon: BarChart3, title: 'Analytics', desc: 'Meeting insights and trends' },
        { icon: Zap, title: 'Integrations', desc: 'Push tasks to Jira & Trello' }
      ]
    },
    {
      id: 'architecture',
      title: 'System Architecture',
      type: 'architecture'
    },
    {
      id: 'tech',
      title: 'Technology Stack',
      type: 'tech',
      stacks: [
        { 
          category: 'Frontend',
          color: 'from-blue-500 to-cyan-500',
          items: ['React', 'Vite', 'TailwindCSS', 'Socket.IO', 'Framer Motion']
        },
        {
          category: 'Backend',
          color: 'from-green-500 to-emerald-500',
          items: ['Node.js', 'Express', 'MongoDB', 'Puppeteer', 'JWT']
        },
        {
          category: 'AI Services',
          color: 'from-purple-500 to-pink-500',
          items: ['Deepgram', 'AssemblyAI', 'OpenAI GPT-4', 'Whisper']
        }
      ]
    },
    {
      id: 'flow',
      title: 'How It Works',
      type: 'flow',
      steps: [
        { num: 1, title: 'Join Meeting', desc: 'Bot joins via meeting link' },
        { num: 2, title: 'Record Audio', desc: 'Captures all conversation' },
        { num: 3, title: 'Transcribe', desc: 'Converts speech to text' },
        { num: 4, title: 'Identify Speakers', desc: 'Tags who said what' },
        { num: 5, title: 'Extract Tasks', desc: 'AI finds action items' },
        { num: 6, title: 'Push to Tools', desc: 'Sync with Jira/Trello' }
      ]
    },
    {
      id: 'demo',
      title: 'Key Features Demo',
      type: 'demo'
    },
    {
      id: 'impact',
      title: 'Business Impact',
      type: 'impact',
      metrics: [
        { value: '70%', label: 'Time Saved', color: 'text-blue-400' },
        { value: '95%', label: 'Accuracy', color: 'text-green-400' },
        { value: '3x', label: 'Productivity', color: 'text-purple-400' },
        { value: '100%', label: 'Task Capture', color: 'text-pink-400' }
      ]
    },
    {
      id: 'closing',
      title: 'Transform Your Meetings',
      subtitle: 'Join the Future of Intelligent Collaboration',
      type: 'closing'
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentSlide(currentSlide + 1);
        setIsAnimating(false);
      }, 300);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentSlide(currentSlide - 1);
        setIsAnimating(false);
      }, 300);
    }
  };

  const goToSlide = (index) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsAnimating(false);
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const renderSlide = () => {
    const slide = slides[currentSlide];

    switch (slide.type) {
      case 'title':
        return (
          <div className="h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20" />
            <div className="absolute inset-0">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white/10"
                  style={{
                    width: Math.random() * 4 + 1 + 'px',
                    height: Math.random() * 4 + 1 + 'px',
                    left: Math.random() * 100 + '%',
                    top: Math.random() * 100 + '%',
                    animation: `float ${Math.random() * 10 + 10}s linear infinite`
                  }}
                />
              ))}
            </div>
            <div className="relative z-10 space-y-8">
              <Bot className="w-32 h-32 mx-auto text-blue-400 animate-bounce" />
              <h1 className="text-8xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {slide.title}
              </h1>
              <p className="text-3xl text-gray-300 font-light">{slide.subtitle}</p>
              <div className="flex items-center justify-center gap-4 mt-12">
                <Play className="w-6 h-6 text-blue-400 animate-pulse" />
                <span className="text-gray-400">Press → to start</span>
              </div>
            </div>
          </div>
        );

      case 'problem':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-16">{slide.title}</h2>
            <div className="grid grid-cols-2 gap-8">
              {slide.content.map((item, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-red-500/20 to-orange-500/20 p-8 rounded-2xl border border-red-500/30 transform hover:scale-105 transition-transform"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="text-5xl mb-4">{item.icon}</div>
                  <p className="text-2xl text-gray-200">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-16">{slide.title}</h2>
            <div className="grid grid-cols-3 gap-6">
              {slide.features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={i}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all transform hover:-translate-y-2"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <Icon className="w-12 h-12 text-blue-400 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'architecture':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-12">{slide.title}</h2>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-6">
                <div className="bg-blue-500/20 border border-blue-500 p-6 rounded-xl">
                  <Globe className="w-10 h-10 text-blue-400 mb-2" />
                  <div className="font-bold text-white">Frontend</div>
                  <div className="text-sm text-gray-400">React + Vite</div>
                </div>
                <div className="bg-green-500/20 border border-green-500 p-6 rounded-xl">
                  <Database className="w-10 h-10 text-green-400 mb-2" />
                  <div className="font-bold text-white">Backend</div>
                  <div className="text-sm text-gray-400">Node.js + Express</div>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <ArrowRight className="w-12 h-12 text-gray-600" />
                <ArrowRight className="w-12 h-12 text-gray-600" />
              </div>

              <div className="bg-purple-500/20 border border-purple-500 p-8 rounded-xl">
                <Bot className="w-12 h-12 text-purple-400 mb-3 mx-auto" />
                <div className="font-bold text-white text-center">Meeting Bot</div>
                <div className="text-sm text-gray-400 text-center">Puppeteer</div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <ArrowRight className="w-12 h-12 text-gray-600" />
                <ArrowRight className="w-12 h-12 text-gray-600" />
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-pink-500/20 border border-pink-500 p-4 rounded-xl">
                  <Mic className="w-8 h-8 text-pink-400 mb-2" />
                  <div className="text-sm font-bold text-white">Deepgram</div>
                </div>
                <div className="bg-pink-500/20 border border-pink-500 p-4 rounded-xl">
                  <Users className="w-8 h-8 text-pink-400 mb-2" />
                  <div className="text-sm font-bold text-white">AssemblyAI</div>
                </div>
                <div className="bg-pink-500/20 border border-pink-500 p-4 rounded-xl">
                  <Brain className="w-8 h-8 text-pink-400 mb-2" />
                  <div className="text-sm font-bold text-white">OpenAI</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'tech':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-16">{slide.title}</h2>
            <div className="grid grid-cols-3 gap-8">
              {slide.stacks.map((stack, i) => (
                <div key={i} className="space-y-4">
                  <div className={`text-2xl font-bold bg-gradient-to-r ${stack.color} bg-clip-text text-transparent`}>
                    {stack.category}
                  </div>
                  <div className="space-y-3">
                    {stack.items.map((item, j) => (
                      <div
                        key={j}
                        className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors"
                      >
                        <span className="text-gray-200">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'flow':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-16">{slide.title}</h2>
            <div className="flex items-center justify-between">
              {slide.steps.map((step, i) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center text-center max-w-[150px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-2xl font-bold mb-4">
                      {step.num}
                    </div>
                    <div className="font-bold text-white mb-2">{step.title}</div>
                    <div className="text-sm text-gray-400">{step.desc}</div>
                  </div>
                  {i < slide.steps.length - 1 && (
                    <ArrowRight className="w-8 h-8 text-gray-600 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        );

      case 'demo':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-16">{slide.title}</h2>
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-12 border border-gray-800">
              <div className="space-y-8">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-8 h-8 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-white mb-2">Live Transcription</div>
                    <div className="bg-gray-800 p-6 rounded-xl">
                      <p className="text-gray-300 italic">"Let's discuss the Q4 roadmap. John, can you update the mockups by Friday?"</p>
                      <div className="mt-4 flex gap-2">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">SPEAKER_A</span>
                        <span className="text-gray-500">00:45</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckSquare className="w-8 h-8 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-white mb-2">Extracted Tasks</div>
                    <div className="bg-gray-800 p-6 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Update design mockups</span>
                        <div className="flex gap-2">
                          <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">High Priority</span>
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">John</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'impact':
        return (
          <div className="h-full flex flex-col justify-center px-16">
            <h2 className="text-6xl font-bold text-white mb-16">{slide.title}</h2>
            <div className="grid grid-cols-4 gap-8">
              {slide.metrics.map((metric, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 p-12 rounded-2xl border border-gray-700 text-center transform hover:scale-110 transition-transform"
                >
                  <div className={`text-7xl font-black mb-4 ${metric.color}`}>
                    {metric.value}
                  </div>
                  <div className="text-xl text-gray-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'closing':
        return (
          <div className="h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20" />
            <div className="relative z-10 space-y-8">
              <Rocket className="w-32 h-32 mx-auto text-blue-400 animate-pulse" />
              <h1 className="text-7xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {slide.title}
              </h1>
              <p className="text-3xl text-gray-300 font-light">{slide.subtitle}</p>
              <div className="flex gap-6 justify-center mt-12">
                <button className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-xl font-bold hover:scale-105 transition-transform">
                  Get Started
                </button>
                <button className="px-8 py-4 bg-gray-800 border border-gray-600 rounded-xl text-xl font-bold hover:border-blue-500 transition-colors">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
        `}
      </style>
      
      <div className={`h-full transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
        {renderSlide()}
      </div>

      {/* Navigation */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-6">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="p-3 bg-gray-800/50 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`transition-all ${
                i === currentSlide
                  ? 'w-8 h-3 bg-blue-500'
                  : 'w-3 h-3 bg-gray-600 hover:bg-gray-500'
              } rounded-full`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className="p-3 bg-gray-800/50 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Slide Counter */}
      <div className="absolute top-8 right-8 text-gray-400">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  );
};

export default Presentation;
