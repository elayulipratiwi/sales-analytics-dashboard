Selamat datang di repository Sales Intelligence AI! Proyek ini adalah dashboard analitik bisnis yang menggabungkan visualisasi data interaktif dengan kecerdasan buatan (AI) untuk mendeteksi anomali secara otomatis dan menghasilkan rekomendasi yang dapat ditindaklanjuti (actionable insights). Dibangun sebagai Single Page Application (SPA) murni menggunakan HTML, CSS, JavaScript, D3.js, dan Chart.js, serta terintegrasi dengan Groq API (LLM Llama 3.3) dan Tableau Public.


#Cara Menjalankan Project Secara Lokal
1. Clone repository ini (git clone https://github.com/username-anda/nama-repo.gitcd nama-repo)
2. Siapkan API Key (Jika ingin menggunakan fitur AI), dapatkan API Key gratis di GroqCloud Console.
3. Buka file config.js.
4. Ganti "YOUR_GROQ_API_KEY" dengan API Key Anda.
5. Jalankan menggunakan Live Server (opsionall)


# Disclaimer Fitur UI (Mockup)
Beberapa elemen UI pada header aplikasi, seperti Tombol Notifikasi (Bell), Pengaturan (Settings), dan User Profile (Exec User), sengaja didesain sebagai bagian dari tampilan UI/UX untuk simulasi dashboard enterprise. Fitur-fitur tersebut belum memiliki fungsi interaktif di belakangnya (belum terintegrasi dengan sistem manajemen pengguna) dan tidak memengaruhi fungsionalitas inti dari analisis data maupun AI. 
Soon mungkin akan difungsikan--


# Struktur folder
1. index.html - Struktur halaman utama)
2. styles.css - Seluruh styling (Grid, Flexbox, Tema warna)
3. app.js - Logika utama, filter, render UI, dan event handler
4. config.js - Konfigurasi API (Groq / Ollama) dan Model
5. anomalyDetector.js - Mesin kalkulasi statistik (Z-Score, IQR, MoM)
6. aiInsight.js - Jembatan ke API AI (Prompt engineering & fetch)
7. storyEngine.js - Engine pembangun narasi SCR
8. Sales_BY_Category.csv - Dataset penjualan yang digunakan
