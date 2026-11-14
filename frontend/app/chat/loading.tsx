// Kerangka muat server-rendered untuk /chat: tampil seketika dari HTML awal
// selagi bundle klien chat dimuat dan dihidrasi, sehingga cat pertama dan
// LCP tidak menunggu JavaScript.
//
// Geometri di bawah sengaja disamakan dengan cangkang asli
// (apps/chat/page.tsx): sidebar 256px, tinggi header 44px, kolom percakapan
// max-w-3xl, composer rounded-3xl. Dengan begitu tidak ada lompatan tata
// letak saat aplikasi selesai hidrasi.
export default function ChatLoading() {
  return (
    <div
      className="flex h-[100dvh] w-full bg-[#faf9f6] text-[#09090b] overflow-hidden"
      aria-busy="true"
      aria-label="Memuat ChatZAP"
    >
      {/* Sidebar skeleton — hanya di layar lebar, sama seperti sidebar asli */}
      <aside className="hidden sm:flex w-[256px] shrink-0 flex-col border-r border-[#e4e4e7] bg-white">
        <div className="h-12 px-3.5 flex items-center justify-between border-b border-[#f4f4f5]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#09090b]" />
            <div className="h-3.5 w-16 rounded bg-[#e4e4e7]" />
          </div>
          <div className="w-4 h-4 rounded bg-[#f4f4f5]" />
        </div>
        <div className="px-3 py-2.5">
          <div className="h-[38px] rounded-xl border border-[#e4e4e7] bg-[#faf9f6]" />
        </div>
        <div className="px-3 space-y-2 pt-1">
          <div className="h-8 rounded-lg bg-[#f4f4f5]" />
        </div>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div className="h-2.5 w-20 rounded bg-[#e4e4e7]" />
          <div className="h-3 w-14 rounded bg-[#f4f4f5]" />
        </div>
        <div className="px-3 space-y-1.5">
          <div className="h-9 rounded-xl bg-[#f4f4f5]" />
          <div className="h-9 rounded-xl bg-[#fafafa]" />
        </div>
        <div className="mt-auto p-3 border-t border-[#f4f4f5] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#f4f4f5]" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-16 rounded bg-[#e4e4e7]" />
            <div className="h-2 w-20 rounded bg-[#f4f4f5]" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-11 px-3.5 flex items-center justify-end gap-2">
          <div className="h-7 w-24 rounded-lg border border-[#e4e4e7] bg-white" />
          <div className="h-7 w-7 rounded-lg border border-[#e4e4e7] bg-white" />
          <div className="h-7 w-7 rounded-lg border border-[#e4e4e7] bg-white" />
        </header>

        <div className="flex-1 flex flex-col justify-center items-center px-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[22px] h-[22px] rounded-md bg-[#09090b]" />
            <div className="h-5 w-44 rounded bg-[#e4e4e7]" />
          </div>
          <div className="h-3 w-64 rounded bg-[#f4f4f5]" />
          <div className="mt-6 w-full max-w-3xl h-[124px] rounded-3xl border border-[#e4e4e7] bg-white shadow-[0_16px_40px_-12px_rgba(9,9,11,0.08)]" />
        </div>

        <div className="h-2" aria-hidden="true" />
        <span className="sr-only">Memuat ruang belajar…</span>
      </main>
    </div>
  );
}
