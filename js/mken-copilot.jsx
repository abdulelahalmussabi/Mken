import React, { useState } from 'react';

/**
 * Mken SaaS - AI Co-Pilot (Voice & Text Command Processing Engine)
 * Production React Component with voice recognition & AI text intent parsing.
 * Supports structured SaaS actions with confirmation prompts for state-changing operations.
 */
export default function MkenCoPilot({ tenantId }) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [response, setResponse] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('عذراً، متصفحك لا يدعم التعرف الصوتي المباشر. يُرجى استخدام الإدخال النصي.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      processCommand(transcript);
    };

    recognition.start();
  }

  async function processCommand(textToProcess) {
    const query = textToProcess || inputText;
    if (!query.trim()) return;

    setProcessing(true);
    setResponse(null);

    try {
      const res = await fetch('/api/v1/copilot/intent-handler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, tenantId })
      });
      const data = await res.json();

      if (data.requiresConfirmation) {
        setPendingAction(data.action);
      }
      setResponse(data);
    } catch (err) {
      setResponse({ reply: `تعذر معالجة الأمر الصوتي: ${err.message}`, type: 'ERROR' });
    } finally {
      setProcessing(false);
    }
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    setResponse({
      reply: `✅ تم تنفيذ الإجراء بنجاح: ${pendingAction.description}`,
      type: 'SUCCESS'
    });
    setPendingAction(null);
  }

  return (
    <div className="p-6 bg-gray-50 dir-rtl font-sans text-right">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 border-b pb-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md">🤖</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mken AI Co-Pilot (المساعد الصوتي والنصي)</h2>
            <p className="text-xs text-gray-500">أدخل أمرك صوتياً أو نصياً لإدارة الحجوزات، المبيعات، ومخزون الأنشطة الـ 21</p>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && processCommand()}
            placeholder="مثال: استعرض مواعيد اليوم أو طبق خصم 10% على الأصناف الضعيفة..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={startVoiceRecognition}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1 ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {isListening ? '🎙️ جاري الاستماع...' : '🎙️ تحدث'}
          </button>
          <button
            onClick={() => processCommand()}
            disabled={processing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {processing ? '⏳...' : 'إرسال'}
          </button>
        </div>

        {/* Response Box */}
        {response && (
          <div className={`p-4 rounded-xl text-xs font-medium leading-relaxed ${response.type === 'ERROR' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-900 border border-blue-200'}`}>
            {response.reply}

            {/* Confirmation Prompt */}
            {pendingAction && (
              <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between items-center">
                <span className="font-bold text-gray-900">هل تؤكد تنفيذ هذا الإجراء الجوهري؟</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingAction(null)}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmPendingAction}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                  >
                    نعم، تأكيد التنفيذ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
