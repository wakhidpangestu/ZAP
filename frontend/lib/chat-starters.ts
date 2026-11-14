export type StarterIconKey = "flask" | "compass" | "box";

export interface ChatStarterTemplate {
  label: string;
  icon: StarterIconKey;
  text: string;
}

/**
 * Tiga pemantik 1-klik di layar kosong `/chat`:
 * 1. SymPy CFL (deteksi ROOT_LOSS pada x² = 5x)
 * 2. Plotter 2D interaktif (Gelombang Sinus y = 2 sin(x))
 * 3. Permukaan 3D Three.js (Pelana Kuda z = x² - y²)
 */
export const CHAT_STARTER_TEMPLATES: readonly ChatStarterTemplate[] = [
  {
    label: "Misteri Akar Hilang: x² = 5x",
    icon: "flask",
    text: "Tolong cek langkah saya: x^2 = 5x -> kedua ruas dibagi x -> x = 5",
  },
  {
    label: "Gelombang Sinus y = 2 sin(x)",
    icon: "compass",
    text: "Tampilkan grafik gelombang sinus y = 2 sin(x) di papan tulis 2D",
  },
  {
    label: "Pelana Kuda 3D (z = x² − y²)",
    icon: "box",
    text: "Tampilkan permukaan pelana kuda 3D z = x^2 - y^2",
  },
];
