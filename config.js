// Ganti AI_PROVIDER ke 'groq' jika menggunakan Groq API Cloud
// Ganti AI_PROVIDER ke 'ollama' jika menggunakan LLM lokal (Ollama)

const CONFIG = {
  // 'groq' atau 'ollama'
  AI_PROVIDER: "groq",

  GROQ_API_KEY: "YOUR_GROQ_API_KEY",
  GROQ_URL: "https://api.groq.com/openai/v1/chat/completions",
  // GROQ_MODEL: "llama-3.1-8b-instant",
  GROQ_MODEL: "llama-3.3-70b-versatile",

  // Ollama settings (Lokal)
  // Janlup run 'ollama serve' dengan CORS origins diaktifkan
  OLLAMA_URL: "http://localhost:11434/api/generate",
  OLLAMA_MODEL: "llama3.2:1b", // Pastikan model sudah di-pull (ollama pull llama3.2:1b)

  LANGUAGE: "Indonesian",
};
