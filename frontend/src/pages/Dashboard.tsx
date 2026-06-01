import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, MessageSquare, FileText, BarChart2, LogOut, Trash2, Calendar, Layers, Brain, CheckCircle2, Loader2 } from 'lucide-react';

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type Document = {
  id: number;
  originalName: string;
  status: string;
  uploadedAt: string;
  chunkCount: number;
};

type Message = { role: 'user' | 'assistant'; content: string };

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<'upload' | 'ask' | 'summary' | 'quiz' | 'progress'>('upload');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  // Q&A Modules
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  // Summary State Control
  const [summaryDocId, setSummaryDocId] = useState<number | null>(null);
  const [summaryMode, setSummaryMode] = useState('detailed');
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);

  // Quiz Engine
  const [quizDocId, setQuizDocId] = useState<number | null>(null);
  const [quizNum, setQuizNum] = useState(5);
  const [quizDiff, setQuizDiff] = useState('medium');
  const [quiz, setQuiz] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  // Performance Metrics Progress
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => { fetchDocuments(); }, []);
  useEffect(() => {
    if (tab === 'ask') chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, asking, tab]);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch { logout(); }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      await api.post('/documents/upload', formData);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      await fetchDocuments();
      setSelectedDocs(prev => prev.filter(i => i !== id));
      if (summaryDocId === id) setSummaryDocId(null);
      if (quizDocId === id) { setQuiz([]); setQuizDocId(null); }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || selectedDocs.length === 0) return;
    setMessages(m => [...m, { role: 'user', content: question }]);
    const queryPayload = question;
    setQuestion('');
    setAsking(true);
    try {
      const res = await api.post('/rag/ask', {
        question: queryPayload,
        document_ids: selectedDocs
      });
      setMessages(m => [...m, { role: 'assistant', content: res.data.answer }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Failed to get an answer. Please try again.' }]);
    } finally {
      setAsking(false);
    }
  };

  const handleSummarize = async () => {
    if (!summaryDocId) return;
    setUploading(true);
    setSummarizing(true);
    setSummary('');
    try {
      const res = await api.post('/rag/summarize', {
        document_id: summaryDocId,
        mode: summaryMode
      });
      setSummary(res.data.summary);
    } catch {
      setSummary('Failed to create summary.');
    } finally {
      setSummarizing(false);
      setUploading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!quizDocId) return;
    setGeneratingQuiz(true);
    setQuiz([]);
    setAnswers({});
    setSubmitted(false);
    try {
      const res = await api.post('/rag/quiz', {
        document_id: quizDocId,
        num_questions: quizNum,
        difficulty: quizDiff
      });
      setQuiz(res.data.questions || []);
    } catch {
      alert('Failed to generate quiz.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleSubmitQuiz = async () => {
    setSubmitted(true);
    const correct = quiz.filter((q, i) => answers[i] === q.correct_answer).length;
    try {
      await api.post('/rag/quiz/save', {
        document_id: quizDocId,
        total: quiz.length,
        correct,
        quiz_json: JSON.stringify(quiz)
      });
    } catch {}
  };

  const fetchProgress = async () => {
    try {
      const res = await api.get('/rag/progress');
      setProgress(res.data);
    } catch {}
  };

  useEffect(() => {
    if (tab === 'progress') fetchProgress();
  }, [tab]);

  const readyDocs = documents.filter(d => d.status === 'READY');

  return (
    <div className="min-h-screen bg-[#070a13] flex relative overflow-hidden text-slate-100">
      
      {/* Sidebar Navigation */}
      <aside className="w-68 bg-[#0b0f19]/80 border-r border-slate-800/80 flex flex-col backdrop-blur-xl z-20 shrink-0">
        <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-black text-lg tracking-tighter">S</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">SmartLearn</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-slate-400 font-medium truncate max-w-[140px]">{user.name || 'User'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'upload', label: 'Documents', icon: Layers },
            { id: 'ask', label: 'Cognitive Chat', icon: MessageSquare },
            { id: 'summary', label: 'Summarize', icon: FileText },
            { id: 'quiz', label: 'Quiz', icon: Brain },
            { id: 'progress', label: 'Performance Matrix', icon: BarChart2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-200 group relative ${
                tab === id
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon size={18} className={tab === id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400 transition'} />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/60">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition duration-200"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Primary Content Workspace */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(99,102,241,0.05),transparent)] z-10">
        
        <div className="flex-1 overflow-y-auto p-8 lg:p-10">
          
          {/* DOCUMENTS TAB */}
          {tab === 'upload' && (
            <div className="max-w-5xl mx-auto space-y-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Documents</h2>
                <p className="text-sm text-slate-400 mt-1">Upload and manage your documents.</p>
              </div>

              <label className={`group border-2 border-dashed rounded-2xl cursor-pointer bg-slate-900/20 backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center p-8 text-center h-48 relative overflow-hidden ${
                uploading 
                  ? 'border-indigo-500/40 pointer-events-none' 
                  : 'border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900/40'
              }`}>
                {uploading ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <Loader2 size={36} className="text-indigo-400 animate-spin" />
                    <span className="text-indigo-300 font-medium text-sm">Uploading document...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/5 transition duration-300 mb-3">
                      <Upload size={24} className="text-slate-400 group-hover:text-indigo-400 transition duration-300" />
                    </div>
                    <span className="text-slate-200 font-semibold text-sm">Upload a File</span>
                    <span className="text-slate-500 text-xs mt-1">Supports PDF, DOCX, TXT, or MD</span>
                  </>
                )}
                <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md" onChange={handleUpload} disabled={uploading} />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Documents ({documents.length})</h3>
                </div>
                
                {documents.length === 0 && (
                  <div className="border border-slate-800/60 bg-slate-900/10 rounded-2xl p-12 text-center">
                    <p className="text-sm text-slate-500">No documents uploaded yet.</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 flex items-start justify-between gap-4 transition duration-200 hover:border-slate-700/60">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <FileText size={16} className="text-indigo-400 shrink-0" />
                          <p className="font-semibold text-sm text-white truncate">{doc.originalName}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><Calendar size={12}/>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] tracking-wider uppercase px-2 py-1 rounded-md font-bold border ${
                          doc.status === 'READY'
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                            : doc.status === 'PROCESSING'
                            ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                            : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                        }`}>
                          {doc.status}
                        </span>
                        <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-500 hover:text-rose-400 hover:border-rose-500/20 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COGNITIVE CHAT TAB */}
          {tab === 'ask' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold tracking-tight text-white">Cognitive Chat</h2>
                <p className="text-sm text-slate-400 mt-1">Ask questions about your uploaded documents.</p>
                
                <div className="mt-4 bg-slate-950/40 border border-slate-800/60 p-3 rounded-2xl">
                  <p className="text-xs font-bold tracking-wide uppercase text-slate-500 mb-2">Select Documents to Chat With:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {readyDocs.length === 0 && <p className="text-xs text-slate-600 p-1">No documents available.</p>}
                    {readyDocs.map(doc => {
                      const isActive = selectedDocs.includes(doc.id);
                      return (
                        <button key={doc.id}
                          onClick={() => setSelectedDocs(s => isActive ? s.filter(i => i !== doc.id) : [...s, doc.id])}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition duration-150 truncate max-w-[200px] ${
                            isActive
                              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                              : 'bg-slate-900/20 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}>
                          {doc.originalName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chat Container */}
              <div className="flex-1 bg-slate-950/30 border border-slate-800/80 rounded-3xl p-6 mb-4 overflow-y-auto space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 shadow-inner">
                      <MessageSquare size={24} />
                    </div>
                    <p className="text-sm font-semibold text-slate-300">Chat Started</p>
                    <p className="text-xs text-slate-500 leading-relaxed">Ask anything about the documents you selected above.</p>
                  </div>
                )}
                
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/5'
                        : 'bg-slate-950/60 border border-slate-800 text-slate-200'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {asking && (
                  <div className="flex justify-start">
                    <div className="bg-slate-950/40 border border-slate-800/40 px-4 py-3 rounded-2xl text-sm text-slate-400 flex items-center gap-2.5">
                      <Loader2 size={14} className="animate-spin text-indigo-400" />
                      <span className="text-xs tracking-wide">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="flex gap-2 relative bg-slate-950 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500/60 transition duration-200">
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !asking && selectedDocs.length > 0 && handleAsk()}
                  placeholder={selectedDocs.length === 0 ? "Select documents above to start..." : "Ask a question..."}
                  disabled={selectedDocs.length === 0 || asking}
                  className="flex-1 bg-transparent rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none disabled:opacity-40"
                />
                <button onClick={handleAsk}
                  disabled={asking || !question.trim() || selectedDocs.length === 0}
                  className="bg-indigo-500 text-white px-5 py-2 rounded-xl hover:bg-indigo-600 transition font-semibold text-xs uppercase tracking-wider shadow-md shadow-indigo-500/10 disabled:opacity-30 disabled:pointer-events-none">
                  Send
                </button>
              </div>
            </div>
          )}

          {/* SUMMARIZE TAB */}
          {tab === 'summary' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Summarize</h2>
                <p className="text-sm text-slate-400 mt-1">Get quick summaries of your documents.</p>
              </div>

              <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select value={summaryDocId ?? ''}
                    onChange={e => setSummaryDocId(e.target.value ? Number(e.target.value) : null)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                    <option value="">Select Document...</option>
                    {readyDocs.map(d => (
                      <option key={d.id} value={d.id}>{d.originalName}</option>
                    ))}
                  </select>
                  
                  <select value={summaryMode}
                    onChange={e => setSummaryMode(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                    <option value="brief">Brief</option>
                    <option value="detailed">Analyze</option>
                    <option value="bullets">Bullet Points</option>
                  </select>
                  
                  <button onClick={handleSummarize}
                    disabled={!summaryDocId || summarizing}
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium py-3 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-500/10">
                    {summarizing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : 'Generate'}
                  </button>
                </div>

                {summary && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed shadow-inner">
                    {summary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QUIZ TAB */}
          {tab === 'quiz' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Quiz</h2>
                <p className="text-sm text-slate-400 mt-1">Test your knowledge with custom quizzes.</p>
              </div>

              {quiz.length === 0 ? (
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <select value={quizDocId ?? ''}
                      onChange={e => setQuizDocId(e.target.value ? Number(e.target.value) : null)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition md:col-span-2">
                      <option value="">Select Document...</option>
                      {readyDocs.map(d => (
                        <option key={d.id} value={d.id}>{d.originalName}</option>
                      ))}
                    </select>
                    
                    <select value={quizNum}
                      onChange={e => setQuizNum(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                      <option value="3">3 Questions</option>
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                    </select>
                    
                    <select value={quizDiff}
                      onChange={e => setQuizDiff(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                      <option value="easy">Basic</option>
                      <option value="medium">Intermediate</option>
                      <option value="hard">Expert</option>
                    </select>
                  </div>
                  
                  <button onClick={handleGenerateQuiz}
                    disabled={!quizDocId || generatingQuiz}
                    className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium py-3 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-500/10">
                    {generatingQuiz ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating Quiz...</span>
                      </>
                    ) : 'Start Quiz'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {quiz.map((q, i) => (
                    <div key={i} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                      <p className="font-semibold text-sm text-white leading-relaxed">
                        <span className="text-indigo-400 font-mono mr-2">[{i + 1}]</span> {q.question}
                      </p>
                      
                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt: string) => {
                          const letter = opt[0];
                          const isSelected = answers[i] === letter;
                          const isCorrect = letter === q.correct_answer;
                          
                          let btnStyle = 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700';
                          if (submitted) {
                            if (isCorrect) btnStyle = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium';
                            else if (isSelected) btnStyle = 'bg-rose-500/10 border-rose-500/40 text-rose-300';
                            else btnStyle = 'border-slate-900 bg-slate-950/10 text-slate-600 opacity-60';
                          } else if (isSelected) {
                            btnStyle = 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300 font-medium';
                          }

                          return (
                            <button key={opt}
                              onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: letter }))}
                              disabled={submitted}
                              className={`w-full text-left px-4 py-3 rounded-xl border text-xs transition duration-150 ${btnStyle}`}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      
                      {submitted && q.explanation && (
                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 text-xs text-slate-400 leading-relaxed italic">
                          <span className="font-semibold text-indigo-400 not-italic block mb-1">Explanation:</span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}

                  {!submitted ? (
                    <button onClick={handleSubmitQuiz}
                      className="w-full bg-indigo-500 text-white font-semibold py-3 rounded-xl hover:bg-indigo-600 transition text-xs tracking-wider uppercase shadow-md shadow-indigo-500/10">
                      Submit Answers
                    </button>
                  ) : (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center max-w-md mx-auto space-y-4">
                      <div className="inline-flex p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-emerald-400 mb-1">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="text-3xl font-mono font-bold text-white">
                          {quiz.filter((q, i) => answers[i] === q.correct_answer).length} / {quiz.length}
                        </p>
                        <p className="text-xs text-slate-400 font-medium mt-1">Quiz completed.</p>
                      </div>
                      <button onClick={() => { setQuiz([]); setAnswers({}); setSubmitted(false); }}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 py-2.5 rounded-xl text-xs font-semibold transition">
                        Try Another Quiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PERFORMANCE MATRIX TAB */}
          {tab === 'progress' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Performance Matrix</h2>
                <p className="text-sm text-slate-400 mt-1">Track your scores and progress over time.</p>
              </div>

              {progress ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-indigo-400">
                        <Layers size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Quizzes Taken</p>
                        <p className="text-2xl font-mono font-bold text-white mt-0.5">{progress.totalAttempts}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400">
                        <Brain size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average Score</p>
                        <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{progress.averageScore}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Recent History</h3>
                    
                    {(!progress.recentAttempts || progress.recentAttempts.length === 0) && (
                      <p className="text-xs text-slate-500 py-4 text-center">No history found.</p>
                    )}
                    
                    <div className="divide-y divide-slate-850">
                      {progress.recentAttempts?.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{a.document}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{new Date(a.date).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-sm font-mono font-bold shrink-0 ${a.score >= 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {a.correct} / {a.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-slate-500 text-sm justify-center py-12">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                  <span>Loading performance history...</span>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}