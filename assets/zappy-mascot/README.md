# ZAPPY — maskot 3D ZAP (sapi oranye–putih)

Maskot 3D untuk ZAP (Zero Answer Policy): sapi chibi yang gempal, oranye–putih,
dengan tanduk asimetris, jambul lembut, dan mata besar.

Dua kit, satu karakter:

| Kit | Isi | File |
|---|---|---|
| **Badan penuh** | 8 pose utuh (berdiri, melambai, duduk, lari, …) | `out/zapy_<pose>.glb` |
| **Wajah / kepala** | 8 ekspresi, hanya kepala + leher (untuk avatar, ikon, stiker) | `out/zapy_head_<ekspresi>.glb` |

Semua vertex digenerate **prosedural** dari primitif analitik, jadi hasilnya
deterministik, bisa di-version-control, dan bebas biaya regenerasi.

```
assets/zappy-mascot/
├─ build_zapy.py        generator mesh badan + ekspor glTF 2.0 (GLB)
├─ build_zapy_head.py   generator kit wajah (memakai geometri kepala yang sama)
├─ preview.html          render QA: turnaround / pose sheet / frame turntable
├─ viewer.html           viewer interaktif (badan + wajah, OrbitControls)
├─ make_turntable.py     grid frame → GIF animasi
├─ MANIFEST.json         provenance badan: pose, jumlah tri, sha256
├─ MANIFEST_HEAD.json    provenance wajah: ekspresi, jumlah tri, sha256
├─ out/                  zapy_<pose>.glb, zapy_poses.glb, zapy_head_*.glb, zapy_heads.glb
└─ previews/             still QA; turntable_idle.gif; head_*.png
```

## Spesifikasi aset

| Properti | Badan penuh | Wajah / kepala |
|---|---|---|
| Format | glTF 2.0 binary (`.glb`), material PBR metallic-roughness | sama |
| Orientasi | Y-up, menghadap **+Z** | sama |
| Origin | di antara kaki, lantai `y = 0` | dasar leher, `y = 0` |
| Tinggi | ±1.0 m | ±0.64 m (dasar leher → ujung tanduk) |
| Geometri | 39.824 tri, 22.406 vert, 11 node | 20.904 tri, 11.756 vert, 5 node |
| Ukuran file | ±789 KB per pose | ±414–434 KB per ekspresi |
| Material | 7 material, **tanpa tekstur** (warna murni) | sama |

Palet: `cream #FFF8F0`, `cream_shade #EDD3B0`, `orange #EE8B3C`,
`orange_deep #D9702A`, `ink #2B1F17`, `blush #F5AE8C`, `white #FFFFFF`.

Tidak ada tekstur sama sekali — bercak, mata, moncong, dan lubang hidung semuanya
geometri + warna material. Jadi tidak ada UV map yang bisa hilang atau pecah.

### Node / joint

```
Badan:  Torso ── Head ── EarL, EarR, EyeL, EyeR
              ├─ LegFL, LegFR, LegBL, LegBR
              └─ Tail

Wajah:  Head ── EarL, EarR, EyeL, EyeR
```

Pose adalah transform node (`translation`/`rotation`/`scale`), bukan di-bake ke
vertex. `EyeL`/`EyeR` di-scale pada sumbu Y untuk kedip / sipit.

## Pose badan

| Pose | Gerakan |
|---|---|
| `idle` | berdiri santai |
| `wave` | satu kaki depan terangkat ke depan (melambai) |
| `cheer` | dua kaki depan terangkat, badan melompat, kepala mendongak |
| `run` | kaki depan-belakang berselang, badan condong |
| `sit` | duduk, kaki belakang terlipat |
| `sleep` | berbaring, mata tertutup |
| `think` | kepala miring, satu kaki terangkat, satu mata menyipit |
| `wink` | satu mata berkedip, kepala miring |

## Ekspresi wajah

Mulut punya 4 varian geometri (`smile`, `wide`, `open`, `flat`) yang dipilih per
ekspresi; sisanya dari rotasi kepala dan skala mata.

