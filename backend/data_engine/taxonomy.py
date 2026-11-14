"""
ZAP Math Taxonomy & Knowledge Hierarchy (TK s/d S3)
Universal mathematical ontology bridging pedagogical curricula with SymPy CAS verification.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class SubtopicDefinition(BaseModel):
    id: str
    name: str
    dimension: str = "Abstract"  # "0D", "1D", "2D", "3D", "nD", "Abstract"
    shape_kind: Optional[str] = None  # e.g., "jajar_genjang", "kubus", "tabung"
    key_formulas: List[Dict[str, str]] = Field(default_factory=list)
    common_misconceptions: List[str] = Field(default_factory=list)
    canvas_target: Optional[Dict[str, str]] = None  # {"view": "2d_shape", "model": "jajar_genjang"}

class TopicDefinition(BaseModel):
    id: str
    name: str
    description: str
    subtopics: List[SubtopicDefinition] = Field(default_factory=list)

class TierDefinition(BaseModel):
    tier: str  # TK, SD, SMP, SMA, S1, S2, S3
    level_name: str
    target_audience: str
    curriculum_standards: List[str]
    topics: List[TopicDefinition] = Field(default_factory=list)

MATH_TAXONOMY: Dict[str, TierDefinition] = {
    "TK": TierDefinition(
        tier="TK",
        level_name="Taman Kanak-Kanak / Early Childhood Mathematics",
        target_audience="Anak Usia 4-6 Tahun (PAUD/TK A/TK B)",
        curriculum_standards=["Kurikulum Merdeka PAUD", "Early Math Foundation (NAEYC)"],
        topics=[
            TopicDefinition(
                id="tk_counting",
                name="Pengenalan Angka & Membilang",
                description="Mengenal simbol angka 1-20, membilang objek konkret, dan mencocokkan jumlah.",
                subtopics=[
                    SubtopicDefinition(
                        id="tk_num_1_10",
                        name="Angka 1 sampai 10",
                        dimension="0D",
                        key_formulas=[{"label": "Kardinalitas", "formula": "n = 1, 2, ..., 10"}],
                        common_misconceptions=["Tertukar antara simbol angka 6 dan 9", "Melewatkan angka saat mencacah."]
                    ),
                    SubtopicDefinition(
                        id="tk_comparison",
                        name="Perbandingan Kuantitas & Ukuran",
                        dimension="1D",
                        key_formulas=[{"label": "Relasi", "formula": "Lebih Banyak / Lebih Sedikit, Besar / Kecil"}],
                        common_misconceptions=["Menganggap susunan objek yang lebih renggang selalu lebih banyak."]
                    )
                ]
            ),
            TopicDefinition(
                id="tk_basic_shapes",
                name="Bentuk Geometri Datar Sederhana",
                description="Mengenal bentuk 2D dasar melalui persepsi visual dan perabaan.",
                subtopics=[
                    SubtopicDefinition(
                        id="tk_shape_circle",
                        name="Lingkaran",
                        dimension="2D",
                        shape_kind="lingkaran",
                        canvas_target={"view": "2d_shape", "model": "circle"},
                        key_formulas=[{"label": "Karakteristik", "formula": "Bentuk bundar mulus tanpa sudut"}]
                    ),
                    SubtopicDefinition(
                        id="tk_shape_triangle",
                        name="Segitiga",
                        dimension="2D",
                        shape_kind="segitiga",
                        canvas_target={"view": "2d_shape", "model": "triangle"},
                        key_formulas=[{"label": "Karakteristik", "formula": "Memiliki 3 sisi dan 3 titik sudut"}]
                    ),
                    SubtopicDefinition(
                        id="tk_shape_square",
                        name="Persegi / Kotak",
                        dimension="2D",
                        shape_kind="persegi",
                        canvas_target={"view": "2d_shape", "model": "square"},
                        key_formulas=[{"label": "Karakteristik", "formula": "Memiliki 4 sisi sama panjang dan 4 sudut"}]
                    )
                ]
            )
        ]
    ),

    "SD": TierDefinition(
        tier="SD",
        level_name="Sekolah Dasar / Elementary Mathematics",
        target_audience="Siswa Kelas 1 - 6 SD (Usia 7-12 Tahun)",
        curriculum_standards=["Kurikulum Merdeka SD", "Kurikulum 2013 (K13) SD"],
        topics=[
            TopicDefinition(
                id="sd_arithmetic",
                name="Aritmetika Bilangan Cacah & Bulat",
                description="Operasi penjumlahan, pengurangan, perkalian, pembagian, FPB dan KPK.",
                subtopics=[
                    SubtopicDefinition(
                        id="sd_ops_basic",
                        name="Operasi Dasar 4 Pilar (+, -, x, /)",
                        dimension="0D",
                        key_formulas=[
                            {"label": "Sifat Komutatif", "formula": "a + b = b + a,\\quad a \\times b = b \\times a"},
                            {"label": "Sifat Asosiatif", "formula": "(a + b) + c = a + (b + c)"},
                            {"label": "Sifat Distributif", "formula": "a \\times (b + c) = (a \\times b) + (a \\times c)"}
                        ],
                        common_misconceptions=["Mendahulukan penjumlahan daripada perkalian pada operasi campuran."]
                    ),
                    SubtopicDefinition(
                        id="sd_fractions",
                        name="Pecahan & Desimal",
                        dimension="1D",
                        key_formulas=[
                            {"label": "Penjumlahan Pecahan", "formula": "\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}"},
                            {"label": "Perkalian Pecahan", "formula": "\\frac{a}{b} \\times \\frac{c}{d} = \\frac{ac}{bd}"}
                        ],
                        common_misconceptions=["Menjumlahkan pembilang dengan pembilang dan penyebut dengan penyebut: (a/b)+(c/d) != (a+c)/(b+d)."]
                    )
                ]
            ),
            TopicDefinition(
                id="sd_plane_geometry",
                name="Bangun Datar 2D (Plane Geometry)",
                description="Konsep luas dan keliling poligon beraturan dan tak beraturan.",
                subtopics=[
                    SubtopicDefinition(
                        id="sd_parallelogram",
                        name="Jajar Genjang (Parallelogram)",
                        dimension="2D",
                        shape_kind="jajar_genjang",
                        canvas_target={"view": "2d_shape", "model": "jajar_genjang"},
                        key_formulas=[
                            {"label": "Luas Jajar Genjang", "formula": "L = a \\times t"},
                            {"label": "Keliling Jajar Genjang", "formula": "K = 2(a + s)"}
                        ],
                        common_misconceptions=[
                            "Menghitung luas dengan mengalikan alas dengan sisi miring (L != a * s, harus dikali tinggi tegak lurus t).",
                            "Mengira jajar genjang adalah bangun 3D."
                        ]
                    ),
                    SubtopicDefinition(
                        id="sd_trapezoid",
                        name="Trapesium (Trapezoid)",
                        dimension="2D",
                        shape_kind="trapesium",
                        canvas_target={"view": "2d_shape", "model": "trapesium"},
                        key_formulas=[
                            {"label": "Luas Trapesium", "formula": "L = \\frac{(a + b) \\times t}{2}"},
                            {"label": "Keliling Trapesium", "formula": "K = a + b + c + d"}
                        ],
                        common_misconceptions=["Lupa membagi 2 saat menghitung luas trapesium."]
                    ),
                    SubtopicDefinition(
                        id="sd_triangle",
                        name="Segitiga (Triangle)",
                        dimension="2D",
                        shape_kind="segitiga",
                        canvas_target={"view": "2d_shape", "model": "segitiga"},
                        key_formulas=[
                            {"label": "Luas Segitiga", "formula": "L = \\frac{1}{2} \\times a \\times t"},
                            {"label": "Keliling Segitiga", "formula": "K = a + b + c"}
                        ],
                        common_misconceptions=["Menggunakan sisi miring sebagai tinggi pada segitiga sembarang."]
                    ),
                    SubtopicDefinition(
                        id="sd_rhombus_kite",
                        name="Belah Ketupat & Layang-Layang",
                        dimension="2D",
                        shape_kind="belah_ketupat",
                        canvas_target={"view": "2d_shape", "model": "belah_ketupat"},
                        key_formulas=[
                            {"label": "Luas Belah Ketupat / Layang-Layang", "formula": "L = \\frac{1}{2} \\times d_1 \\times d_2"},
                            {"label": "Keliling Belah Ketupat", "formula": "K = 4s"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="sd_circle",
                        name="Lingkaran (Circle)",
                        dimension="2D",
                        shape_kind="lingkaran",
                        canvas_target={"view": "2d_shape", "model": "circle"},
                        key_formulas=[
                            {"label": "Luas Lingkaran", "formula": "L = \\pi r^2 = \\frac{1}{4}\\pi d^2"},
                            {"label": "Keliling Lingkaran", "formula": "K = 2\\pi r = \\pi d"}
                        ],
                        common_misconceptions=["Tertukar antara rumus luas pi*r^2 dan keliling 2*pi*r."]
                    )
                ]
            ),
            TopicDefinition(
                id="sd_solid_geometry",
                name="Bangun Ruang 3D (Solid Geometry)",
                description="Volume dan luas permukaan kubus, balok, tabung, kerucut, bola.",
                subtopics=[
                    SubtopicDefinition(
                        id="sd_cube",
                        name="Kubus",
                        dimension="3D",
                        shape_kind="kubus",
                        canvas_target={"view": "3d_canvas", "model": "solids", "solidKind": "kubus"},
                        key_formulas=[
                            {"label": "Volume Kubus", "formula": "V = s^3"},
                            {"label": "Luas Permukaan Kubus", "formula": "L = 6s^2"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="sd_cuboid",
                        name="Balok",
                        dimension="3D",
                        shape_kind="balok",
                        canvas_target={"view": "3d_canvas", "model": "solids", "solidKind": "balok"},
                        key_formulas=[
                            {"label": "Volume Balok", "formula": "V = p \\times l \\times t"},
                            {"label": "Luas Permukaan Balok", "formula": "L = 2(pl + pt + lt)"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="sd_cylinder",
                        name="Tabung",
                        dimension="3D",
                        shape_kind="tabung",
                        canvas_target={"view": "3d_canvas", "model": "cylinder"},
                        key_formulas=[
                            {"label": "Volume Tabung", "formula": "V = \\pi r^2 t"},
                            {"label": "Luas Permukaan Tabung", "formula": "L = 2\\pi r(r + t)"}
                        ]
                    )
                ]
            )
        ]
    ),

    "SMP": TierDefinition(
        tier="SMP",
        level_name="Sekolah Menengah Pertama / Junior High Mathematics",
        target_audience="Siswa Kelas 7 - 9 SMP (Usia 13-15 Tahun)",
        curriculum_standards=["Kurikulum Merdeka SMP", "K13 SMP"],
        topics=[
            TopicDefinition(
                id="smp_algebra",
                name="Aljabar & Persamaan Linear",
                description="Persamaan dan pertidaksamaan linear satu & dua variabel (PLSV, SPLDV).",
                subtopics=[
                    SubtopicDefinition(
                        id="smp_plsv",
                        name="Persamaan Linear Satu Variabel (PLSV)",
                        dimension="1D",
                        key_formulas=[{"label": "Bentuk Baku", "formula": "ax + b = c \\implies x = \\frac{c - b}{a}"}],
                        common_misconceptions=["Lupa membalik tanda pertidaksamaan saat mengalikan atau membagi dengan bilangan negatif."]
                    ),
                    SubtopicDefinition(
                        id="smp_spldv",
                        name="Sistem Persamaan Linear Dua Variabel (SPLDV)",
                        dimension="2D",
                        canvas_target={"view": "2d_graph", "model": "2d_linear"},
                        key_formulas=[
                            {"label": "Bentuk Umum SPLDV", "formula": "a_1 x + b_1 y = c_1,\\quad a_2 x + b_2 y = c_2"},
                            {"label": "Metode Eliminasi & Substitusi", "formula": "\\Delta = a_1 b_2 - a_2 b_1 \\neq 0"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="smp_pythagoras",
                name="Teorema Pythagoras & Pola Bilangan",
                description="Relasi kuadrat sisi segitiga siku-siku dan pola barisan aritmetika.",
                subtopics=[
                    SubtopicDefinition(
                        id="smp_pythagoras_theorem",
                        name="Teorema Pythagoras",
                        dimension="2D",
                        key_formulas=[
                            {"label": "Sisi Miring", "formula": "c^2 = a^2 + b^2 \\implies c = \\sqrt{a^2 + b^2}"},
                            {"label": "Sisi Tegak", "formula": "a = \\sqrt{c^2 - b^2}"}
                        ],
                        common_misconceptions=["Menjumlahkan sisi siku-siku tanpa menguadratkannya: c != a + b."]
                    ),
                    SubtopicDefinition(
                        id="smp_arithmetic_seq",
                        name="Barisan & Deret Aritmetika",
                        dimension="1D",
                        key_formulas=[
                            {"label": "Suku ke-n", "formula": "U_n = a + (n - 1)b"},
                            {"label": "Jumlah n Suku", "formula": "S_n = \\frac{n}{2}(2a + (n - 1)b)"}
                        ]
                    )
                ]
            )
        ]
    ),

    "SMA": TierDefinition(
        tier="SMA",
        level_name="Sekolah Menengah Atas & Kejuruan / Senior High & Vocational",
        target_audience="Siswa Kelas 10 - 12 SMA/SMK (Usia 16-18 Tahun)",
        curriculum_standards=["Kurikulum Merdeka SMA Fase E & F", "K13 SMA", "AP Calculus AB/BC"],
        topics=[
            TopicDefinition(
                id="sma_calculus",
                name="Kalkulus Diferensial & Integral",
                description="Limit fungsi, turunan fungsi aljabar & trigonometri, integral tak tentu & tentu.",
                subtopics=[
                    SubtopicDefinition(
                        id="sma_derivative",
                        name="Turunan Fungsi (Diferensial)",
                        dimension="2D",
                        key_formulas=[
                            {"label": "Definisi Limit Turunan", "formula": "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}"},
                            {"label": "Aturan Pangkat", "formula": "\\frac{d}{dx}[x^n] = n x^{n-1}"},
                            {"label": "Aturan Rantai", "formula": "\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="sma_integral",
                        name="Integral & Luas Daerah",
                        dimension="2D",
                        key_formulas=[
                            {"label": "Teorema Dasar Kalkulus", "formula": "\\int_a^b f(x) dx = F(b) - F(a)"},
                            {"label": "Luas Daerah Antara Dua Kurva", "formula": "L = \\int_a^b |f(x) - g(x)| dx"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="sma_trig_matrix",
                name="Trigonometri Lanjut & Matriks",
                description="Identitas trigonometri, persamaan kuadrat trigonometri, determinan & invers matriks.",
                subtopics=[
                    SubtopicDefinition(
                        id="sma_trig_identity",
                        name="Identitas Trigonometri",
                        dimension="2D",
                        canvas_target={"view": "2d_graph", "model": "2d_trig"},
                        key_formulas=[
                            {"label": "Identitas Pythagoras", "formula": "\\sin^2(x) + \\cos^2(x) = 1"},
                            {"label": "Sudut Rangkap", "formula": "\\sin(2x) = 2\\sin(x)\\cos(x),\\quad \\cos(2x) = \\cos^2(x) - \\sin^2(x)"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="sma_matrix_2x2",
                        name="Matriks & Determinan",
                        dimension="nD",
                        key_formulas=[
                            {"label": "Determinan 2x2", "formula": "\\det \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc"},
                            {"label": "Invers Matriks 2x2", "formula": "A^{-1} = \\frac{1}{ad - bc} \\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}"}
                        ]
                    )
                ]
            )
        ]
    ),

    "S1": TierDefinition(
        tier="S1",
        level_name="Perguruan Tinggi Strata 1 (Sarjana / Undergraduate)",
        target_audience="Mahasiswa Matematika, Sains, Teknik, & Komputer",
        curriculum_standards=["ACM/IEEE Math for Computing", "BSc Mathematics Curriculum"],
        topics=[
            TopicDefinition(
                id="s1_multivariable",
                name="Kalkulus Multivariabel & Medan Vektor",
                description="Turunan parsial, gradien, divergensi, curl, integral lipat, dan teorema integral medan.",
                subtopics=[
                    SubtopicDefinition(
                        id="s1_grad_div_curl",
                        name="Operator Diferensial Vektor (Nabla)",
                        dimension="3D",
                        canvas_target={"view": "3d_canvas", "model": "saddle"},
                        key_formulas=[
                            {"label": "Gradien", "formula": "\\nabla f = \\left( \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z} \\right)"},
                            {"label": "Divergensi", "formula": "\\nabla \\cdot \\mathbf{F} = \\frac{\\partial F_x}{\\partial x} + \\frac{\\partial F_y}{\\partial y} + \\frac{\\partial F_z}{\\partial z}"},
                            {"label": "Curl", "formula": "\\nabla \\times \\mathbf{F} = \\det \\begin{pmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ \\partial_x & \\partial_y & \\partial_z \\\\ F_x & F_y & F_z \\end{pmatrix}"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="s1_integral_theorems",
                        name="Teorema Stokes & Divergensi Gauss",
                        dimension="3D",
                        key_formulas=[
                            {"label": "Teorema Gauss", "formula": "\\iiint_V (\\nabla \\cdot \\mathbf{F}) dV = \\iint_{\\partial V} \\mathbf{F} \\cdot \\mathbf{n} dS"},
                            {"label": "Teorema Stokes", "formula": "\\iint_S (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S} = \\oint_{\\partial S} \\mathbf{F} \\cdot d\\mathbf{r}"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="s1_linear_algebra",
                name="Aljabar Linear Lanjut",
                description="Ruang vektor abstrak, transformasi linear, nilai eigen & vektor eigen, dekomposisi matriks.",
                subtopics=[
                    SubtopicDefinition(
                        id="s1_eigenvalues",
                        name="Spektrum Nilai Eigen & Diagonalisasi",
                        dimension="nD",
                        key_formulas=[
                            {"label": "Persamaan Karakteristik", "formula": "\\det(A - \\lambda I) = 0"},
                            {"label": "Diagonalisasi", "formula": "A = P D P^{-1}"}
                        ]
                    ),
                    SubtopicDefinition(
                        id="s1_svd",
                        name="Singular Value Decomposition (SVD)",
                        dimension="nD",
                        key_formulas=[{"label": "Dekomposisi SVD", "formula": "A = U \\Sigma V^T"}]
                    )
                ]
            ),
            TopicDefinition(
                id="s1_ode",
                name="Persamaan Diferensial Biasa (ODEs)",
                description="PDB linier orde 1 dan 2, sistem PDB, transformasi Laplace, dan trayektori fase.",
                subtopics=[
                    SubtopicDefinition(
                        id="s1_second_order_ode",
                        name="PDB Linier Orde 2 Koefisien Konstan",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Bentuk Baku", "formula": "a y'' + b y' + c y = f(x)"},
                            {"label": "Persamaan Karakteristik", "formula": "a r^2 + b r + c = 0"}
                        ]
                    )
                ]
            )
        ]
    ),

    "S2": TierDefinition(
        tier="S2",
        level_name="Perguruan Tinggi Strata 2 (Magister / Master's Degree)",
        target_audience="Mahasiswa Magister Matematika Terapan, Fisika Teoretis, & AI Research",
        curriculum_standards=["MSc Mathematics & Theoretical Physics Core"],
        topics=[
            TopicDefinition(
                id="s2_pde",
                name="Persamaan Diferensial Parsial (PDEs)",
                description="Persamaan gelombang, persamaan panas, persamaan Laplace, metode pemisahan variabel, dan ruang Sobolev.",
                subtopics=[
                    SubtopicDefinition(
                        id="s2_heat_wave",
                        name="Persamaan Panas & Gelombang",
                        dimension="3D",
                        key_formulas=[
                            {"label": "Persamaan Panas", "formula": "\\frac{\\partial u}{\\partial t} = \\alpha \\nabla^2 u"},
                            {"label": "Persamaan Gelombang", "formula": "\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="s2_functional_analysis",
                name="Analisis Fungsional",
                description="Ruang Banach, ruang Hilbert, operator linier kontinu, dan teorema Hahn-Banach.",
                subtopics=[
                    SubtopicDefinition(
                        id="s2_hilbert_spaces",
                        name="Ruang Hilbert & Geometri Hasil Kali Dalam",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Ketaksamaan Cauchy-Schwarz", "formula": "|\\langle x, y \\rangle|^2 \\le \\langle x, x \\rangle \\cdot \\langle y, y \\rangle"},
                            {"label": "Identitas Jajar Genjang Ruang Hilbert", "formula": "\\|x + y\\|^2 + \\|x - y\\|^2 = 2\\|x\\|^2 + 2\\|y\\|^2"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="s2_diff_geometry",
                name="Geometri Diferensial & Manifold",
                description="Manifold mulus, ruang tangen, bentuk diferensial, dan metrik Riemannian.",
                subtopics=[
                    SubtopicDefinition(
                        id="s2_riemannian_metric",
                        name="Metrik Riemannian & Geodesik",
                        dimension="nD",
                        key_formulas=[
                            {"label": "Elemen Garis", "formula": "ds^2 = g_{\\mu\\nu} dx^\\mu dx^\\nu"},
                            {"label": "Persamaan Geodesik", "formula": "\\frac{d^2 x^\\lambda}{dt^2} + \\Gamma^\\lambda_{\\mu\\nu} \\frac{dx^\\mu}{dt} \\frac{dx^\\nu}{dt} = 0"}
                        ]
                    )
                ]
            )
        ]
    ),

    "S3": TierDefinition(
        tier="S3",
        level_name="Perguruan Tinggi Strata 3 (Doktoral / Doctoral Research)",
        target_audience="Peneliti Matematika Murni, Geometri Aljabar, Teori Kategori, Fisika Kuantum",
        curriculum_standards=["PhD Pure Mathematics & Advanced Research Frontiers"],
        topics=[
            TopicDefinition(
                id="s3_algebraic_topology",
                name="Topologi Aljabar & Teori Homotopi",
                description="Grup fundamental, homologi singular, kohomologi de Rham, bundel serat, dan kelas karakteristik.",
                subtopics=[
                    SubtopicDefinition(
                        id="s3_homology_cohomology",
                        name="Kompleks Rantai & Grup Homologi",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Batas Operator", "formula": "\\partial_n \\circ \\partial_{n+1} = 0"},
                            {"label": "Grup Homologi ke-n", "formula": "H_n(X) = \\ker(\\partial_n) / \\operatorname{im}(\\partial_{n+1})"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="s3_algebraic_geometry",
                name="Geometri Aljabar Modern & Skema",
                description="Skema Grothendieck, berkas (sheaves), kohomologi berkas, dan kurva eliptik di atas medan bilangan.",
                subtopics=[
                    SubtopicDefinition(
                        id="s3_sheaf_schemes",
                        name="Struktur Skema & Kohomologi Berkas",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Spektrum Ring", "formula": "X = \\operatorname{Spec}(R)"},
                            {"label": "Kurva Eliptik Weierstrass", "formula": "y^2 = x^3 + ax + b,\\quad \\Delta = -16(4a^3 + 27b^2) \\neq 0"}
                        ]
                    )
                ]
            ),
            TopicDefinition(
                id="s3_category_theory",
                name="Teori Kategori & Higher Category",
                description="Kategori, fungtor, transformasi alami, adjunction, monad, dan topos.",
                subtopics=[
                    SubtopicDefinition(
                        id="s3_adjunction",
                        name="Fungtor Adjungsi & Transformasi Alami",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Isomorfisme Adjungsi", "formula": "\\operatorname{Hom}_{\\mathcal{D}}(F(A), B) \\cong \\operatorname{Hom}_{\\mathcal{C}}(A, G(B))"}
                        ]
                    )
                ]
            )
        ]
    )
}


# =====================================================================
# Taksonomi Domain Non-Matematika (Pemrograman, Fisika, Kimia)
# =====================================================================
# MATH_TAXONOMY di atas TIDAK diubah sama sekali (backward compatible).
# Deklarasi di bawah ini adalah satu-satunya sumber kebenaran untuk
# metadata (domain, tier, topic, subtopic) item non-matematika; generators.py
# hanya boleh memproduksi item yang (domain, topic, subtopic)-nya dideklarasikan
# di sini. Tier mengikuti jenjang Kurikulum Merdeka tempat materi biasanya
# diajarkan (SMP/SMA/S1), bukan jenjang baru.

class DomainSubtopicDefinition(SubtopicDefinition):
    tier: str = "SMA"  # jenjang kurikulum: SMP, SMA, atau S1

class DomainTopicDefinition(TopicDefinition):
    subtopics: List[DomainSubtopicDefinition] = Field(default_factory=list)

class KnowledgeDomainDefinition(BaseModel):
    domain: str
    label: str
    description: str
    verification_engine: str  # mesin verifikasi deterministik yang dipakai generator
    topics: List[DomainTopicDefinition] = Field(default_factory=list)


DOMAIN_TAXONOMY: Dict[str, KnowledgeDomainDefinition] = {
    "pemrograman": KnowledgeDomainDefinition(
        domain="pemrograman",
        label="Pemrograman (Python, Logika Boolean, Algoritma)",
        description=(
            "Dasar Python, tabel kebenaran boolean, pelacakan loop/rekursi, debugging satu baris, "
            "dan klasifikasi kompleksitas waktu Big-O. Semua kebenaran dihitung dengan mengeksekusi "
            "template kode pada sandbox AST whitelist (bukan dinilai oleh LLM)."
        ),
        verification_engine="Python AST whitelist eval/exec + penghitungan operasi",
        topics=[
            DomainTopicDefinition(
                id="prog_dasar_python",
                name="Dasar Pemrograman Python",
                description="Ekspresi aritmetika, prioritas operator, dan nilai kebenaran ekspresi logika.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="prog_ekspresi_aritmetika",
                        name="Ekspresi Aritmetika & Prioritas Operator",
                        tier="SMP",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Pembagian Bulat", "formula": "a // b"},
                            {"label": "Prioritas", "formula": "() > ** > unary > * / // % > + -"}
                        ],
                        common_misconceptions=[
                            "Menganggap / dan // menghasilkan nilai yang sama.",
                            "Mengabaikan bahwa // dieksekusi sebelum - pada ekspresi campuran."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="prog_tabel_kebenaran",
                        name="Tabel Kebenaran & Logika Boolean",
                        tier="SMP",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Prioritas Logika", "formula": "not > and > or"},
                            {"label": "Jumlah Baris", "formula": "2^n untuk n variabel boolean"}
                        ],
                        common_misconceptions=[
                            "Menganggap and dan or dapat dipertukarkan tanpa tanda kurung.",
                            "Lupa bahwa not mengikat lebih kuat daripada and."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="prog_algoritma",
                name="Algoritma & Pelacakan Eksekusi",
                description="Menelusuri nilai variabel pada loop/rekursi dan menemukan bug satu baris.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="prog_trace_loop",
                        name="Pelacakan Nilai Loop (Trace)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Loop Berbatas", "formula": "for i in range(a, b + 1)"}
                        ],
                        common_misconceptions=[
                            "Menganggap range(a, b) menyertakan b.",
                            "Menjumlahkan nilai akhir loop saja tanpa mengakumulasi iterasi sebelumnya."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="prog_trace_recursion",
                        name="Pelacakan Rekursi",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Basis Rekursi", "formula": "if n <= 1: return 1"},
                            {"label": "Langkah Rekursi", "formula": "return n * f(n - 1)"}
                        ],
                        common_misconceptions=[
                            "Melewatkan kondisi basis sehingga rekursi tidak berhenti.",
                            "Menghitung hasil sekali panggilan tanpa mengalikan seluruh tumpukan rekursi."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="prog_debug_satu_baris",
                        name="Debugging Satu Baris Bug",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[],
                        common_misconceptions=[
                            "Mengganti inisialisasi akumulator alih-alih badan loop yang salah."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="prog_kompleksitas",
                name="Kompleksitas Algoritma (Big-O)",
                description="Klasifikasi pertumbuhan jumlah operasi dasar: O(1), O(log n), O(n), O(n log n), O(n^2).",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="prog_big_o",
                        name="Notasi Big-O Kompleksitas Waktu",
                        tier="S1",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Logaritmik", "formula": "O(\\log n)"},
                            {"label": "Linear-logaritmik", "formula": "O(n \\log n)"},
                            {"label": "Kuadratik", "formula": "O(n^2)"}
                        ],
                        common_misconceptions=[
                            "Menyimpulkan O(n^2) hanya karena ada dua variabel, bukan dua loop bersarang.",
                            "Menganggap loop yang membagi indeks dengan 2 tetap O(n)."
                        ]
                    )
                ]
            )
        ]
    ),

    "fisika": KnowledgeDomainDefinition(
        domain="fisika",
        label="Fisika (Kinematika, Dinamika, Energi, Listrik)",
        description=(
            "Kinematika v = s/t dan s = v0 t + 1/2 a t^2, Hukum II Newton F = ma, "
            "energi kinetik/potensial, serta Hukum Ohm dan daya listrik. "
            "Semua jawaban dihitung ulang secara numerik dengan Python/SymPy pada saat generasi."
        ),
        verification_engine="Python/SymPy (bilangan eksak + pengecekan satuan)",
        topics=[
            DomainTopicDefinition(
                id="fis_kinematika",
                name="Kinematika",
                description="Hubungan jarak, perpindahan, kelajuan, percepatan, dan waktu.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="fis_kecepatan",
                        name="Kelajuan Rata-Rata (v = s/t)",
                        tier="SMP",
                        dimension="Abstract",
                        key_formulas=[{"label": "Kelajuan", "formula": "v = \\frac{s}{t}"}],
                        common_misconceptions=[
                            "Membalik pembilang dan penyebut sehingga mengalikan jarak dengan waktu."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="fis_glbb",
                        name="Gerak Lurus Berubah Beraturan (s = v0 t + 1/2 a t^2)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Jarak GLBB", "formula": "s = v_0 t + \\frac{1}{2} a t^2"},
                            {"label": "Kecepatan GLBB", "formula": "v_t = v_0 + a t"}
                        ],
                        common_misconceptions=[
                            "Lupa mengkuadratkan waktu pada suku percepatan.",
                            "Menjumlahkan v0 dan a tanpa mengalikan dengan waktu."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="fis_dinamika",
                name="Dinamika",
                description="Gaya, massa, dan percepatan menurut Hukum II Newton.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="fis_newton",
                        name="Hukum II Newton (F = ma)",
                        tier="SMP",
                        dimension="Abstract",
                        key_formulas=[{"label": "Hukum II Newton", "formula": "F = m a"}],
                        common_misconceptions=[
                            "Membagi massa dengan percepatan alih-alih mengalikannya."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="fis_energi",
                name="Energi & Usaha",
                description="Energi kinetik, energi potensial gravitasi, dan konservasi energi mekanik.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="fis_energi_kinetik",
                        name="Energi Kinetik (Ek = 1/2 m v^2)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[{"label": "Energi Kinetik", "formula": "E_k = \\frac{1}{2} m v^2"}],
                        common_misconceptions=[
                            "Lupa mengkuadratkan kecepatan.",
                            "Lupa faktor 1/2 pada rumus energi kinetik."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="fis_energi_potensial",
                        name="Energi Potensial Gravitasi (Ep = m g h)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[{"label": "Energi Potensial", "formula": "E_p = m g h"}],
                        common_misconceptions=[
                            "Menggunakan kecepatan alih-alih ketinggian pada rumus energi potensial."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="fis_listrik",
                name="Listrik Dinamis",
                description="Hukum Ohm, hambatan, tegangan, arus, dan daya listrik.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="fis_hukum_ohm",
                        name="Hukum Ohm (V = IR)",
                        tier="SMP",
                        dimension="Abstract",
                        key_formulas=[{"label": "Hukum Ohm", "formula": "V = I R"}],
                        common_misconceptions=[
                            "Membagi hambatan dengan arus sehingga satuan tegangan tertukar."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="fis_daya_listrik",
                        name="Daya Listrik (P = VI)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Daya Listrik", "formula": "P = V I"},
                            {"label": "Daya & Hambatan", "formula": "P = I^2 R = \\frac{V^2}{R}"}
                        ],
                        common_misconceptions=[
                            "Menjumlahkan tegangan dan arus alih-alih mengalikannya."
                        ]
                    )
                ]
            )
        ]
    ),

    "kimia": KnowledgeDomainDefinition(
        domain="kimia",
        label="Kimia (Mol, Stoikiometri, Larutan, Gas Ideal)",
        description=(
            "Konsep mol n = m/Mr, stoikiometri reaksi berbasis koefisien, molaritas M = n/V, "
            "pH = -log[H+], dan gas ideal PV = nRT. Verifikasi numerik deterministik "
            "memakai massa atom relatif (Ar) yang dieksplisitkan pada soal."
        ),
        verification_engine="Python/SymPy (Ar eksplisit + cek konservasi/keidealan)",
        topics=[
            DomainTopicDefinition(
                id="kim_stoikiometri",
                name="Konsep Mol & Stoikiometri",
                description="Hubungan massa, massa molar, jumlah mol, dan rasio koefisien reaksi.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="kim_mol_massa",
                        name="Mol & Massa (n = m/Mr)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[{"label": "Konsep Mol", "formula": "n = \\frac{m}{M_r}"}],
                        common_misconceptions=[
                            "Membalik rumus sehingga mengalikan massa dengan Mr."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="kim_stoikiometri_reaksi",
                        name="Stoikiometri Reaksi (Rasio Koefisien)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Rasio Mol", "formula": "n_A / koef_A = n_B / koef_B"}
                        ],
                        common_misconceptions=[
                            "Mengabaikan koefisien reaksi dan menganggap rasio mol selalu 1:1."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="kim_larutan",
                name="Larutan & Asam-Basa",
                description="Konsentrasi molaritas dan skala pH untuk asam/basa kuat.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="kim_konsentrasi",
                        name="Molaritas (M = n/V)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[{"label": "Molaritas", "formula": "M = \\frac{n}{V(\\text{L})}"}],
                        common_misconceptions=[
                            "Memakai volume dalam mL tanpa mengubahnya ke liter."
                        ]
                    ),
                    DomainSubtopicDefinition(
                        id="kim_ph",
                        name="Derajat Keasaman (pH)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[{"label": "pH", "formula": "pH = -\\log_{10}[H^+]"}],
                        common_misconceptions=[
                            "Menganggap pH berbanding lurus dengan konsentrasi H+.",
                            "Lupa tanda negatif pada rumus pH."
                        ]
                    )
                ]
            ),
            DomainTopicDefinition(
                id="kim_gas",
                name="Gas Ideal",
                description="Persamaan keadaan gas ideal PV = nRT pada kondisi yang dinyatakan.",
                subtopics=[
                    DomainSubtopicDefinition(
                        id="kim_gas_ideal",
                        name="Persamaan Gas Ideal (PV = nRT)",
                        tier="SMA",
                        dimension="Abstract",
                        key_formulas=[
                            {"label": "Gas Ideal", "formula": "P V = n R T"},
                            {"label": "Konstanta Gas", "formula": "R = 0.082 \\, \\text{L atm mol}^{-1}\\text{K}^{-1}"}
                        ],
                        common_misconceptions=[
                            "Memakai suhu Celsius tanpa mengubahnya ke Kelvin.",
                            "Menukar posisi P dan V pada persamaan."
                        ]
                    )
                ]
            )
        ]
    )
}

DOMAIN_NAMES = ("matematika", "pemrograman", "fisika", "kimia")


def domain_subtopics(domain: str) -> List[DomainSubtopicDefinition]:
    """Kembalikan seluruh subtopik non-matematika yang terdeklarasi untuk domain."""
    definition = DOMAIN_TAXONOMY.get(domain)
    if definition is None:
        raise KeyError(f"Domain '{domain}' tidak terdeklarasi. Tersedia: {sorted(DOMAIN_TAXONOMY)}")
    return [st for topic in definition.topics for st in topic.subtopics]
