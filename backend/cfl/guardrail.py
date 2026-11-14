"""
ZAP (Zero Answer Policy) - Context-Aware Zero-Answer Guardrail
Menyaring kebocoran deklaratif kunci jawaban tanpa merusak konteks simulasi Sokrates.
"""

import re

class RobustZeroAnswerGuardrail:
    """
    Guardrail yang secara ketat mendeteksi dan menyaring deklarasi eksplisit kunci jawaban,
    namun mengizinkan kalimat instruksional Sokrates (misal: 'Jika x = 2', 'hasil dari substitusi adalah 25').
    """

    DECLARATIVE_ANSWER_PATTERNS = [
        # Deteksi eksplisit: "jawaban akhirnya adalah x = 2", "jawabannya adalah 5", "solusinya adalah 5", "hasil akhir adalah -5/2", "kunci jawaban adalah 5"
        # Catatan: 'hasil' WAJIB diikuti 'akhir' agar tidak mencocokkan 'hasil dari substitusi adalah...'
        r"(?:jawaban(?:nya)?(?:\s*akhir(?:nya)?)?|solusi(?:nya)?|hasil\s+akhir(?:nya)?|kunci\s+jawaban(?:nya)?)\s*(?:adalah|=|:)\s*(?:[a-zA-Z]\s*=\s*)?[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+|√\d+)",
        # Deteksi kesimpulan: "maka x = 2", "jadi x = -5", "kesimpulannya x = 2", "sehingga x = 5", "diperoleh x = 5"
        r"(?:maka|jadi|kesimpulannya|sehingga|diperoleh|didapatkan),?\s+(?:nilai\s+)?[a-zA-Z]\s*=\s*[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+|√\d+)",
        # Deteksi deklarasi nilai variabel langsung: "nilai x adalah 5", "nilai dari x = -2"
        r"(?:nilai\s+(?:dari\s+|variabel\s+)?[a-zA-Z])\s*(?:adalah|=|:)\s*[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+|√\d+)",
        # Deteksi evaluasi diagonal atau nilai geometri jadi: "d_bidang = 14,14 cm", "diagonal ruang = 17,32 cm"
        r"(?:d(?:[_\s]*(?:bidang|ruang|sisi))?|diagonal(?:[_\s]*(?:bidang|ruang|sisi))?)\s*(?:=|\\approx|≈|adalah)\s*(?:[^\n=]*=)?\s*[-+−]?\s*\d+(?:[.,]\d+)?\s*(?:\\text\{\s*(?:cm|m|mm|satuan)\s*\}|cm|m|mm|satuan)?",
        # Bahasa Inggris fallback
        r"(?:the\s+(?:final\s+)?answer\s+is|therefore\s+[a-zA-Z]\s*=|we\s+get\s+[a-zA-Z]\s*=)\s*[-+−]?\s*(?:\d+(?:\/\d+)?|\d*\.?\d+)",
        # ------------------------------------------------------------------
        # Domain non-matematika (fisika, kimia, pemrograman)
        # Pola di bawah sengaja mensyaratkan penanda simpulan atau baris jawaban
        # tunggal, agar penalaran antara seperti "jika v = 20 m/s" atau
        # "algoritma A adalah O(n log n), sedangkan B ..." tidak ikut disaring.
        # ------------------------------------------------------------------
        # 6. Kesimpulan fisis dengan satuan: "jadi v = 20 m/s", "maka F = 12 N"
        r"(?:maka|jadi|sehingga|diperoleh|didapatkan|hasilnya|nilainya|besarnya)\s*,?\s*(?:[A-Za-z]{1,3}\s*=\s*)?[-+]?\d+(?:[.,]\d+)?\s*(?:m/s(?:\^2|²)?|km/jam|cm/s|N|J|W|V|A|Ω|ohm|kg|mol|M|atm|kPa|Pa|K|°C)\b",
        # 7. Satu baris yang hanya berisi deklarasi besaran: "v = 20 m/s"
        r"^\s*(?:v|s|a|F|Ek|Ep|V|I|P|n|M|pH|pOH)\s*=\s*[-+]?\d+(?:[.,]\d+)?\s*(?:m/s(?:\^2|²)?|N|J|W|V|A|Ω|ohm|kg|mol|M|atm|kPa|Pa|K|°C)\s*$",
        # 8. Simpulan numerik umum: "hasilnya 42", "hasil akhir: 3,5", "jawabannya 7"
        r"(?:hasilnya|hasil\s+akhir(?:nya)?|jawabannya|jawaban\s+akhir(?:nya)?)\s*(?:adalah|=|:)?\s*[-+]?\d+(?:[.,]\d+)?(?:\s*[A-Za-z%°]{1,8}(?:/[A-Za-z]{1,4})?)?",
        # 9. pH/pOH sebagai jawaban: "pH = 3", "pH larutan adalah 3.5"
        r"(?:pH|pOH)\s*(?:larutan(?:nya)?\s*)?(?:adalah|=|:)\s*[-+]?\d+(?:[.,]\d+)?",
        # 10. Output program sebagai jawaban: "output: 7", "output = True", "keluarannya [1, 2, 3]"
        r"(?:output|keluaran|hasil\s+eksekusi|hasil\s+program)\s*(?:adalah|=|:)\s*(?:[-+]?\d+(?:[.,]\d+)?|True|False|None|\[[^\]\n]{0,60}\])",
        # 11. Kompleksitas Big-O sebagai jawaban: "kompleksitas waktunya adalah O(n log n)"
        r"(?:kompleksitas(?:\s+waktu(?:nya)?)?|big[- ]?o|orde)\s*(?:adalah|=|:|yaitu|ialah)\s*O\([^)\n]{1,20}\)"
    ]

    @classmethod
    def sanitize(cls, text: str, final_solution: str | None = None) -> str:
        """
        Menyaring teks keluaran AI dari deklarasi eksplisit jawaban akhir.
        """
        sanitized = text

        # 1. Bersihkan seluruh pernyataan deklaratif kesimpulan jawaban
        for pattern in cls.DECLARATIVE_ANSWER_PATTERNS:
            sanitized = re.sub(
                pattern,
                "Bagaimanakah menurut analisismu?",
                sanitized,
                flags=re.IGNORECASE
            )

        # 2. Jika target final_solution diberikan (misal '2' atau '-5/2'),
        # hanya filter jika dipasangkan dengan kata penutup kunci (bukan 'jika x = 2')
        if final_solution and str(final_solution).strip():
            sol_escaped = re.escape(str(final_solution).strip())
            target_pattern = rf"(?:kunci|nilai\s+akhir)\s*(?:adalah|=|:)\s*(?:[a-zA-Z]\s*=\s*)?{sol_escaped}\b"
            sanitized = re.sub(target_pattern, "kunci adalah [DIRAHASIAKAN]", sanitized, flags=re.IGNORECASE)

        return sanitized