| Ekspresi | Mulut | Aksen |
|---|---|---|
| `neutral` | smile | — |
| `happy` | wide | mata agak sipit, telinga terangkat |
| `laugh` | open | mata terpejam, kepala mendongak |
| `wink` | smile | mata kanan berkedip, kepala miring |
| `sleepy` | flat | kedua mata sipit, telinga turun |
| `surprised` | open | mata membesar, telinga tegak |
| `thinking` | flat | kepala miring, satu mata menyipit |
| `shy` | smile | mata setengah, kepala menunduk, telinga ke belakang |

Pivot `Head` ada di **dasar leher**, jadi memutar `Head` = geleng/angguk yang wajar
(bukan mengorbit di tengah kepala). Konsekuensinya ekspresi yang menunduk bisa
sedikit turun di bawah `y = 0` — untuk UI yang mengapung ini tidak masalah.

## Pakai di three.js

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/assets/zappy-mascot/out/zapy_wave.glb', (gltf) => {
  const zapy = gltf.scene;
  zapy.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(zapy);            // sudah Y-up, satuan meter, origin di lantai
});
```

Wajah untuk avatar / bubble chat:

```js
loader.load('/assets/zappy-mascot/out/zapy_head_happy.glb', (gltf) => {
  gltf.scene.position.set(0, 0, 0);        // dasar leher di y = 0
  gltf.scene.rotation.y = Math.PI;          // hadap kamera kalau perlu
  scene.add(gltf.scene);
});
```

Animasi kustom (tanpa library tambahan):

```js
const head = zapy.getObjectByName('Head');
head.rotation.z = Math.sin(t * 2) * 0.06;   // angguk kecil
const eye = zapy.getObjectByName('EyeL');
eye.scale.y = 0.15;                          // kedip
```

`zapy_poses.glb` (8 pose, jarak 0.86 m) dan `zapy_heads.glb` (8 ekspresi, jarak
0.62 m) adalah *sheet* untuk preview, bukan untuk in-game.

## Regenerasi & QA

```powershell
cd assets/zappy-mascot
python build_zapy.py          # badan      → out/zapy_*.glb + MANIFEST.json
python build_zapy_head.py     # wajah      → out/zapy_head_*.glb + MANIFEST_HEAD.json
python make_turntable.py      # previews/_turntable_grid.png → GIF

python -m http.server 8791    # viewer & preview butuh HTTP (fetch GLB)
# http://127.0.0.1:8791/viewer.html
# http://127.0.0.1:8791/preview.html?mode=poses&cell=430
# http://127.0.0.1:8791/preview.html?set=head&mode=poses&cell=430
```

`preview.html` merender di Chromium (WebGL nyata) dan menulis PNG; itulah bukti
QA yang dipakai, bukan thumbnail dari generator.

## Catatan QA & batasan

Diperiksa lewat render WebGL, bukan diklaim dari kode:

- badan: turnaround 6 sudut, pose sheet 8 × 3, close-up wajah, turntable 36 frame;
- wajah: turnaround 6 sudut (`head_turnaround.png`), face sheet 8 × 3
  (`head_sheet.png`), lineup (`head_lineup.png`).

Bug nyata yang ketemu lewat QA ini dan sudah diperbaiki: mesh ter-offset dua kali,
indeks anak node salah di pose sheet, origin kit wajah belum tergeser ke `y = 0`,
dan rim leher yang menonjol keluar tengkorak.

Batasan yang diketahui:

- tidak ada skinning/animasi skeletal bawaan — pose/ekspresi adalah transform node;
- ekspresi hanya lewat `scale` mata + varian geometri mulut; belum ada morph target;
- belum ada LOD, collider, atau socket aksesoris (topi/papan tulis);
- versi wajah belum punya varian tanpa leher (bust cut) maupun varian mata tertutup
  penuh selain lewat scale.

## Provenance

- Metode: mesh prosedural (Python + NumPy), diekspor sebagai glTF 2.0.
- Provider berbayar: **tidak dipakai**. Tidak ada tool `atlas_3d` / `fal_3d` dan
  tidak ada API key (`ATLASCLOUD_API_KEY`, `FAL_KEY`) di sesi ini, dan Blender
  tidak terpasang — jadi jalur text-to-3D berbayar tidak dijalankan sama sekali.
- Biaya: Rp0.
