//... existing code ...
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 border border-gray-600 w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between bg-gray-900/50"><h3 className="text-xl font-bold text-white flex items-center"><Sparkles className="text-purple-400 mr-2" />{aiTitle}</h3><button onClick={() => setAiModalOpen(false)}><X size={24} className="text-gray-400 hover:text-white" /></button></div>
                <div className="p-6 overflow-y-auto flex-1 font-mono text-sm leading-relaxed text-gray-200 bg-gray-900">{isAiLoading ? <div className="flex flex-col items-center h-24 justify-center"><Loader2 className="animate-spin text-purple-500" /></div> : <div className="whitespace-pre-wrap">{aiResponse}</div>}</div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BoardLab;
