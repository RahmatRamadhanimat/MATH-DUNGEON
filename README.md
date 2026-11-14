# MATH MAZE: QUEST FOR THE KEYS
### 2D Pixel Art Online Multiplayer Mathematics Adventure Game (Up to 45 Players per Classroom)

**MATH MAZE: QUEST FOR THE KEYS** adalah game petualangan edukasi matematika berbasis browser bergaya **2D Pixel Art 16-bit** dengan dukungan **Multiplayer Real-Time (Socket.IO)** hingga **45 siswa dalam satu room kelas**.

---

## 1. Fitur Utama

1. **Visual 2D Pixel Art Profesional**:
   - Tileset labirin batu, lantai dungeon, ruangan rahasia (peti harta, kristal bercahaya, rumput/lumut, jebakan dekoratif), obor menyala dengan efek cahaya dinamis, dan gerbang besi pintu keluar.
   - **8 Karakter Petualang Pixel Art** (*Arkan, Lyra, Kael, Pyra, Zeph, Nyx, Toren, Vesper*) dengan animasi berjalan 4 arah, idle, selebrasi kunci, dan warna pakaian yang dapat dikustomisasi.
2. **Procedural Maze Generation + Pathfinding Validation**:
   - Algoritma *Recursive Backtracking* + *Secret Chamber Carving* + validasi *Breadth-First Search (BFS)* yang menjamin 100% kunci dan pintu keluar dapat dijangkau.
   - 5 Ukuran Map: Level 1 (`25×25`), Level 2 (`35×35`), Level 3 (`45×45`), Level 4 (`55×55`), hingga Level 5 (`65×65`).
3. **Sistem Soal Matematika 2 Pilihan Jawaban (A & B)**:
   - Setiap kunci memunculkan soal matematika acak dengan **tepat dua pilihan jawaban (A dan B)**.
   - **17 Kategori Materi** pada 3 Tingkat Kesulitan:
     - **Mudah**: Penjumlahan, Pengurangan, Perkalian, Pembagian, Operasi Hitung Sederhana.
     - **Sedang**: Pecahan, Persentase, Bilangan Negatif, Operasi Campuran, Perpangkatan, Akar Kuadrat Sederhana.
     - **Sulit**: Aljabar, Persamaan Linear, Persamaan Matematika, Bilangan Berpangkat, Akar, Logika Matematika.
4. **Tiga Mode Permainan Kelas (Maksimal 45 Siswa / Room)**:
   - **CO-OP ADVENTURE**: Seluruh kelas bekerja sama mengumpulkan kunci bersama.
   - **CLASS COMPETITION**: Kompetisi individu dengan leaderboard real-time.
   - **TEAM BATTLE**: Maksimal 5 tim (hingga 9 siswa per tim) dengan pembagian tim manual atau acak otomatis.
5. **Teacher Dashboard & Load Testing**:
   - Guru dapat membuat room (`MATH-XXXX`), mengunci room, mengatur kurikulum, pause/resume/restart/end game, serta mengunduh hasil dalam format **CSV**.
   - Dilengkapi **Simulator Pengujian Beban Socket.IO Nyata** untuk menguji 2, 10, 25, hingga 45 koneksi simultan beserta verifikasi penolakan pemain ke-46.

---

## 2. Cara Menjalankan Proyek

```bash
# 1. Instal dependensi
npm install

# 2. Jalankan unit test logika permainan (Maze Generator, Question Generator, Score System)
npm test

# 3. Jalankan server pengembangan (Express + Socket.IO + Vite pada port 3000)
npm run dev
```

Buka `http://localhost:3000` di browser.

---

## 3. Konfigurasi Database & Environment Variables

Salin `.env.example` menjadi `.env`:

```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/math_maze"
MAX_PLAYERS_PER_ROOM=45
```

- Secara default, aplikasi menyimpan seluruh profil guru/siswa, riwayat pertandingan, dan statistik pembelajaran secara persisten di `./data/math_maze_db.json`.
- Untuk deployment eksternal dengan PostgreSQL, isi `DATABASE_URL` pada environment server.

---

## 4. Instruksi Deployment

1. **Build Frontend**:
   ```bash
   npm run build
   ```
2. **Menjalankan Server Produksi (Full-Stack Node.js + WebSocket)**:
   ```bash
   NODE_ENV=production npm start
   ```
   Dapat di-deploy ke Google Cloud Run, Railway, Render, atau Fly.io dengan dukungan WebSocket aktif.
